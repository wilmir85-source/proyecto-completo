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
        
        prompt = (
            "Analiza esta imagen de un cuaderno o nota manuscrita de joyería. "
            "Extrae la información estructurada en un objeto JSON válido con exactamente estas llaves: "
            "\"numero\" (el código o número del molde escrito a mano), "
            "\"tipo\" (el tipo de joya, ej. Anillo, Dije, Plancha), "
            "\"carrera\" (el texto de la carrera, motivo de graduación o diseño), "
            "\"medida\" (las dimensiones escritas), y "
            "\"notas\" (cualquier detalle o acabado extra). "
            "Si algún campo no está presente, déjalo como cadena vacía. "
            "Devuelve ÚNICAMENTE el JSON limpio sin bloques de código markdown adicionales."
        )

        response_text = None
        last_error = None

        # Buscamos automáticamente un modelo compatible con generación de contenido en tu cuenta
        available_models = []
        try:
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    if 'flash' in m.name or 'pro' in m.name:
                        available_models.append(m.name)
        except Exception as list_err:
            print(f"No se pudo listar automáticamente: {list_err}")

        # Lista de respaldo por si la auto-detección falla
        if not available_models:
            available_models = ["models/gemini-1.5-flash", "models/gemini-1.5-pro"]

        # Probamos los modelos disponibles de forma automática
        for model_path in available_models:
            try:
                model_name = model_path.replace("models/", "")
                print(f"Probando modelo compatible: {model_name}")
                model = genai.GenerativeModel(
                    model_name=model_name,
                    generation_config={"response_mime_type": "application/json"}
                )
                response = model.generate_content([prompt, image])
                response_text = response.text
                if response_text:
                    break
            except Exception as model_err:
                last_error = str(model_err)
                print(f"Modelo {model_name} falló: {last_error}")
                continue

        if not response_text:
            raise HTTPException(
                status_code=503, 
                detail=f"No se pudo procesar con IA. Detalle: {last_error}"
            )

        clean_json = response_text.replace("```json", "").replace("```", "").strip()
        parsed_data = json.loads(clean_json)

        return {"success": True, "datos": parsed_data}

    except Exception as e:
        print(f"Error crítico en /molds/scan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al procesar la imagen: {str(e)}")


# ---------------------------------------------------------
# GESTIÓN DE CARPETAS / LIBRERÍAS (Tú las creas y organizas)
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
# GESTIÓN DE MOLDES DENTRO DE TUS CARPETAS
# ---------------------------------------------------------

@router.get("/libraries/{library_id}/molds")
async def get_molds_by_library(library_id: str):
    molds = await db.molds.find({"library_id": library_id}, {"_id": 0}).to_list(500)
    return molds


@router.post("/libraries/{library_id}/molds")
async def save_mold(library_id: str, data: dict):
    data["library_id"] = library_id
    await db.molds.insert_one(data)
    return {"success": True, "message": "Molde guardado correctamente"}