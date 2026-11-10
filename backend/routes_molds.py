import os
import google.generativeai as genai
from fastapi import APIRouter, File, UploadFile, HTTPException
from PIL import Image
import io
import json

router = APIRouter()

# Configura tu API key de Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Lista de modelos oficiales actualizados (sistema de respaldo ante caídas 503)
GEMINI_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-pro"
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

        # Bucle de respaldo automático (Fallback ante saturación 503)
        for model_name in GEMINI_MODELS:
            try:
                print(f"Intentando escaneo OCR con el modelo: {model_name}")
                model = genai.GenerativeModel(
                    model_name=model_name,
                    # Forzamos a que la IA devuelva JSON nativo y limpio
                    generation_config={"response_mime_type": "application/json"}
                )
                response = model.generate_content([prompt, image])
                response_text = response.text
                if response_text:
                    break # Éxito, salimos del ciclo
            except Exception as model_err:
                last_error = str(model_err)
                print(f"Modelo {model_name} falló o está saturado: {last_error}")
                continue

        if not response_text:
            raise HTTPException(
                status_code=503, 
                detail=f"Los servidores de IA están saturados temporalmente. Detalle: {last_error}"
            )

        # Limpieza de seguridad por si acaso
        clean_json = response_text.replace("```json", "").replace("```", "").strip()
        parsed_data = json.loads(clean_json)

        return {"success": True, "datos": parsed_data}

    except Exception as e:
        print(f"Error crítico en /molds/scan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al procesar la imagen: {str(e)}")
    @router.get("/libraries")
async def get_libraries():
    # Devuelve las carpetas para que la app cargue tus colecciones de moldes sin error
    return [
        {"id": "1", "nombre": "Anillos de Graduación"},
        {"id": "2", "nombre": "Ovales y Octagonales"},
        {"id": "3", "nombre": "Dijes y Planchas"}
    ]