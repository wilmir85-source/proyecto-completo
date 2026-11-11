from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import os
import io
import asyncio
import random
import base64
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
    texto: Optional[str] = ""

class MoldeUpdate(BaseModel):
    numero: Optional[str] = None
    tipo: Optional[str] = None
    carrera: Optional[str] = None
    medida: Optional[str] = None
    notas: Optional[str] = None
    texto: Optional[str] = None

class DatosMolde(BaseModel):
    tipo: str
    carrera: str
    medida: str
    numero: str
    notas: str

# --- CLIENTES DE IA ---
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
client_gemini = genai.Client(api_key=GEMINI_KEY) if GEMINI_KEY else None

PROMPT = (
    "Analiza la imagen del molde de joyería. Extrae los datos de manera precisa. "
    "Si algún campo no aparece, asigna una cadena vacía."
)

async def extraer_con_gemini(imagen):
    if not client_gemini:
        raise Exception("Gemini no configurado")
    
    response = await asyncio.to_thread(
        client_gemini.models.generate_content,
        model="gemini-3.8-flash",
        contents=[PROMPT, imagen],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=DatosMolde,
        ),
    )
    return response.parsed.model_dump()

async def extraer_datos_molde(imagen, max_retries=2):
    for intento in range(max_retries):
        try:
            return await extraer_con_gemini(imagen)
        except Exception as e:
            if "503" in str(e) or "429" in str(e):
                if intento < max_retries - 1:
                    await asyncio.sleep(2)
                else:
                    raise e
            else:
                raise e
    raise HTTPException(503, "Servicio de IA ocupado. Intenta de nuevo.")

# --- ENDPOINTS ---

@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        data = await file.read()
        with Image.open(io.BytesIO(data)) as imagen:
            if imagen.mode != "RGB":
                imagen = imagen.convert("RGB")
            datos = await extraer_datos_molde(imagen)
            return {"ok": True, "datos": datos}
    except Exception as e:
        logger.error(f"Error OCR final: {e}")
        raise HTTPException(502, "Error al procesar la imagen.")

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
    await db.libraries.update_one({"id": libreria_id}, {"$set": {"nombre": payload.nombre}})
    return await db.libraries.find_one({"id": libreria_id}, {"_id": 0})

@router.delete("/libraries/{libreria_id}")
async def delete_library(libreria_id: str, user=Depends(current_user)):
    await db.libraries.delete_one({"id": libreria_id})
    await db.molds.delete_many({"libreria_id": libreria_id})
    return {"ok": True}

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
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.molds.update_one({"id": molde_id}, {"$set": updates})
    return await db.molds.find_one({"id": molde_id}, {"_id": 0})

@router.delete("/molds/{molde_id}")
async def delete_mold(molde_id: str, user=Depends(current_user)):
    await db.molds.delete_one({"id": molde_id})
    return {"ok": True}

@router.get("/libraries/{libreria_id}/molds")
async def get_molds_by_library(libreria_id: str, user=Depends(current_user)):
    return await db.molds.find({"libreria_id": libreria_id}, {"_id": 0}).sort("numero", 1).to_list(1000)

@router.get("/molds/search")
async def search_molds(q: str, user=Depends(current_user)):
    if not q: return []
    query = {"$or": [
        {"numero": {"$regex": q, "$options": "i"}},
        {"tipo": {"$regex": q, "$options": "i"}},
        {"carrera": {"$regex": q, "$options": "i"}},
        {"medida": {"$regex": q, "$options": "i"}},
        {"notas": {"$regex": q, "$options": "i"}},
    ]}
    resultados = await db.molds.find(query, {"_id": 0}).to_list(200)
    for r in resultados:
        lib = await db.libraries.find_one({"id": r["libreria_id"]})
        r["nombre_libreria"] = lib["nombre"] if lib else "Sin Carpeta"
    return resultados