from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import os
import asyncio
import time
from google import genai
from google.genai import errors as genai_errors # <-- Importante para capturar el 503
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

# --- LISTA DE MODELOS VÁLIDOS (Se eliminó 1.5 porque ya no existe) ---
MODELOS_OCR = [
    "gemini-3.8-flash",
    "gemini-3.6-flash", # Versión estable
    "gemini-2.5-flash",
]

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
        
        texto_extraido = None
        ultimo_error = None

        # --- CASCADA DE MODELOS CON REINTENTOS Y ESPERA ---
        for modelo in MODELOS_OCR:
            logger.info(f"Intentando leer la foto con el modelo: {modelo}")
            
            # Intentamos hasta 3 veces por modelo (con espera exponencial)
            for intento in range(3):
                try:
                    response = await asyncio.to_thread(
                        client.models.generate_content,
                        model=modelo,
                        contents=[prompt, imagen]
                    )
                    if response.text:
                        texto_extraido = response.text
                        logger.info(f"✅ Éxito con el modelo: {modelo} (Intento {intento + 1})")
                        break # Si funciona, salimos del bucle de reintentos
                        
                except genai_errors.ServerError as e:
                    # Si es un error 503 (Servidor ocupado), esperamos y reintentamos
                    if "503" in str(e) or "UNAVAILABLE" in str(e):
                        ultimo_error = e
                        espera = 2 ** intento # Espera 1s, luego 2s, luego 4s
                        logger.warning(f"El modelo {modelo} está saturado. Reintentando en {espera} segundos...")
                        await asyncio.sleep(espera)
                    else:
                        # Si es otro tipo de error de servidor, pasamos al siguiente modelo
                        ultimo_error = e
                        break 
                        
                except Exception as e:
                    # Si es un error 404 (modelo no encontrado) u otro, pasamos al siguiente modelo
                    ultimo_error = e
                    logger.warning(f"El modelo {modelo} falló: {e}. Probando el siguiente...")
                    break
            
            # Si ya obtuvimos texto, no seguimos probando modelos
            if texto_extraido:
                break

        # Si ningún modelo funcionó, lanzamos el error amigable
        if not texto_extraido:
            logger.error(f"Todos los modelos de OCR fallaron. Último error: {ultimo_error}")
            raise HTTPException(503, "La IA de Google está muy ocupada en este momento. Por favor, intenta de nuevo en un minuto.")

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