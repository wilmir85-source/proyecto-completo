from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import os
import io
import asyncio
from google import genai
from google.genai import errors as genai_errors
from PIL import Image
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from core import db, current_user, now_iso, new_id, logger
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api")

class MoldeIn(BaseModel):
    titulo: str
    texto: str

# --- LISTA COMPLETA DE MODELOS GEMINI (Del más nuevo al más estable) ---
MODELOS_OCR = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash"
]

# --- 1. LEER LA FOTO (OCR CON GEMINI Y CASCADA) ---
@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        API_KEY = os.getenv("GEMINI_API_KEY")
        if not API_KEY:
            raise HTTPException(500, "Falta la GEMINI_API_KEY en las variables de entorno")

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

        # --- BUCLE DE CASCADA ---
        for modelo in MODELOS_OCR:
            logger.info(f"Intentando leer la foto con: {modelo}")
            
            # 3 intentos por modelo (con espera exponencial)
            for intento in range(3):
                try:
                    response = await asyncio.to_thread(
                        client.models.generate_content,
                        model=modelo,
                        contents=[prompt, imagen]
                    )
                    if response.text:
                        texto_extraido = response.text
                        logger.info(f"✅ ¡Éxito con {modelo} en el intento {intento + 1}!")
                        break  # Si funciona, salimos del bucle de reintentos
                        
                except genai_errors.ServerError as e:
                    # Si es error 503 (saturado), esperamos y reintentamos
                    if "503" in str(e) or "UNAVAILABLE" in str(e):
                        ultimo_error = e
                        espera = 2 ** intento # 1s, 2s, 4s
                        logger.warning(f"{modelo} saturado. Reintentando en {espera}s...")
                        await asyncio.sleep(espera)
                    else:
                        ultimo_error = e
                        break  # Si es otro error, pasamos al siguiente modelo
                
                except Exception as e:
                    ultimo_error = e
                    logger.warning(f"{modelo} falló: {e}. Probando el siguiente...")
                    break  # Si es error 404 u otro, pasamos al siguiente modelo
            
            # Si ya obtuvimos texto, no seguimos probando modelos
            if texto_extraido:
                break

        # Si ningún modelo funcionó, lanzamos el error amigable
        if not texto_extraido:
            logger.error(f"Todos los modelos de OCR fallaron. Último error: {ultimo_error}")
            raise HTTPException(503, "La IA de Google está muy ocupada. Intenta de nuevo en un minuto.")

        return {"ok": True, "texto": texto_extraido}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error general OCR: {e}")
        raise HTTPException(500, f"Error al procesar la imagen: {str(e)}")

# --- 2. GUARDAR EN LA LIBRERÍA ---
@router.post("/molds")
async def save_mold(payload: MoldeIn, user=Depends(current_user)):
    molde = {
        "id": new_id(),
        "titulo": payload.titulo,
        "texto": payload.texto,
        "creado_por": user["name"],
        "created_at": now_iso()
    }
    await db.molds.insert_one(molde)
    molde.pop("_id", None)
    return {"ok": True, "message": "Librería guardada exitosamente"}

# --- 3. BUSCADOR DE MOLDES ---
@router.get("/molds")
async def get_molds(search: Optional[str] = None, user=Depends(current_user)):
    query = {}
    if search:
        query = {
            "$or": [
                {"titulo": {"$regex": search, "$options": "i"}},
                {"texto": {"$regex": search, "$options": "i"}}
            ]
        }
    moldes = await db.molds.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return moldes

# --- 4. GENERAR PDF DE LA LIBRERÍA ---
@router.get("/molds/{molde_id}/pdf")
async def download_mold_pdf(molde_id: str, user=Depends(current_user)):
    molde = await db.molds.find_one({"id": molde_id})
    if not molde:
        raise HTTPException(404, "Documento no encontrado")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    
    elements = [
        Paragraph(f"Documento: {molde.get('titulo', 'Sin Nombre')}", styles['Heading1']),
        Spacer(1, 12),
        Paragraph(f"Guardado por: {molde.get('creado_por', 'N/A')}", styles['Normal']),
        Spacer(1, 20)
    ]
    
    for line in molde.get("texto", "").split("\n"):
        if line.strip():
            elements.append(Paragraph(line, styles['Normal']))
            elements.append(Spacer(1, 6))

    doc.build(elements)
    buffer.seek(0)

    return Response(content=buffer.read(), media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=Lib_{molde.get('titulo', 'archivo')}.pdf"
    })