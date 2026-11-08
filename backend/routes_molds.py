from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import os
import asyncio
import base64
import io
from google import genai
from google.genai import errors as genai_errors
from PIL import Image
from mistralai.client import Mistral
from core import db, current_user, now_iso, new_id, put_object, logger
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api")

class MoldeIn(BaseModel):
    nombre: str
    texto: str
    foto_url: str
    coleccion: Optional[str] = "General" # <-- NUEVO CAMPO PARA LAS CARPETAS

# --- 1. RUTA PARA LEER LA FOTO (GEMINI -> FALLBACK MISTRAL) ---
@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    data = await file.read()
    prompt = """
    Eres un asistente experto en joyería. Te voy a pasar una foto de una lista escrita a mano.
    Tu tarea es extraer TODO el texto de la imagen.
    Por favor:
    1. Respeta el formato de lista.
    2. Presta mucha atención a los números y medidas (ej. 8x6, talla 7, etc.).
    3. Devuelve solo el texto limpio y organizado, sin explicaciones adicionales.
    """
    
    texto_extraido = None

    # --- INTENTO 1: GEMINI (El más preciso) ---
    try:
        API_KEY_GEMINI = os.getenv("GEMINI_API_KEY")
        if API_KEY_GEMINI:
            client_gemini = genai.Client(api_key=API_KEY_GEMINI)
            imagen = Image.open(io.BytesIO(data))
            
            response = await asyncio.to_thread(
                client_gemini.models.generate_content,
                model='gemini-3.8-flash',
                contents=[prompt, imagen]
            )
            if response.text:
                texto_extraido = response.text
                logger.info("✅ Leído con Gemini")
    except Exception as e:
        logger.warning(f"Gemini falló o está saturado: {e}. Intentando con Mistral...")

    # --- INTENTO 2: MISTRAL (El respaldo a prueba de balas) ---
    if not texto_extraido:
        try:
            API_KEY_MISTRAL = os.getenv("MISTRAL_API_KEY")
            if not API_KEY_MISTRAL:
                raise HTTPException(500, "Falta llave de Mistral y Gemini falló")
                
            client_mistral = Mistral(api_key=API_KEY_MISTRAL)
            image_b64 = base64.b64encode(data).decode("utf-8")
            image_url = f"data:image/jpeg;base64,{image_b64}"
            
            response = client_mistral.ocr.process(
                model="mistral-ocr-latest",
                document={"type": "document_url", "document_url": image_url}
            )
            texto_extraido = "\n".join([page.markdown for page in response.pages])
            logger.info("✅ Leído con Mistral (Respaldo)")
        except Exception as e:
            logger.error(f"Error en ambos motores: {e}")
            raise HTTPException(500, "No se pudo leer la imagen. Intenta de nuevo.")

    # --- SUBIR FOTO A CLOUDINARY ---
    try:
        path = f"jarvis-joyeria/molds/{new_id()}.jpg"
        result = await asyncio.to_thread(put_object, path, data, "image/jpeg")
        
        return {
            "ok": True, 
            "texto": texto_extraido,
            "foto_url": result.get("url", ""),
            "foto_path": result.get("path", "")
        }
    except Exception as e:
        logger.error(f"Error subiendo foto: {e}")
        raise HTTPException(500, "Error al guardar la foto")

# --- 2. RUTA PARA GUARDAR EL MOLDE ---
@router.post("/molds")
async def save_mold(payload: MoldeIn, user=Depends(current_user)):
    molde = {
        "id": new_id(),
        "nombre": payload.nombre,
        "texto": payload.texto,
        "foto_url": payload.foto_url,
        "coleccion": payload.coleccion, # <-- Guardamos la colección
        "creado_por": user["name"],
        "created_at": now_iso()
    }
    await db.molds.insert_one(molde)
    molde.pop("_id", None)
    return {"ok": True, "molde": molde}

# --- 3. RUTA PARA BUSCAR MOLDES ---
@router.get("/molds")
async def get_molds(search: Optional[str] = None, coleccion: Optional[str] = None, user=Depends(current_user)):
    query = {}
    
    # Si la pantalla pide una colección específica, filtramos por ella
    if coleccion:
        query["coleccion"] = coleccion
        
    if search:
        query["$or"] = [
            {"nombre": {"$regex": search, "$options": "i"}},
            {"texto": {"$regex": search, "$options": "i"}}
        ]
    
    moldes = await db.molds.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return moldes