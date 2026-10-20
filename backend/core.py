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

STAGES = ["Ventas", "Diseño 3D", "Ceras", "Inyección", "Vulcanizado", "Casting",
          "Fabricación", "Grabado Láser", "Reparaciones", "Importación de máquinas", "Terminado"]
ORDER_TYPES = ["Diseño", "Fabricación", "Reparación", "Grabado", "Importación de máquinas", "Otro"]
LEGACY_STAGES = {"3D": "Diseño 3D", "Láser": "Grabado Láser"}
ROLES = ["admin", "ventas", "trabajador"]
STAFF_ROLES = ("admin", "ventas")
DUE_SOON_HOURS = 48

# ---------- Storage ----------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "jarvis-joyeria"
ALLOWED_IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_PHOTO_BYTES = 25 * 1024 * 1024
_storage_key = None


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


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": init_storage(), "Content-Type": content_type},
                        data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage()}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


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
    if order.get("stage") == "Terminado":
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
    return order.get("asignado_a") == user["id"] or (
        user.get("departamento") and order.get("stage") == user.get("departamento"))


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
