import requests, json, uuid

API_KEY = "LrCxnmtUEZrGGANv6TV9m35o3OWAHIaS"  # <-- Reemplaza con tu clave de Runware
MODEL_ID = "runware:400@3"  # FLUX.2 [klein] 9B Base, ~$0.004 por imagen
URL = "https://api.runware.ai/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

prompt = "Voy con un diseño de anillo de graduación temático de Iron Man: sello tipo 'class ring', con el reactor de arco como piedra central y el casco como grabado."

# Generamos un UUID v4 válido para esta tarea
task_uuid = str(uuid.uuid4())

payload = [{
    "taskType": "imageInference",
    "taskUUID": task_uuid,
    "model": MODEL_ID,
    "positivePrompt": prompt,
    "width": 1024,
    "height": 1024,
    "numberResults": 1,
    "outputType": "URL",
    "outputFormat": "JPG",
    "deliveryMethod": "sync"  # Aseguramos que la respuesta sea inmediata
}]

print("Enviando solicitud a Runware...")
try:
    response = requests.post(URL, json=payload, headers=headers)
    response.raise_for_status()
    data = response.json()
    
    if "data" in data and len(data["data"]) > 0:
        image_url = data["data"][0].get("imageURL")
        if image_url:
            print(f"🎉 ¡Imagen generada! URL: {image_url}")
        else:
            print("❌ No se encontró la URL de la imagen. Respuesta completa:")
            print(json.dumps(data, indent=2))
    else:
        print("❌ Respuesta inesperada:", json.dumps(data, indent=2))
        
except requests.exceptions.RequestException as e:
    print(f"❌ Error en la solicitud: {e}")
    if e.response:
        print("Respuesta del servidor:", e.response.text)