from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import os
import asyncio
import base64
import io
from google import genai
from PIL import Image
from mistralai.client import Mistral
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

@router.get("/libraries")
async def get_libraries(user=Depends(current_user)):
    librerias = await db.libraries.find({}, {"_id": 0}).to_list(100)
    for lib in librerias:
        count = await db.molds.count_documents({"library_id": lib["id"]})
        lib["total_moldes"] = count
    return librerias

@router.post("/libraries")
async def create_library(payload: LibraryIn, user=Depends(current_user)):
    lib = {
        "id": new_id(),
        "nombre": payload.nombre,
        "creado_por": user["name"],
        "created_at": now_iso()
    }
    await db.libraries.insert_one(lib)
    lib.pop("_id", None)
    lib["total_moldes"] = 0
    return lib

@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        data = await file.read()
        
        # --- PROCESAR LA IMAGEN A FORMATO JPEG ESTÁNDAR ---
        # Esto evita errores si el celular manda imágenes HEIC o muy pesadas
        try:
            imagen_pil = Image.open(io.BytesIO(data))
            if imagen_pil.mode in ("RGBA", "P"):
                imagen_pil = imagen_pil.convert("RGB")
            
            # Redimensionar si es muy grande (max 2000px)
            imagen_pil.thumbnail((2000, 2000))
            
            # Guardar en un buffer como JPEG
            buffer = io.BytesIO()
            imagen_pil.save(buffer, format="JPEG", quality=85)
            data_jpeg = buffer.getvalue()
        except Exception as e:
            logger.error(f"Error procesando imagen: {e}")
            raise HTTPException(400, "El archivo no es una imagen válida.")

        prompt = """
        Eres un asistente experto en joyería. Te voy a pasar una foto de una lista escrita a mano.
        Tu tarea es extraer TODO el texto de la imagen.
        Por favor:
        1. Respeta el formato de lista.
        2. Presta mucha atención a los números y medidas (ej. 8x6, talla 7, etc.).
        3. Devuelve solo el texto limpio y organizado, sin explicaciones.
        """
        
        texto_extraido = ""

        # --- INTENTO 1: GEMINI ---
        try:
            API_KEY_GEMINI = os.getenv("GEMINI_API_KEY")
            if API_KEY_GEMINI:
                client_gemini = genai.Client(api_key=API_KEY_GEMINI)
                imagen_gemini = Image.open(io.BytesIO(data_jpeg))
                
                response = await asyncio.to_thread(
                    client_gemini.models.generate_content,
                    model='gemini-3.8-flash',
                    contents=[prompt, imagen_gemini]
                )
                if response.text:
                    texto_extraido = response.text
                    logger.info("✅ Leído con Gemini")
        except Exception as e:
            logger.warning(f"Gemini falló: {e}. Intentando con Mistral...")

        # --- INTENTO 2: MISTRAL (Respaldo) ---
        if not texto_extraido:
            try:
                API_KEY_MISTRAL = os.getenv("MISTRAL_API_KEY")
                if API_KEY_MISTRAL:
                    client_mistral = Mistral(api_key=API_KEY_MISTRAL)
                    # Convertir el JPEG a base64
                    image_b64 = base64.b64encode(data_jpeg).decode("utf-8")
                    image_url = f"data:image/jpeg;base64,{image_b64}"
                    
                    response = client_mistral.ocr.process(
                        model="mistral-ocr-latest",
                        document={"type": "document_url", "document_url": image_url}
                    )
                    texto_extraido = "\n".join([page.markdown for page in response.pages])
                    logger.info("✅ Leído con Mistral (Respaldo)")
            except Exception as e:
                logger.error(f"Error en Mistral: {e}")

        # Si de plano no se leyó nada, ponemos un texto por defecto
        if not texto_extraido.strip():
            texto_extraido = "No se pudo leer la letra. Por favor, escribe el texto manualmente."

        # --- SUBIR FOTO A CLOUDINARY ---
        foto_url = ""
        try:
            path = f"jarvis-joyeria/molds/{new_id()}.jpg"
            result = await asyncio.to_thread(put_object, path, data_jpeg, "image/jpeg")
            foto_url = result.get("url", "")
        except Exception as e:
            logger.error(f"Error subiendo foto a Cloudinary: {e}")

        return {
            "ok": True, 
            "texto": texto_extraido,
            "foto_url": foto_url
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error general en scan: {e}")
        raise HTTPException(500, "Error interno al escanear la imagen.")

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
    if library_id:
        query["library_id"] = library_id
    if search:
        query["$or"] = [
            {"nombre": {"$regex": search, "$options": "i"}},
            {"texto": {"$regex": search, "$options": "i"}}
        ]
    moldes = await db.molds.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return moldes