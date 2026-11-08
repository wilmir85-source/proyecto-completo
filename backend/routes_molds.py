from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import os
import io
import base64
import requests
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

# --- 1. LEER LA FOTO (OCR CON Z.AI GRATIS) ---
@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        API_KEY = os.getenv("ZAI_API_KEY")
        if not API_KEY:
            raise HTTPException(500, "Falta la ZAI_API_KEY en las variables de entorno")

        # Leer imagen y convertir a base64
        data = await file.read()
        image_b64 = base64.b64encode(data).decode("utf-8")
        
        # Endpoint oficial de Z.ai (compatible con OpenAI)
        url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "glm-4v-flash", # Modelo de visión gratuito
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text", 
                            "text": "Por favor, extrae todo el texto de esta imagen escrita a mano. Respeta el formato de lista y presta atención a los números."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_b64}"
                            }
                        }
                    ]
                }
            ]
        }

        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        result = response.json()

        # Extraer el texto de la respuesta
        texto_extraido = result["choices"][0]["message"]["content"]

        return {"ok": True, "texto": texto_extraido}

    except Exception as e:
        logger.error(f"Error en Z.ai OCR: {e}")
        raise HTTPException(500, f"Error al leer la imagen: {str(e)}")

# --- 2. GUARDAR EL DOCUMENTO ---
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
    return {"ok": True, "message": "Documento guardado exitosamente"}

# --- 3. BUSCAR EN LOS DOCUMENTOS ---
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

# --- 4. GENERAR PDF ---
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
        "Content-Disposition": f"attachment; filename=Documento_{molde.get('titulo', 'archivo')}.pdf"
    })