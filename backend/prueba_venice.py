import requests, base64

API_KEY = "VENICE_INFERENCE_KEY_fuDpvaeLbvb0UJocbV_eyu7PE1jI0UMZn5FfHqrKNh"
url = "https://api.venice.ai/api/v1/image/generate"
headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
payload = {
    "model": "venice-sd35",  # o "qwen-image-2-1-turbo" para más barato
    "prompt": "Voy con un diseño de anillo de graduación temático de Iron Man: sello tipo 'class ring', con el reactor de arco como piedra central y el casco como grabado.",
    "width": 1024,
    "height": 1024,
    "format": "webp"
}
response = requests.post(url, json=payload, headers=headers)
data = response.json()

if "images" in data:
    img_bytes = base64.b64decode(data["images"][0])
    with open("anillo_ironman.webp", "wb") as f:
        f.write(img_bytes)
    print("✅ Imagen guardada como anillo_ironman.webp")
else:
    print("❌ Error:", data)