import requests
import time

API_URL = "https://aihorde.net/api/v2/generate/async"

# Un prompt mucho más directo y enfocado en joyería
prompt = "Macro product photography of a luxury gold class ring, Iron Man theme, glowing blue arc reactor as center stone, intricate red and gold helmet engraving, highly detailed, 8k resolution, studio lighting."

headers = {
    "Content-Type": "application/json",
    "apikey": "jxlUnE_MY4wm4DpOp9qjEw"  # Clave anónima
}

payload = {
    "prompt": prompt,
    "params": {
        "width": 1024,       # Más resolución para ver los detalles
        "height": 1024,
        "steps": 25,
        "sampler_name": "k_euler_a",
        "cfg_scale": 7.5,
    },
    "nsfw": False,
    "censor_nsfw": False,
    # AQUÍ ESTÁ EL TRUCO: Le pedimos que use Flux o SDXL
    "models": ["Flux.1-Schnell fp8 (Compact)", "AlbedoBase XL (SDXL)", "stable_diffusion"], 
    "r2": True, 
}

print("Enviando solicitud a AI Horde (usando modelos avanzados)...")
response = requests.post(API_URL, json=payload, headers=headers)

if response.status_code == 202:
    data = response.json()
    job_id = data.get("id")
    print(f"✅ Solicitud aceptada. ID: {job_id}")
    print("Esperando a que un voluntario procese la imagen (esto puede tardar unos minutos)...")

    check_url = f"https://aihorde.net/api/v2/generate/check/{job_id}"
    for i in range(120):  # Esperar hasta 4 minutos (los modelos buenos tardan más)
        time.sleep(2)
        status_resp = requests.get(check_url)
        status_data = status_resp.json()
        
        if status_data.get("done"):
            print("🎉 ¡Imagen generada!")
            result_url = f"https://aihorde.net/api/v2/generate/status/{job_id}"
            result_resp = requests.get(result_url)
            result_data = result_resp.json()
            image_url = result_data["generations"][0]["img"]
            print(f"🔗 URL de la imagen: {image_url}")
            break
        else:
            print(f"Intento {i+1}: Esperando... (Posición en cola: {status_data.get('queue_position', 'N/A')})")
    else:
        print("⏰ Tiempo de espera agotado. La imagen puede seguir procesándose.")
else:
    print(f"❌ Error: {response.status_code}")
    print(response.text)