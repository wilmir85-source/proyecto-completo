from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
import os, io, asyncio, random
from google import genai
from google.genai import types
from PIL import Image
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from core import db, current_user, now_iso, new_id, logger
from dotenv import load_dotenv

load_dotenv()
router = APIRouter(prefix="/api")

# --- MODELOS DE DATOS ---
class LibreriaIn(BaseModel):
    nombre: str

class MoldeIn(BaseModel):
    libreria_id: str
    numero: str
    tipo: Optional[str] = ""
    carrera: Optional[str] = ""
    medida: Optional[str] = ""
    notas: Optional[str] = ""

class MoldeUpdate(BaseModel):
    numero: Optional[str] = None
    tipo: Optional[str] = None
    carrera: Optional[str] = None
    medida: Optional[str] = None
    notas: Optional[str] = None

class MoldeExtraido(BaseModel):
    numero: str
    tipo: str
    carrera: str
    medida: str
    notas: str

class ListaMoldes(BaseModel):
    titulo_hoja: str
    moldes: List[MoldeExtraido]

# --- CLIENTE GEMINI ---
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
client_gemini = genai.Client(api_key=GEMINI_KEY) if GEMINI_KEY else None

@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        if not client_gemini:
            raise HTTPException(500, "Falta API KEY de Gemini.")
            
        data = await file.read()
        with Image.open(io.BytesIO(data)) as imagen:
            if imagen.mode != "RGB":
                imagen = imagen.convert("RGB")

            prompt = (
                "Analiza esta imagen que contiene una lista escrita a mano de moldes de joyería. "
                "1. Extrae el título principal de la hoja (ej. 'Anillo Graduación de Mujer'). "
                "2. Extrae TODOS los moldes que veas en la lista. Para cada molde, identifica el número (ej. MG05), "
                "el tipo de joya, la carrera o diseño, la medida y las notas. "
                "Si un dato no aparece, déjalo vacío."
            )

            response = await asyncio.to_thread(
                client_gemini.models.generate_content,
                model="gemini-3.8-flash",
                contents=[prompt, imagen],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ListaMoldes,
                ),
            )
        
        return {"ok": True, "titulo": response.parsed.titulo_hoja, "moldes": response.parsed.moldes}
    except Exception as e:
        logger.error(f"Error OCR: {e}")
        raise HTTPException(502, "Error al leer la imagen.")

# --- ENDPOINTS DE CARPETAS ---
@router.post("/libraries")
async def create_library(payload: LibreriaIn, user=Depends(current_user)):
    lib = {"id": new_id(), "nombre": payload.nombre, "creado_por": user["name"], "created_at": now_iso()}
    await db.libraries.insert_one(lib)
    lib.pop("_id", None)
    return lib

@router.get("/libraries")
async def get_libraries(user=Depends(current_user)):
    return await db.libraries.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)

@router.put("/libraries/{libreria_id}")
async def update_library(libreria_id: str, payload: LibreriaIn, user=Depends(current_user)):
    existing = await db.libraries.find_one({"id": libreria_id})
    if not existing:
        raise HTTPException(404, "Carpeta no encontrada")
    await db.libraries.update_one({"id": libreria_id}, {"$set": {"nombre": payload.nombre}})
    return await db.libraries.find_one({"id": libreria_id}, {"_id": 0})

@router.delete("/libraries/{libreria_id}")
async def delete_library(libreria_id: str, user=Depends(current_user)):
    result = await db.libraries.delete_one({"id": libreria_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Carpeta no encontrada")
    await db.molds.delete_many({"libreria_id": libreria_id})
    return {"ok": True}

# --- ENDPOINTS DE MOLDES ---
@router.post("/molds")
async def save_mold(payload: MoldeIn, user=Depends(current_user)):
    molde = payload.model_dump()
    molde["id"] = new_id()
    molde["creado_por"] = user["name"]
    molde["created_at"] = now_iso()
    await db.molds.insert_one(molde)
    molde.pop("_id", None)
    return molde

@router.put("/molds/{molde_id}")
async def update_mold(molde_id: str, payload: MoldeUpdate, user=Depends(current_user)):
    existing = await db.molds.find_one({"id": molde_id})
    if not existing:
        raise HTTPException(404, "Molde no encontrado")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.molds.update_one({"id": molde_id}, {"$set": updates})
    return await db.molds.find_one({"id": molde_id}, {"_id": 0})

@router.delete("/molds/{molde_id}")
async def delete_mold(molde_id: str, user=Depends(current_user)):
    result = await db.molds.delete_one({"id": molde_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Molde no encontrado")
    return {"ok": True}

@router.get("/libraries/{libreria_id}/molds")
async def get_molds_by_library(libreria_id: str, user=Depends(current_user)):
    return await db.molds.find({"libreria_id": libreria_id}, {"_id": 0}).sort("numero", 1).to_list(1000)