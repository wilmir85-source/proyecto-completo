from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import os
import io
import asyncio
from google import genai
from google.genai import types
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
    texto: Optional[str] = "" # Se mantiene por compatibilidad

class MoldeUpdate(BaseModel):
    numero: Optional[str] = None
    tipo: Optional[str] = None
    carrera: Optional[str] = None
    medida: Optional[str] = None
    notas: Optional[str] = None
    texto: Optional[str] = None

# --- MODELO PARA LA IA (GEMINI) ---
class DatosMolde(BaseModel):
    tipo: str
    carrera: str
    medida: str
    numero: str
    notas: str


# 1. ESCANEAR FOTO CON GEMINI (OCR)
@router.post("/molds/scan")
async def scan_mold_image(file: UploadFile = File(...), user=Depends(current_user)):
    try:
        API_KEY = os.getenv("GEMINI_API_KEY")
        if not API_KEY:
            raise HTTPException(500, "GEMINI_API_KEY no configurada.")
        
        client = genai.Client(api_key=API_KEY)
        data = await file.read()

        with Image.open(io.BytesIO(data)) as imagen:
            if imagen.mode != "RGB":
                imagen = imagen.convert("RGB")

            prompt = (
                "Analiza la imagen del molde de joyería. Extrae los datos de manera precisa. "
                "Si algún campo no aparece, asigna una cadena vacía."
            )

            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-3.8-flash",
                contents=[prompt, imagen],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=DatosMolde,
                ),
            )
        
        return {"ok": True, "datos": response.parsed.model_dump()}
    except Exception as e:
        logger.error(f"Error OCR: {e}")
        raise HTTPException(502, "Error al leer la imagen.")


# 2. CREAR UNA CARPETA (LIBRERÍA)
@router.post("/libraries")
async def create_library(payload: LibreriaIn, user=Depends(current_user)):
    lib = {
        "id": new_id(), 
        "nombre": payload.nombre, 
        "creado_por": user["name"], 
        "created_at": now_iso()
    }
    await db.libraries.insert_one(lib)
    lib.pop("_id", None)
    return lib

# 3. VER TODAS LAS CARPETAS
@router.get("/libraries")
async def get_libraries(user=Depends(current_user)):
    return await db.libraries.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)

# 4. EDITAR UNA CARPETA
@router.put("/libraries/{libreria_id}")
async def update_library(libreria_id: str, payload: LibreriaIn, user=Depends(current_user)):
    existing = await db.libraries.find_one({"id": libreria_id})
    if not existing:
        raise HTTPException(404, "Carpeta no encontrada")
    await db.libraries.update_one({"id": libreria_id}, {"$set": {"nombre": payload.nombre}})
    return await db.libraries.find_one({"id": libreria_id}, {"_id": 0})

# 5. BORRAR UNA CARPETA
@router.delete("/libraries/{libreria_id}")
async def delete_library(libreria_id: str, user=Depends(current_user)):
    result = await db.libraries.delete_one({"id": libreria_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Carpeta no encontrada")
    await db.molds.delete_many({"libreria_id": libreria_id})
    return {"ok": True}


# 6. GUARDAR UN MOLDE
@router.post("/molds")
async def save_mold(payload: MoldeIn, user=Depends(current_user)):
    molde = payload.model_dump()
    molde["id"] = new_id()
    molde["creado_por"] = user["name"]
    molde["created_at"] = now_iso()
    
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
        
    return await db.molds.find_one({"id": molde_id}, {"_id": 0})

# 8. BORRAR UN MOLDE
@router.delete("/molds/{molde_id}")
async def delete_mold(molde_id: str, user=Depends(current_user)):
    result = await db.molds.delete_one({"id": molde_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Molde no encontrado")
    return {"ok": True}

# 9. VER LOS MOLDES DE UNA CARPETA
@router.get("/libraries/{libreria_id}/molds")
async def get_molds_by_library(libreria_id: str, user=Depends(current_user)):
    return await db.molds.find(
        {"libreria_id": libreria_id}, {"_id": 0}
    ).sort("numero", 1).to_list(1000)

# 10. BUSCADOR GLOBAL
@router.get("/molds/search")
async def search_molds(q: str, user=Depends(current_user)):
    if not q:
        return []
    query = {
        "$or": [
            {"numero": {"$regex": q, "$options": "i"}},
            {"tipo": {"$regex": q, "$options": "i"}},
            {"carrera": {"$regex": q, "$options": "i"}},
            {"medida": {"$regex": q, "$options": "i"}},
            {"notas": {"$regex": q, "$options": "i"}},
        ]
    }
    resultados = await db.molds.find(query, {"_id": 0}).to_list(200)
    for r in resultados:
        lib = await db.libraries.find_one({"id": r["libreria_id"]})
        r["nombre_libreria"] = lib["nombre"] if lib else "Sin Carpeta"
    return resultados

# 11. GENERAR PDF DE UN MOLDE (Opcional desde el backend)
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
    ]
    
    for key, val in molde.items():
        if val and key not in ["_id", "id", "libreria_id", "creado_por", "created_at", "texto"]:
            elements.append(Paragraph(f"<b>{key.capitalize()}:</b> {val}", styles["Normal"]))
            elements.append(Spacer(1, 6))
            
    doc.build(elements)
    buffer.seek(0)
    return Response(
        content=buffer.read(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Molde_{molde.get('numero')}.pdf"},
    )