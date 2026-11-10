import os
import google.generativeai as genai
from fastapi import APIRouter, File, UploadFile, HTTPException
from PIL import Image
import io
import json

# Usamos el prefijo /api para que coincida perfectamente con tus peticiones
router = APIRouter(prefix="/api")

# Configura tu API key de Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Modelos actualizados y compatibles con la API actual de Google
GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-1.5-flash"
]

@router.post("/molds/scan")
async def scan_mold(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))
        
        prompt = (
            "Analiza esta imagen de un cuaderno o nota manuscrita de joyería. "
            "Extrae la información estructurada en un objeto JSON válido con exactamente estas llaves: "
            "\"numero\" (el código o número del molde, ej. MG05), "
            "\"tipo\" (ej. Anillo, Dije, Plancha), "
            "\"carrera\" (el texto de la carrera o diseño, ej. Perito Contador), "
            "\"medida\" (ej. 10x8, 13x13 mm), y "
            "\"notas\" (detalles extra como piedras o acabados). "
            "Si algún campo no está presente, déjalo como cadena vacía."
        )

        response_text = None
        last_error = None

        # Bucle de respaldo automático entre modelos
        for model_name in GEMINI_MODELS:
            try:
                print(f"Intentando escaneo OCR con el modelo: {model_name}")
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


@router.get("/libraries")
async def get_libraries():
    # Devuelve las carpetas principales para tu catálogo
    return [
        {"id": "1", "nombre": "Anillos de Graduación"},
        {"id": "2", "nombre": "Ovales y Octagonales"},
        {"id": "3", "nombre": "Dijes y Planchas"}
    ]


@router.get("/libraries/{library_id}/molds")
async def get_molds_by_library(library_id: str):
    # Resuelve el error 404 devolviendo la lista de moldes para esa librería
    return [
        {
            "id": "mold_1",
            "numero": "MG01",
            "tipo": "Anillo",
            "carrera": "Perito Contador",
            "medida": "12x10 mm",
            "notas": "Modelo base con grecas"
        }
    ]