import requests
import json
import time

# --- CONFIGURACIÓN ---
API_KEY = "vll_514d25dae75f79abb315b73bd82ca71d58d01f0490d0e90a"  # Tu clave de Vellria (empieza con vll_...)
API_URL = "https://vellria.com/v1/generate/image"

# Elige el modelo: "vellria-qwen-3" (8 créditos) o "vellria-seedream-5-pro" (10 créditos)
MODEL_ID = "vellria-qwen-3" 
PROMPT = "A highly detailed, photorealistic portrait of Iron Man, cinematic lighting, 8k resolution"

# --- PREPARAR LA PETICIÓN ---
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "model": MODEL_ID,
    "prompt": PROMPT
}

print("Enviando solicitud a Vellria...")
try:
    # --- INICIAR LA GENERACIÓN ---
    response = requests.post(API_URL, json=payload, headers=headers)
    response.raise_for_status()
    data = response.json()
    print("✅ Solicitud aceptada. Respuesta inicial:")
    print(json.dumps(data, indent=2))

    # --- OBTENER EL ID DE LA GENERACIÓN ---
    generation_id = data.get("id")
    if not generation_id:
        print("❌ No se encontró un ID de generación. Revisa la estructura de la respuesta.")
    else:
        print(f"\n⏳ Generación iniciada con ID: {generation_id}. Esperando resultado...")
        
        # --- CONSULTAR EL ESTADO (POLLING) ---
        status_url = f"https://vellria.com/v1/generations/{generation_id}"
        
        for i in range(30):  # Intentar por 30 veces (aprox. 60 segundos)
            time.sleep(2)  # Esperar 2 segundos entre consultas
            
            status_resp = requests.get(status_url, headers=headers)
            status_data = status_resp.json()
            
            task_status = status_data.get("status")
            print(f"Intento {i+1}: Estado = {task_status}")

            if task_status == "completed":
                print("\n🎉 ¡Imagen generada con éxito!")
                image_url = status_data.get("output_url")
                if image_url:
                    print(f"🔗 URL de la imagen: {image_url}")
                else:
                    print("Respuesta final:", json.dumps(status_data, indent=2))
                break
            elif task_status == "failed":
                print("\n❌ La generación falló.")
                print(json.dumps(status_data, indent=2))
                break
        else:
            print("\n⏰ Tiempo de espera agotado. La tarea puede seguir procesándose.")

except requests.exceptions.RequestException as e:
    print(f"\n❌ Error en la solicitud: {e}")
    if e.response:
        print("Respuesta del servidor:", e.response.text)