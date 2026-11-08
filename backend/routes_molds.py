from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import os
import io
import asyncio
from google import genai
from PIL import Image
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from core import db, current_user, now_iso, new_id, logger
from dotenv import load_dotenv

load_dotenv()
router = APIRouter(prefix="/api")


class LibreriaIn(BaseModel):
    nombre: str


class MoldeIn(BaseModel):
    libreria_id: str
    numero: str
    texto: str


# 1. ESCANEAR FOTO CON GEMINI
@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        API_KEY = os.getenv("GEMINI_API_KEY")
        if not API_KEY:
            raise HTTPException(500, "GEMINI_API_KEY no está configurada en el servidor.")

        client = genai.Client(api_key=API_KEY)
        data = await file.read()

        with Image.open(io.BytesIO(data)) as imagen:
            # Convertir a RGB por si la foto viene en otro modo (RGBA, P, etc.)
            if imagen.mode != "RGB":
                imagen = imagen.convert("RGB")

            prompt = (
                "Extrae todo el texto de esta imagen escrita a mano. "
                "Respeta el formato de lista y números."
            )

            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-3.8-flash",
                contents=[prompt, imagen],
            )

        texto = (response.text or "").strip()
        return {"ok": True, "texto": texto}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error OCR: {e}")
        raise HTTPException(502, "Error al leer la imagen. Intenta de nuevo.")


# 2. CREAR UNA CARPETA (LIBRERÍA)
@router.post("/libraries")
async def create_library(payload: LibreriaIn, user=Depends(current_user)):
    lib = {
        "id": new_id(),
        "nombre": payload.nombre,
        "creado_por": user["name"],
        "created_at": now_iso(),
    }
    await db.libraries.insert_one(lib)
    lib.pop("_id", None)
    return lib


# 3. VER TODAS LAS CARPETAS
@router.get("/libraries")
async def get_libraries(user=Depends(current_user)):
    return await db.libraries.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


# 4. GUARDAR UN MOLDE EN UNA CARPETA
@router.post("/molds")
async def save_mold(payload: MoldeIn, user=Depends(current_user)):
    molde = {
        "id": new_id(),
        "libreria_id": payload.libreria_id,
        "numero": payload.numero,
        "texto": payload.texto,
        "creado_por": user["name"],
        "created_at": now_iso(),
    }
    await db.molds.insert_one(molde)
    molde.pop("_id", None)
    return molde


# 5. VER LOS MOLDES DE UNA CARPETA ESPECÍFICA
@router.get("/libraries/{libreria_id}/molds")
async def get_molds_by_library(libreria_id: str, user=Depends(current_user)):
    return await db.molds.find(
        {"libreria_id": libreria_id}, {"_id": 0}
    ).sort("numero", 1).to_list(1000)


# 6. EL BUSCADOR GLOBAL (Busca en todas las carpetas)
@router.get("/molds/search")
async def search_molds(q: str, user=Depends(current_user)):
    if not q:
        return []
    query = {
        "$or": [
            {"numero": {"$regex": q, "$options": "i"}},
            {"texto": {"$regex": q, "$options": "i"}},
        ]
    }
    resultados = await db.molds.find(query, {"_id": 0}).to_list(200)
    for r in resultados:
        lib = await db.libraries.find_one({"id": r["libreria_id"]})
        r["nombre_libreria"] = lib["nombre"] if lib else "Sin Carpeta"
    return resultados


# 7. GENERAR PDF DE UN MOLDE
@router.get("/molds/{molde_id}/pdf")
async def download_mold_pdf(molde_id: str, user=Depends(current_user)):
    molde = await db.molds.find_one({"id": molde_id})
    if not molde:
        raise HTTPException(404, "Molde no encontrado")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph(f"Molde: {molde.get('numero')}", styles["Heading1"]),
        Spacer(1, 12),
        Paragraph(f"Carpeta: {molde.get('libreria_id')}", styles["Normal"]),
        Spacer(1, 20),
    ]
    for line in molde.get("texto", "").split("\n"):
        if line.strip():
            elements.append(Paragraph(line, styles["Normal"]))
            elements.append(Spacer(1, 6))
    doc.build(elements)
    buffer.seek(0)
    return Response(
        content=buffer.read(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Molde_{molde.get('numero')}.pdf"
        },
    )