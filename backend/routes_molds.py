from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
import os
import io
import asyncio
import cloudinary
import cloudinary.uploader
from google import genai
from google.genai import types
from PIL import Image
from core import db, current_user, now_iso, new_id, logger
from dotenv import load_dotenv

load_dotenv()
router = APIRouter(prefix="/api")

# --- CONFIGURACIÓN DE CLOUDINARY ---
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

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
    foto_url: Optional[str] = ""

class MoldeUpdate(BaseModel):
    numero: Optional[str] = None
    tipo: Optional[str] = None
    carrera: Optional[str] = None
    medida: Optional[str] = None
    notas: Optional[str] = None
    foto_url: Optional[str] = None

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

# ==========================================
# RUTAS DE JARVIS (VOZ EN TIEMPO REAL)
# ==========================================

@router.get("/jarvis/live-token")
async def get_live_token():
    try:
        if not client_gemini:
            raise HTTPException(500, "Falta API KEY de Gemini.")
            
        # Creamos un token de un solo uso para el navegador
        token = client_gemini.auth_tokens.create(
            config={
                "uses": 1,
                "live_connect_constraints": {
                    "model": "gemini-2.0-flash-exp",
                    "config": {
                        "response_modalities": ["AUDIO"],
                        "speech_config": {
                            "voice_config": {
                                "prebuilt_voice_config": {"voice_name": "Puck"}
                            }
                        }
                    }
                }
            }
        )
        return {"token": token.name}
    except Exception as e:
        logger.error(f"Error creando token de voz: {e}")
        raise HTTPException(500, "Error al iniciar el sistema de voz")

# ==========================================
# RUTAS DE MOLDES (OCR Y FOTOS)
# ==========================================

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
                "2. Extrae TODOS los moldes que veas. Para cada molde, identifica el número, "
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

@router.post("/molds/upload-photo")
async def upload_mold_photo(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        data = await file.read()
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            io.BytesIO(data),
            folder="jarvis_moldes"
        )
        return {"ok": True, "url": result.get("secure_url")}
    except Exception as e:
        logger.error(f"Error subiendo foto a Cloudinary: {e}")
        raise HTTPException(500, "Error al subir la foto")

# ==========================================
# RUTAS DE CARPETAS
# ==========================================

@router.post("/libraries")
async def create_library(payload: LibreriaIn, user=Depends(current_user)):
    lib = {"id": new_id(), "nombre": payload.nombre, "creado_por": user["name"], "created_at": now_iso()}
    await db.libraries.insert_one(lib)
    lib.pop("_id", None)
    return lib

@router.get("/libraries")
async def get_libraries(user=Depends(current_user)):
    return await db.libraries.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)

@router.delete("/libraries/{libreria_id}")
async def delete_library(libreria_id: str, user=Depends(current_user)):
    await db.libraries.delete_one({"id": libreria_id})
    await db.molds.delete_many({"libreria_id": libreria_id})
    return {"ok": True}

# ==========================================
# RUTAS DE MOLDES (CRUD)
# ==========================================

@router.post("/molds")
async def save_mold(payload: MoldeIn, user=Depends(current_user)):
    molde = payload.model_dump()
    molde["id"] = new_id()
    molde["creado_por"] = user["name"]
    molde["created_at"] = now_iso()
    await db.molds.insert_one(molde)
    molde.pop("_id", None)
    return molde

@router.get("/libraries/{libreria_id}/molds")
async def get_molds_by_library(libreria_id: str, user=Depends(current_user)):
    return await db.molds.find({"libreria_id": libreria_id}, {"_id": 0}).sort("numero", 1).to_list(1000)

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