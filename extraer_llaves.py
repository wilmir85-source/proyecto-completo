import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

try:
    # Leer la llave privada
    with open("private_key.pem", "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None, backend=default_backend())

    # Leer la llave pública
    with open("public_key.pem", "rb") as f:
        public_key = serialization.load_pem_public_key(f.read(), backend=default_backend())

    # Convertir la pública al formato que necesita el navegador (base64url, sin padding)
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint
    )
    public_b64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')

    # Convertir la privada al formato que necesita Render
    private_bytes = private_key.private_numbers().private_value.to_bytes(32, 'big')
    private_b64 = base64.urlsafe_b64encode(private_bytes).decode('utf-8').rstrip('=')

    print("\n=========================================")
    print(f"VAPID_PUBLIC_KEY={public_b64}")
    print(f"VAPID_PRIVATE_KEY={private_b64}")
    print("=========================================\n")

except FileNotFoundError:
    print("Error: No se encontraron los archivos private_key.pem o public_key.pem. Ejecuta primero 'vapid --gen'.")
except Exception as e:
    print(f"Error: {e}")