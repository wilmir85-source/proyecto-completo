import os
import google.generativeai as genai
from fastapi import APIRouter, File, UploadFile, HTTPException
from PIL import Image
import io
import json
from core import db

# Usamos el prefijo /api para que coincida perfectamente con tus peticiones
router = APIRouter(prefix="/api")

# Configura tu API key de Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

@router.post("/molds/scan")
async def scan_mold(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))
        
        # Redimensionar para optimizar y evitar tiempos de espera
        image.thumbnail((1600, 1600))
        
        prompt = (
            "Analiza esta imagen de un cuaderno o nota manuscrita de joyería. "
            "Extrae la información en un objeto JSON válido con exactamente estas llaves: "
            "\"numero\" (el código del molde, ej. 45, MG05), "
            "\"tipo\" (ej. Anillo, Dije, Plancha), "
            "\"carrera\" (el texto de la carrera o diseño), "
            "\"medida\" (las dimensiones, ej. 10x8 mm), y "
            "\"notas\" (detalles extra). "
            "Si algún campo no está presente, déjalo como cadena vacía. "
            "Devuelve ÚNICAMENTE el JSON limpio sin bloques de código markdown adicionales."
        )

        print("Iniciando escaneo OCR con gemini-1.5-flash...")
        
        # Instanciamos el modelo clásico de forma segura
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        response = model.generate_content([prompt, image])
        response_text = response.text

        if not response_text:
            raise HTTPException(status_code=503, detail="La IA no devolvió respuesta.")

        clean_json = response_text.replace("```json", "").replace("```", "").strip()
        parsed_data = json.loads(clean_json)

        return {"success": True, "datos": parsed_data}

    except Exception as e:
        print(f"Error crítico en /molds/scan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al procesar la imagen: {str(e)}")


# ---------------------------------------------------------
# GESTIÓN DE CARPETAS / LIBRERÍAS
# ---------------------------------------------------------

@router.get("/libraries")
async def get_libraries():
    libraries = await db.libraries.find({}, {"_id": 0}).to_list(100)
    return libraries


@router.post("/libraries")
async def create_library(data: dict):
    await db.libraries.insert_one(data)
    return {"success": True, "message": "Carpeta creada exitosamente"}


@router.delete("/libraries/{library_id}")
async def delete_library(library_id: str):
    await db.libraries.delete_one({"id": library_id})
    return {"success": True, "message": "Carpeta eliminada"}


# ---------------------------------------------------------
# GESTIÓN DE MOLDES
# ---------------------------------------------------------

@router.get("/libraries/{library_id}/molds")
async def get_molds_by_library(library_id: str):
    molds = await db.molds.find({"library_id": library_id}, {"_id": 0}).to_list(500)
    return molds


@router.post("/molds")
async def create_mold(data: dict):
    await db.molds.insert_one(data)
    return {"success": True, "message": "Molde guardado correctamente"}


@router.put("/molds/{mold_id}")
async def update_mold(mold_id: str, data: dict):
    await db.molds.update_one({"id": mold_id}, {"$set": data})
    return {"success": True, "message": "Molde actualizado"}


@router.delete("/molds/{mold_id}")
async def delete_mold(mold_id: str):
    await db.molds.delete_one({"id": mold_id})
    return {"success": True, "message": "Molde borrado"}