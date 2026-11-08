from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import os
from openai import OpenAI # <-- Usamos OpenAI, no Mistral
from core import db, current_user, now_iso, new_id, put_object, logger
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api")

class LibraryIn(BaseModel):
    nombre: str

class MoldeIn(BaseModel):
    nombre: str
    texto: str
    foto_url: str
    library_id: Optional[str] = None

# --- RUTAS DE LIBRERÍAS ---
@router.post("/libraries")
async def create_library(payload: LibraryIn, user=Depends(current_user)):
    libreria = {"id": new_id(), "nombre": payload.nombre, "creado_por": user["name"], "created_at": now_iso()}
    await db.libraries.insert_one(libreria)
    libreria.pop("_id", None)
    return libreria

@router.get("/libraries")
async def get_libraries(user=Depends(current_user)):
    librerias = await db.libraries.find({}, {"_id": 0}).to_list(100)
    for lib in librerias:
        lib["total_moldes"] = await db.molds.count_documents({"library_id": lib["id"]})
    return librerias

# --- RUTA DE MOLDES (OCR CON ZHIPU) ---
@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        API_KEY = os.getenv("ZAI_API_KEY")
        if not API_KEY:
            raise HTTPException(500, "No se encontró la ZAI_API_KEY")

        # 1. Subir la foto a Cloudinary PRIMERO para obtener la URL
        data = await file.read()
        path = f"jarvis-joyeria/molds/{new_id()}.jpg"
        result = put_object(path, data, "image/jpeg")
        foto_url_publica = result.get("url")

        # 2. Conectar con Zhipu AI (usa el formato de OpenAI)
        client = OpenAI(
            api_key=API_KEY,
            base_url="https://open.bigmodel.cn/api/paas/v4"
        )

        prompt = """
        Eres un asistente experto en joyería. Te voy a pasar una foto de una lista escrita a mano.
        Tu tarea es extraer TODO el texto de la imagen.
        Por favor:
        1. Respeta el formato de lista.
        2. Presta mucha atención a los números y medidas (ej. 8x6, talla 7, etc.).
        3. Devuelve solo el texto limpio y organizado, sin explicaciones adicionales.
        """

        # 3. Llamar al modelo gratuito de visión
        response = client.chat.completions.create(
            model="glm-4v-flash", 
            messages=[
                {"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": foto_url_publica}}
                ]}
            ]
        )

        texto_extraido = response.choices[0].message.content

        return {
            "ok": True, 
            "texto": texto_extraido, 
            "foto_url": foto_url_publica, 
            "foto_path": path
        }
    except Exception as e:
        logger.error(f"Error en Zhipu OCR: {e}")
        raise HTTPException(500, f"Error al leer la imagen: {str(e)}")

@router.post("/molds")
async def save_mold(payload: MoldeIn, user=Depends(current_user)):
    molde = {
        "id": new_id(), 
        "nombre": payload.nombre, 
        "texto": payload.texto, 
        "foto_url": payload.foto_url, 
        "library_id": payload.library_id, 
        "creado_por": user["name"], 
        "created_at": now_iso()
    }
    await db.molds.insert_one(molde)
    molde.pop("_id", None)
    return {"ok": True, "molde": molde}

@router.get("/molds")
async def get_molds(search: Optional[str] = None, library_id: Optional[str] = None, user=Depends(current_user)):
    query = {}
    if library_id: query["library_id"] = library_id
    if search:
        query["$or"] = [{"nombre": {"$regex": search, "$options": "i"}}, {"texto": {"$regex": search, "$options": "i"}}]
    moldes = await db.molds.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return moldes