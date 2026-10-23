import base64
from py_vapid import Vapid

# Generar llaves
vapid = Vapid()
vapid.generate_keys()

# Imprimir llaves en formato base64
private_key = base64.urlsafe_b64encode(vapid.private_key.private_numbers().private_value.to_bytes(32, 'big')).decode('utf-8').rstrip('=')
public_key = base64.urlsafe_b64encode(vapid.public_key.public_numbers().x.to_bytes(32, 'big')).decode('utf-8').rstrip('=')

print("=========================================")
print(f"VAPID_PRIVATE_KEY={private_key}")
print(f"VAPID_PUBLIC_KEY={public_key}")
print("=========================================")