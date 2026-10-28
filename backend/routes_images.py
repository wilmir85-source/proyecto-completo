import os
import replicate
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from core import current_user

router = APIRouter(prefix="/api")

class ImageRequest(BaseModel):
    prompt: str

@router.post("/images/generate")
async def generate_image(payload: ImageRequest, user=Depends(current_user)):
    try:
        # Limpiamos el prompt para forzar a la IA a hacer joyería y NO personas
        prompt_limpio = payload.prompt.replace("genera", "").replace("imagen", "").replace("un", "").replace("una", "").strip()
        final_prompt = f"Professional product photography of a jewelry piece: {prompt_limpio}, isolated on a dark background, high quality, 8k, no humans, no faces, no hands"
        
        # Usamos el modelo Flux Schnell (es rapidísimo y baratísimo)
        output = replicate.run(
            "black-forest-labs/flux-schnell",
            input={
                "prompt": final_prompt,
                "aspect_ratio": "1:1",
                "output_format": "webp",
                "output_quality": 90
            }
        )
        
        # Replicate devuelve una lista de URLs
        if not output or len(output) == 0:
            raise HTTPException(500, "No se pudo generar la imagen")
            
        return {"url": output[0]}
        
    except Exception as e:
        print(f"Error en Replicate: {e}")
        raise HTTPException(500, f"Error generando imagen: {str(e)}")