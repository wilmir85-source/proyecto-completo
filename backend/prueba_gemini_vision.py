import os
from dotenv import load_dotenv
from google import genai
from PIL import Image

# 1. Cargar la llave
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY)

# 2. Buscar cualquier imagen automáticamente en la carpeta
image_path = None
for archivo in os.listdir('.'):
    if archivo.endswith(('.jpg', '.jpeg', '.png')):
        image_path = archivo
        break

if not image_path:
    print("❌ No se encontró ninguna imagen (jpg, jpeg o png) en la carpeta backend.")
    exit()

print(f"✅ Imagen encontrada: {image_path}")
print("Enviando imagen a Gemini...")

# 3. El Prompt
prompt = """
Eres un asistente experto en joyería. Te voy a pasar una foto de una lista escrita a mano.
Tu tarea es extraer TODO el texto de la imagen.
Por favor:
1. Respeta el formato de lista.
2. Presta mucha atención a los números y medidas (ej. 8x6, talla 7, etc.).
3. Devuelve solo el texto limpio y organizado, sin explicaciones adicionales.
"""

try:
    # 4. Llamada a la IA
    imagen = Image.open(image_path)
    response = client.models.generate_content(
        model='gemini-3.8-flash',
        contents=[prompt, imagen]
    )
    
    # 5. Imprimir el resultado
    print("\n✅ ¡Texto extraído con éxito!\n")
    print("="*40)
    print(response.text)
    print("="*40)

except Exception as e:
    print(f"\n❌ Error al comunicarse con Gemini: {e}")