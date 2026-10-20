import asyncio
import hashlib
import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response, FileResponse
from pydantic import BaseModel
from core import (db, ROOT_DIR, APP_NAME, ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES, put_object, get_object, shrink_image,
                  new_id, now_iso, enrich_order, require_roles, logger)

router = APIRouter(prefix="/api")
DEFAULTS = {"nombre": "Mundo de Joyas", "telefono": "", "direccion": "", "codigo_pais": "", "mensaje": "Gracias por confiar en nosotros.", "logo_path": None}
FLOW = ["Ventas", "Diseño 3D", "Ceras", "Inyección", "Vulcanizado", "Casting", "Fabricación", "Grabado Láser", "Terminado"]


class SettingsIn(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    mensaje: Optional[str] = None
    codigo_pais: Optional[str] = None


async def get_settings():
    s = await db.settings.find_one({"id": "negocio"}, {"_id": 0}) or {}
    return {**DEFAULTS, **{k: v for k, v in s.items() if k != "id"}}


async def logo_bytes():
    s = await get_settings()
    if s.get("logo_path"):
        try:
            return (await asyncio.to_thread(get_object, s["logo_path"]))[0]
        except Exception as e:
            logger.error(f"Logo fetch failed: {e}")
    return (ROOT_DIR / "assets" / "logo.png").read_bytes()


@router.get("/settings")
async def read_settings():
    s = await get_settings()
    lp = s.pop("logo_path", None)
    s.pop("created_at", None)
    return {**s, "has_logo": bool(lp), "logo_v": hashlib.sha256((lp or "default").encode()).hexdigest()[:10]}


@router.patch("/settings")
async def update_settings(payload: SettingsIn, user=Depends(require_roles("admin"))):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    await db.settings.update_one({"id": "negocio"}, {"$set": update}, upsert=True)
    return await read_settings()


@router.post("/settings/logo")
async def upload_logo(file: UploadFile = File(...), user=Depends(require_roles("admin"))):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Solo JPG, PNG o WEBP")
    data = await file.read()
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(400, "La imagen supera 25 MB")
    data = await asyncio.to_thread(shrink_image, data, 600, 90)
    result = await asyncio.to_thread(put_object, f"{APP_NAME}/branding/logo-{new_id()}.jpg", data, "image/jpeg")
    await db.settings.update_one({"id": "negocio"}, {"$set": {"logo_path": result["path"]}}, upsert=True)
    return await read_settings()


@router.delete("/settings/logo")
async def delete_logo(user=Depends(require_roles("admin"))):
    await db.settings.update_one({"id": "negocio"}, {"$set": {"logo_path": None}}, upsert=True)
    return await read_settings()


@router.get("/public/logo")
async def public_logo():
    s = await get_settings()
    if not s.get("logo_path"):
        return FileResponse(ROOT_DIR / "assets" / "logo.png", headers={"Cache-Control": "public, max-age=300"})
    return Response(await logo_bytes(), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=300"})


# ---------- Client share link ----------
async def is_vip(order):
    q = {"id": order["cliente_id"]} if order.get("cliente_id") else {"nombre": {"$regex": f"^\\s*{re.escape(order['cliente'].strip())}\\s*$", "$options": "i"}}
    try:
        c = await db.clients.find_one(q, {"_id": 0, "vip": 1})
    except Exception:
        c = None
    return bool(c and c.get("vip"))


@router.post("/orders/{order_id}/share")
async def share_order(order_id: str, user=Depends(require_roles("admin", "ventas"))):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0, "id": 1, "share_token": 1})
    if o is None:
        raise HTTPException(404, "Pedido no encontrado")
    token = o.get("share_token") or new_id().replace("-", "")
    await db.orders.update_one({"id": order_id}, {"$set": {"share_token": token}})
    full = await db.orders.find_one({"id": order_id}, {"_id": 0})
    phone = full.get("telefono_cliente")
    if not phone:
        q = {"id": full["cliente_id"]} if full.get("cliente_id") else {
            "nombre": {"$regex": f"^\\s*{re.escape(full['cliente'].strip())}\\s*$", "$options": "i"}}
        c = await db.clients.find_one(q, {"_id": 0, "telefono": 1})
        phone = (c or {}).get("telefono", "")
    return {"token": token, "path": f"/seguimiento/{token}", "telefono": phone}


async def order_by_token(token):
    o = await db.orders.find_one({"share_token": token}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pedido no encontrado")
    return enrich_order(o)


@router.get("/public/orders/{token}")
async def public_order(token: str):
    o = await order_by_token(token)
    flow = FLOW if o["stage"] in FLOW else FLOW[:-1] + [o["stage"], "Terminado"]
    return {
        "negocio": await read_settings(), "cliente": o["cliente"].split(" ")[0], "descripcion": o["descripcion"],
        "tipo": o.get("tipo") or "Fabricación", "stage": o["stage"], "flujo": flow, "progreso": o.get("progreso", 0),
        "fecha_entrega": o.get("fecha_entrega"), "estado_entrega": o["estado_entrega"], "vip": await is_vip(o),
        "metal": o.get("metal"), "piedra": o.get("piedra"), "precio": o.get("precio") or 0, "abonado": o["abonado"],
        "saldo": o["saldo"], "estado_pago": o["estado_pago"], "fotos": len(o["fotos"]), "actualizado": o.get("updated_at"),
        "creado": o.get("created_at"),
    }


@router.get("/public/orders/{token}/foto/{i}")
async def public_photo(token: str, i: int):
    o = await order_by_token(token)
    if i < 0 or i >= len(o["fotos"]):
        raise HTTPException(404, "Foto no encontrada")
    data, ctype = await asyncio.to_thread(get_object, o["fotos"][i]["path"])
    return Response(data, media_type=ctype, headers={"Cache-Control": "public, max-age=3600"})


async def seed_settings():
    await db.settings.update_one({"id": "negocio"}, {"$setOnInsert": {"nombre": DEFAULTS["nombre"], "created_at": now_iso()}}, upsert=True)
