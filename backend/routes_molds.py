from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import os
import base64
from mistralai.client import Mistral
from core import db, current_user, now_iso, new_id, put_object, logger
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api")

# --- MODELOS ---
class LibraryIn(BaseModel):
    nombre: str

class MoldeIn(BaseModel):
    nombre: str
    texto: str
    foto_url: str
    library_id: Optional[str] = None # <-- NUEVO: A qué librería pertenece

# --- RUTAS DE LIBRERÍAS (Colecciones) ---
@router.post("/libraries")
async def create_library(payload: LibraryIn, user=Depends(current_user)):
    libreria = {
        "id": new_id(),
        "nombre": payload.nombre,
        "creado_por": user["name"],
        "created_at": now_iso()
    }
    await db.libraries.insert_one(libreria)
    libreria.pop("_id", None)
    return libreria

@router.get("/libraries")
async def get_libraries(user=Depends(current_user)):
    # Obtenemos las librerías y contamos cuántos moldes tiene cada una
    librerias = await db.libraries.find({}, {"_id": 0}).to_list(100)
    for lib in librerias:
        lib["total_moldes"] = await db.molds.count_documents({"library_id": lib["id"]})
    return librerias

# --- RUTAS DE MOLDES ---
@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        API_KEY = os.getenv("MISTRAL_API_KEY")
        if not API_KEY:
            raise HTTPException(500, "No se encontró la MISTRAL_API_KEY")

        data = await file.read()
        image_b64 = base64.b64encode(data).decode("utf-8")
        image_url = f"data:image/jpeg;base64,{image_b64}"

        client = Mistral(api_key=API_KEY)
        response = client.ocr.process(
            model="mistral-ocr-latest",
            document={"type": "document_url", "document_url": image_url}
        )

        texto_extraido = ""
        for page in response.pages:
            texto_extraido += page.markdown + "\n"

        path = f"jarvis-joyeria/molds/{new_id()}.jpg"
        result = put_object(path, data, "image/jpeg")

        return {"ok": True, "texto": texto_extraido, "foto_url": result.get("url", ""), "foto_path": result.get("path", "")}
    except Exception as e:
        logger.error(f"Error en Mistral OCR: {e}")
        raise HTTPException(500, f"Error al leer la imagen: {str(e)}")

@router.post("/molds")
async def save_mold(payload: MoldeIn, user=Depends(current_user)):
    molde = {
        "id": new_id(),
        "nombre": payload.nombre,
        "texto": payload.texto,
        "foto_url": payload.foto_url,
        "library_id": payload.library_id, # <-- Guardamos a qué librería va
        "creado_por": user["name"],
        "created_at": now_iso()
    }
    await db.molds.insert_one(molde)
    molde.pop("_id", None)
    return {"ok": True, "molde": molde}

@router.get("/molds")
async def get_molds(search: Optional[str] = None, library_id: Optional[str] = None, user=Depends(current_user)):
    query = {}
    
    # Si nos piden moldes de una librería específica
    if library_id:
        query["library_id"] = library_id
        
    # Si hay una búsqueda por texto
    if search:
        query["$or"] = [
            {"nombre": {"$regex": search, "$options": "i"}},
            {"texto": {"$regex": search, "$options": "i"}}
        ]
    
    moldes = await db.molds.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return moldes