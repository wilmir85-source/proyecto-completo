import asyncio
from runware import Runware

async def main():
    # Usamos el modelo runware:101@1, que es el estándar de los ejemplos oficiales
    async with Runware(api_key="LrCxnmtUEZrGGANv6TV9m35o3OWAHIaS", transport="rest") as client:
        try:
            images = await client.run({
                "taskType": "imageInference",
                "model": "runware:101@1",
                "positivePrompt": "Voy con un diseño de anillo de graduación temático de Iron Man: sello tipo 'class ring', con el reactor de arco como piedra central y el casco como grabado.",
                "width": 1024,
                "height": 1024,
                "deliveryMethod": "sync",
            })
            
            if images and "imageURL" in images[0]:
                print(f"🎉 ¡Imagen generada! URL: {images[0]['imageURL']}")
            else:
                print("❌ Respuesta inesperada:", images)
                
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())