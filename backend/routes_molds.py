from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import os
import asyncio
import io
import base64
from mistralai.client import Mistral
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from core import db, current_user, now_iso, new_id, logger
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api")

# El modelo recibe el nombre de la hoja/libreta y el texto completo
class MoldeIn(BaseModel):
    nombre_hoja: str
    texto_completo: str

# --- 1. LEER LA FOTO (OCR CON MISTRAL) ---
@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        API_KEY = os.getenv("MISTRAL_API_KEY")
        if not API_KEY:
            raise HTTPException(500, "Falta la MISTRAL_API_KEY en las variables de entorno")

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

        return {"ok": True, "texto": texto_extraido}

    except Exception as e:
        logger.error(f"Error en OCR: {e}")
        raise HTTPException(500, f"Error al leer la imagen: {str(e)}")

# --- 2. GUARDAR LA LIBRERÍA COMPLETA ---
@router.post("/molds")
async def save_mold(payload: MoldeIn, user=Depends(current_user)):
    molde = {
        "id": new_id(),
        "nombre_hoja": payload.nombre_hoja,
        "texto_completo": payload.texto_completo,
        "creado_por": user["name"],
        "created_at": now_iso()
    }
    await db.molds.insert_one(molde)
    molde.pop("_id", None)
    return {"ok": True, "message": "Librería guardada exitosamente"}

# --- 3. BUSCAR DENTRO DE LAS LIBRERÍAS ---
@router.get("/molds")
async def get_molds(search: Optional[str] = None, user=Depends(current_user)):
    query = {}
    if search:
        # Busca la palabra en el nombre de la hoja O en cualquier parte del texto
        query = {
            "$or": [
                {"nombre_hoja": {"$regex": search, "$options": "i"}},
                {"texto_completo": {"$regex": search, "$options": "i"}}
            ]
        }
    
    moldes = await db.molds.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return moldes

# --- 4. GENERAR PDF DE LA LIBRERÍA COMPLETA ---
@router.get("/molds/{molde_id}/pdf")
async def download_mold_pdf(molde_id: str, user=Depends(current_user)):
    molde = await db.molds.find_one({"id": molde_id})
    if not molde:
        raise HTTPException(404, "Librería no encontrada")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    
    elements = [
        Paragraph(f"Librería: {molde.get('nombre_hoja', 'Sin Nombre')}", styles['Heading1']),
        Spacer(1, 12),
        Paragraph(f"Guardado por: {molde.get('creado_por', 'N/A')}", styles['Normal']),
        Spacer(1, 20)
    ]
    
    # Agregar todo el texto de la hoja respetando los saltos de línea
    for line in molde.get("texto_completo", "").split("\n"):
        if line.strip():
            elements.append(Paragraph(line, styles['Normal']))
            elements.append(Spacer(1, 6))

    doc.build(elements)
    buffer.seek(0)

    return Response(content=buffer.read(), media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=Libreria_{molde.get('nombre_hoja', 'archivo')}.pdf"
    })