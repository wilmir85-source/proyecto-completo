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
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from core import db, current_user, now_iso, new_id, logger
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api")

class MoldeIn(BaseModel):
    nombre: str
    texto: str

# --- 1. LEER LA FOTO (SOLO TEXTO) ---
@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        API_KEY = os.getenv("MISTRAL_API_KEY")
        if not API_KEY:
            raise HTTPException(500, "Falta la MISTRAL_API_KEY")

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

        # Devolvemos SOLO el texto. No subimos nada a Cloudinary.
        return {"ok": True, "texto": texto_extraido}

    except Exception as e:
        logger.error(f"Error en OCR: {e}")
        raise HTTPException(500, f"Error al leer la imagen: {str(e)}")

# --- 2. GUARDAR EL MOLDE ---
@router.post("/molds")
async def save_mold(payload: MoldeIn, user=Depends(current_user)):
    molde = {
        "id": new_id(),
        "nombre": payload.nombre,
        "texto": payload.texto,
        "creado_por": user["name"],
        "created_at": now_iso()
    }
    await db.molds.insert_one(molde)
    molde.pop("_id", None)
    return {"ok": True, "molde": molde}

# --- 3. BUSCAR MOLDES ---
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

# --- 4. GENERAR PDF DEL MOLDE ---
@router.get("/molds/{molde_id}/pdf")
async def download_mold_pdf(molde_id: str, user=Depends(current_user)):
    molde = await db.molds.find_one({"id": molde_id})
    if not molde:
        raise HTTPException(404, "Molde no encontrado")

    # Crear el PDF en memoria
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []

    # Título del PDF
    title_style = ParagraphStyle(name='TitleStyle', parent=styles['Heading1'], fontSize=18, spaceAfter=20)
    elements.append(Paragraph(f"Molde: {molde.get('nombre', 'Sin Nombre')}", title_style))
    elements.append(Spacer(1, 12))

    # Texto del molde (respetando saltos de línea)
    for line in molde.get("texto", "").split("\n"):
        if line.strip():
            elements.append(Paragraph(line, styles['Normal']))
            elements.append(Spacer(1, 6))

    doc.build(elements)
    buffer.seek(0)

    return Response(content=buffer.read(), media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=Molde_{molde.get('nombre', 'archivo')}.pdf"
    })