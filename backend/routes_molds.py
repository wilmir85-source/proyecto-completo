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

class LibreriaUpdate(BaseModel):
    nombre: str

class MoldeIn(BaseModel):
    libreria_id: str
    numero: str
    texto: str

class MoldeUpdate(BaseModel):
    numero: Optional[str] = None
    texto: Optional[str] = None


# 1. ESCANEAR FOTO CON GEMINI (OCR MEJORADO)
@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        API_KEY = os.getenv("GEMINI_API_KEY")
        if not API_KEY:
            raise HTTPException(500, "GEMINI_API_KEY no está configurada en el servidor.")

        client = genai.Client(api_key=API_KEY)
        data = await file.read()

        with Image.open(io.BytesIO(data)) as imagen:
            if imagen.mode != "RGB":
                imagen = imagen.convert("RGB")

            # PROMPT MEJORADO: Pide un listado limpio sin asteriscos
            prompt = (
                "Extrae el texto de esta imagen escrita a mano. "
                "Devuélvelo como un listado limpio utilizando guiones (-). "
                "No uses negritas, ni asteriscos, ni formatos markdown. "
                "Si hay varias columnas, organízalas de forma lineal y clara."
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


# 2. CREAR CARPETA (LIBRERÍA)
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

# 4. EDITAR UNA CARPETA (NUEVO)
@router.put("/libraries/{libreria_id}")
async def update_library(libreria_id: str, payload: LibreriaUpdate, user=Depends(current_user)):
    existing = await db.libraries.find_one({"id": libreria_id})
    if not existing:
        raise HTTPException(404, "Carpeta no encontrada")
    
    await db.libraries.update_one({"id": libreria_id}, {"$set": {"nombre": payload.nombre}})
    return {"ok": True, "nombre": payload.nombre}

# 5. BORRAR UNA CARPETA Y SUS MOLDES (NUEVO)
@router.delete("/libraries/{libreria_id}")
async def delete_library(libreria_id: str, user=Depends(current_user)):
    result = await db.libraries.delete_one({"id": libreria_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Carpeta no encontrada")
    
    # Borrar también todos los moldes que estaban dentro de esa carpeta
    await db.molds.delete_many({"libreria_id": libreria_id})
    
    return {"ok": True}

# 6. GUARDAR UN MOLDE
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

# 7. EDITAR UN MOLDE
@router.put("/molds/{molde_id}")
async def update_mold(molde_id: str, payload: MoldeUpdate, user=Depends(current_user)):
    existing = await db.molds.find_one({"id": molde_id})
    if not existing:
        raise HTTPException(404, "Molde no encontrado")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.molds.update_one({"id": molde_id}, {"$set": updates})
    molde = await db.molds.find_one({"id": molde_id}, {"_id": 0})
    return molde

# 8. BORRAR UN MOLDE
@router.delete("/molds/{molde_id}")
async def delete_mold(molde_id: str, user=Depends(current_user)):
    result = await db.molds.delete_one({"id": molde_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Molde no encontrado")
    return {"ok": True}

# 9. VER LOS MOLDES DE UNA CARPETA ESPECÍFICA
@router.get("/libraries/{libreria_id}/molds")
async def get_molds_by_library(libreria_id: str, user=Depends(current_user)):
    return await db.molds.find(
        {"libreria_id": libreria_id}, {"_id": 0}
    ).sort("numero", 1).to_list(1000)

# 10. EL BUSCADOR GLOBAL
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

# 11. GENERAR PDF DE UN MOLDE
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