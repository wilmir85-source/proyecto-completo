import os
from datetime import datetime, timezone, timedelta
from typing import Optional, Union, List # <-- Agregamos Union y List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from core import (db, STAGES, ROLES, now_iso, new_id, hash_password, verify_password, create_token,
                  current_user, require_roles, public_user)

router = APIRouter(prefix="/api")
MAX_ATTEMPTS = 5
LOCK_MINUTES = 15


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    departamento: Optional[str] = None
    telefono: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    role: Optional[str] = None
    departamento: Optional[Union[str, List[str]]] = None # <-- Acepta texto O lista
    telefono: Optional[str] = None
    activo: Optional[bool] = None
    name: Optional[str] = None


def auth_response(user):
    return {"token": create_token(user["id"]), "user": public_user(user)}


@router.post("/auth/register")
async def register(payload: RegisterIn):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email ya registrado")
    if payload.departamento and payload.departamento not in STAGES:
        raise HTTPException(400, "Departamento inválido")
    is_first = await db.users.count_documents({}) == 0
    role = "admin" if is_first else ("ventas" if payload.departamento == "Ventas" else "trabajador")
    user = {"id": new_id(), "email": email, "name": payload.name, "password": hash_password(payload.password),
            "role": role, "departamento": payload.departamento, "telefono": payload.telefono or "",
            "activo": True, "calendar_token": new_id(), "created_at": now_iso()}
    await db.users.insert_one(user)
    return auth_response(user)


@router.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower()
    attempt = await db.login_attempts.find_one({"identifier": email})
    now = datetime.now(timezone.utc)
    if attempt and attempt.get("count", 0) >= MAX_ATTEMPTS:
        locked_until = datetime.fromisoformat(attempt["last"]) + timedelta(minutes=LOCK_MINUTES)
        if now < locked_until:
            raise HTTPException(429, "Demasiados intentos. Intenta en 15 minutos")
        await db.login_attempts.delete_one({"identifier": email})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password"]):
        await db.login_attempts.update_one({"identifier": email},
                                           {"$inc": {"count": 1}, "$set": {"last": now.isoformat()}}, upsert=True)
        raise HTTPException(401, "Credenciales inválidas")
    if user.get("activo") is False:
        raise HTTPException(403, "Usuario desactivado. Habla con el administrador")
    await db.login_attempts.delete_one({"identifier": email})
    return auth_response(user)


@router.get("/auth/me")
async def me(user=Depends(current_user)):
    return public_user(user)


@router.get("/users")
async def list_users(user=Depends(current_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("name", 1).to_list(500)
    return [public_user(u) for u in users]


@router.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, admin=Depends(require_roles("admin"))):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "role" in update and update["role"] not in ROLES:
        raise HTTPException(400, "Rol inválido")
    
    # --- VALIDACIÓN QUIRÚRGICA (Acepta un solo depto o una lista de deptos) ---
    depto_val = update.get("departamento")
    if depto_val:
        if isinstance(depto_val, list):
            for d in depto_val:
                if d not in STAGES:
                    raise HTTPException(400, f"Departamento inválido: {d}")
        elif isinstance(depto_val, str):
            if depto_val not in STAGES:
                raise HTTPException(400, "Departamento inválido")
    # --------------------------------------------------------------------------

    if user_id == admin["id"] and (update.get("role", "admin") != "admin" or update.get("activo") is False):
        raise HTTPException(400, "No puedes quitarte el rol de admin")
    r = await db.users.update_one({"id": user_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Usuario no encontrado")
    return public_user(await db.users.find_one({"id": user_id}, {"_id": 0}))


async def seed_admin():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({"id": new_id(), "email": email, "name": "Admin", "password": hash_password(password),
                                   "role": "admin", "departamento": None, "telefono": "", "activo": True,
                                   "calendar_token": new_id(), "created_at": now_iso()})
        return
    update = {"role": "admin", "activo": True}
    if not verify_password(password, existing["password"]):
        update["password"] = hash_password(password)
    await db.users.update_one({"email": email}, {"$set": update})
    async for u in db.users.find({"calendar_token": {"$exists": False}}):
        await db.users.update_one({"id": u["id"]}, {"$set": {"calendar_token": new_id()}})
    await db.users.update_many({"role": {"$exists": False}}, {"$set": {"role": "trabajador", "activo": True}})