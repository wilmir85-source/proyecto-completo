from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import os
import asyncio
from google import genai
from PIL import Image
import io
from core import db, current_user, now_iso, new_id, put_object, logger
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api")

class MoldeIn(BaseModel):
    nombre: str
    texto: str
    foto_url: str

# --- 1. RUTA PARA LEER LA FOTO (OCR) ---
@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        API_KEY = os.getenv("GEMINI_API_KEY")
        if not API_KEY:
            raise HTTPException(500, "No se encontró la GEMINI_API_KEY en las variables de entorno")

        client = genai.Client(api_key=API_KEY)

        data = await file.read()
        imagen = Image.open(io.BytesIO(data))

        prompt = """
        Eres un asistente experto en joyería. Te voy a pasar una foto de una lista escrita a mano.
        Tu tarea es extraer TODO el texto de la imagen.
        Por favor:
        1. Respeta el formato de lista.
        2. Presta mucha atención a los números y medidas (ej. 8x6, talla 7, etc.).
        3. Devuelve solo el texto limpio y organizado, sin explicaciones adicionales.
        """
        
        # --- TRY INTERNO PARA ATRAPAR LA SATURACIÓN DE GOOGLE ---
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model='gemini-3.8-flash',
                contents=[prompt, imagen]
            )
            texto_extraido = response.text
            
        except Exception as e:
            # Si Google está saturado, lanzamos un error 503 amigable
            if "503" in str(e) or "UNAVAILABLE" in str(e) or "high demand" in str(e):
                logger.warning(f"Gemini saturado: {e}")
                raise HTTPException(503, "La IA de Google está muy ocupada en este momento. Por favor, intenta de nuevo en un minuto.")
            
            # Si es otro error distinto, lo mostramos
            logger.error(f"Error en Gemini: {e}")
            raise HTTPException(500, f"Error al leer la imagen: {str(e)}")

        # Subir la foto original a Cloudinary
        path = f"jarvis-joyeria/molds/{new_id()}.jpg"
        result = await asyncio.to_thread(put_object, path, data, "image/jpeg")

        return {
            "ok": True, 
            "texto": texto_extraido,
            "foto_url": result.get("url", ""),
            "foto_path": result.get("path", "")
        }

    except HTTPException:
        # Esto es importante para que los errores HTTP pasen directo a la pantalla
        raise
    except Exception as e:
        logger.error(f"Error general en OCR: {e}")
        raise HTTPException(500, f"Error al procesar la imagen: {str(e)}")


# --- 2. RUTA PARA GUARDAR EL MOLDE ---
@router.post("/molds")
async def save_mold(payload: MoldeIn, user=Depends(current_user)):
    molde = {
        "id": new_id(),
        "nombre": payload.nombre,
        "texto": payload.texto,
        "foto_url": payload.foto_url,
        "creado_por": user["name"],
        "created_at": now_iso()
    }
    await db.molds.insert_one(molde)
    molde.pop("_id", None)
    return {"ok": True, "molde": molde}

# --- 3. RUTA PARA BUSCAR MOLDES ---
@router.get("/molds")
async def get_molds(search: Optional[str] = None, user=Depends(current_user)):
    query = {}
    if search:
        query = {
            "$or": [
                {"nombre": {"$regex": search, "$options": "i"}},
                {"texto": {"$regex": search, "$options": "i"}}
            ]
        }
    
    moldes = await db.molds.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return moldes