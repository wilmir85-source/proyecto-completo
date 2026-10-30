from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import requests
import bcrypt
import jwt as pyjwt
import cloudinary
import cloudinary.uploader
import cloudinary.api
from datetime import datetime, timezone, timedelta
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger("jarvis")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "dummy_key_para_que_arranque")
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
JWT_EXP_HOURS = 24 * 7

# 1. AGREGAMOS "Entregado" AL FINAL DE LAS ETAPAS
STAGES = ["Ventas", "Diseño 3D", "Ceras", "Inyección", "Vulcanizado", "Casting",
          "Fabricación", "Grabado Láser", "Reparaciones", "Importación de máquinas", "Terminado", "Entregado"]
          
ORDER_TYPES = ["Diseño", "Fabricación", "Reparación", "Grabado", "Importación de máquinas", "Otro"]
LEGACY_STAGES = {"3D": "Diseño 3D", "Láser": "Grabado Láser"}
ROLES = ["admin", "ventas", "trabajador"]
STAFF_ROLES = ("admin", "ventas")
DUE_SOON_HOURS = 48

# ---------- Configuración de Cloudinary ----------
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

APP_NAME = "jarvis-joyeria"
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg", 
    "image/jpg": "jpg",
    "image/png": "png", 
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif"
}
MAX_PHOTO_BYTES = 25 * 1024 * 1024


def shrink_image(data: bytes, max_px: int, quality: int) -> bytes:
    import io
    from PIL import Image, ImageOps
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
    if im.mode not in ("RGB", "L"):
        bg = Image.new("RGB", im.size, "white")
        bg.paste(im, mask=im.convert("RGBA").split()[-1])
        im = bg
    im.thumbnail((max_px, max_px))
    out = io.BytesIO()
    im.convert("RGB").save(out, "JPEG", quality=quality, optimize=True)
    return out.getvalue()


# ---------- Storage (Cloudinary) ----------
def init_storage(force: bool = False):
    return "cloudinary_ready"


def put_object(path: str, data: bytes, content_type: str) -> dict:
    try:
        public_id = path.rsplit('.', 1)[0] if '.' in path else path
        result = cloudinary.uploader.upload(
            data, 
            public_id=public_id,
            resource_type="auto",
            use_filename=True,
            unique_filename=False
        )
        return {"url": result["secure_url"], "path": path}
    except Exception as e:
        print(f"Error subiendo a Cloudinary: {e}")
        raise HTTPException(500, "Error al guardar la foto")


def get_object(path: str):
    try:
        public_id = path.rsplit('.', 1)[0] if '.' in path else path
        res = cloudinary.api.resource(public_id)
        img_data = requests.get(res["secure_url"]).content
        return img_data, "image/jpeg"
    except Exception as e:
        logger.error(f"Error obteniendo foto de Cloudinary: {e}")
        raise HTTPException(404, "Foto no encontrada")


# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def parse_dt(value):
    if not value:
        return None
    try:
        d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def check_stage(stage):
    if stage is not None and stage not in STAGES:
        raise HTTPException(400, f"Etapa inválida. Opciones: {', '.join(STAGES)}")


def check_tipo(tipo):
    if tipo is not None and tipo not in ORDER_TYPES:
        raise HTTPException(400, f"Tipo inválido. Opciones: {', '.join(ORDER_TYPES)}")


def due_status(order) -> str:
    # 2. TANTO "Terminado" COMO "Entregado" YA NO CUENTAN COMO ATRASADOS
    if order.get("stage") in ["Terminado", "Entregado"]:
        return "terminado"
    d = parse_dt(order.get("fecha_entrega"))
    if not d:
        return "sin_fecha"
    now = datetime.now(timezone.utc)
    if d < now:
        return "atrasado"
    if d - now <= timedelta(hours=DUE_SOON_HOURS):
        return "por_vencer"
    return "a_tiempo"


def enrich_order(o: dict) -> dict:
    total = float(o.get("precio") or 0)
    abonado = round(sum(float(a.get("monto") or 0) for a in o.get("abonos") or []), 2)
    saldo = round(max(total - abonado, 0), 2)
    o["abonado"] = abonado
    o["saldo"] = saldo
    o["estado_pago"] = "sin_precio" if total <= 0 else ("pagado" if saldo <= 0 else "debe")
    o["estado_entrega"] = due_status(o)
    o.setdefault("fotos", [])
    o.setdefault("abonos", [])
    o.setdefault("historial", [])
    o.setdefault("progreso", 0)
    return o


def is_staff(user) -> bool:
    return user.get("role") in STAFF_ROLES


def can_work_on(user, order) -> bool:
    if is_staff(user):
        return True
    if order.get("asignado_a") == user["id"]:
        return True
    depto_usuario = user.get("departamento")
    if not depto_usuario:
        return False
    if isinstance(depto_usuario, list):
        return order.get("stage") in depto_usuario
    return order.get("stage") == depto_usuario


def public_user(u: dict) -> dict:
    return {k: u.get(k) for k in ("id", "email", "name", "role", "departamento", "telefono", "activo")}


# ---------- Auth ----------
security = HTTPBearer()


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))


def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS)}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> str:
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])["sub"]
    except Exception:
        raise HTTPException(401, "Token inválido")


async def current_user(cred: HTTPAuthorizationCredentials = Depends(security)):
    user = await db.users.find_one({"id": decode_token(cred.credentials)}, {"_id": 0, "password": 0})
    if not user or user.get("activo") is False:
        raise HTTPException(401, "Usuario no encontrado o inactivo")
    return user


def require_roles(*roles):
    async def dep(user=Depends(current_user)):
        if user.get("role") not in roles:
            raise HTTPException(403, "No tienes permiso para esta acción")
        return user
    return dep