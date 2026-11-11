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
from openai import OpenAI
from groq import Groq
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
OPENAI_KEY = os.getenv("OPENAI_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")

client_gemini = genai.Client(api_key=GEMINI_KEY) if GEMINI_KEY else None
client_openai = OpenAI(api_key=OPENAI_KEY) if OPENAI_KEY else None
client_groq = Groq(api_key=GROQ_KEY) if GROQ_KEY else None

PROMPT = (
    "Analiza la imagen del molde de joyería. Extrae los datos de manera precisa. "
    "Si algún campo no aparece, asigna una cadena vacía."
)

# --- FUNCIONES DE EXTRACCIÓN POR PROVEEDOR ---

async def extraer_con_gemini(imagen):
    """Intenta con Gemini."""
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

async def extraer_con_openai(imagen):
    """Intenta con OpenAI (GPT-4o-mini)."""
    if not client_openai:
        raise Exception("OpenAI no configurado")
    
    # Convertir imagen PIL a base64
    buffered = io.BytesIO()
    imagen.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    img_url = f"data:image/jpeg;base64,{img_str}"

    response = await asyncio.to_thread(
        client_openai.beta.chat.completions.parse,
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": img_url}},
                ],
            }
        ],
        response_format=DatosMolde,
        temperature=0,
    )
    return response.choices[0].message.parsed.model_dump()

async def extraer_con_groq(imagen):
    """Intenta con Groq (Llama 4 Scout)."""
    if not client_groq:
        raise Exception("Groq no configurado")
    
    # Convertir imagen PIL a base64
    buffered = io.BytesIO()
    imagen.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    img_url = f"data:image/jpeg;base64,{img_str}"

    response = await asyncio.to_thread(
        client_groq.chat.completions.create,
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT + " Devuelve SOLO un objeto JSON válido."},
                    {"type": "image_url", "image_url": {"url": img_url}},
                ],
            }
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    # Groq devuelve string JSON, lo validamos con Pydantic
    import json
    data = json.loads(response.choices[0].message.content)
    return DatosMolde(**data).model_dump()


# --- FUNCIÓN PRINCIPAL CON FALLBACK ---
async def extraer_datos_molde(imagen, max_retries=2):
    """
    Intenta extraer datos usando una cadena de respaldo.
    Orden: Gemini -> OpenAI -> Groq
    """
    proveedores = [
        ("Gemini", extraer_con_gemini),
        ("OpenAI", extraer_con_openai),
        ("Groq", extraer_con_groq),
    ]

    for nombre, funcion in proveedores:
        for intento in range(max_retries):
            try:
                logger.info(f"Intentando OCR con {nombre} (intento {intento+1}/{max_retries})...")
                resultado = await funcion(imagen)
                logger.info(f"OCR exitoso con {nombre}")
                return resultado
            except Exception as e:
                error_str = str(e)
                # Solo reintentar si es error de saturación (503) o límite (429)
                if "503" in error_str or "429" in error_str:
                    if intento < max_retries - 1:
                        wait_time = (2 ** intento) + random.uniform(0, 1)
                        logger.warning(f"{nombre} ocupado. Reintentando en {wait_time:.1f}s...")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.warning(f"{nombre} falló definitivamente. Pasando al siguiente proveedor...")
                else:
                    # Si es otro error (ej. clave inválida), no reintentar, pasar al siguiente
                    logger.error(f"Error no reintentable en {nombre}: {e}")
                    break

    # Si todos fallaron
    raise HTTPException(503, "El servicio de lectura está saturado. Intenta de nuevo en unos minutos.")


# --- ENDPOINTS ---

# 1. ESCANEAR FOTO CON FALLBACK
@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        data = await file.read()
        with Image.open(io.BytesIO(data)) as imagen:
            if imagen.mode != "RGB":
                imagen = imagen.convert("RGB")
            
            datos = await extraer_datos_molde(imagen)
            return {"ok": True, "datos": datos}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error OCR final: {e}")
        raise HTTPException(502, "Error al procesar la imagen. Intenta de nuevo.")

# ... (el resto de tus endpoints: libraries, molds, search, pdf se mantienen igual)