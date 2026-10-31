import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import Response, RedirectResponse
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from datetime import datetime, timezone, timedelta
from core import (db, logger, APP_NAME, ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES, put_object, get_object, now_iso, shrink_image,
                  new_id, check_stage, check_tipo, enrich_order, current_user, require_roles, is_staff, can_work_on, decode_token)

# IMPORTAMOS EL CARTERO DE NOTIFICACIONES
from routes_notifications import send_push_notification

router = APIRouter(prefix="/api")
STAFF = require_roles("admin", "ventas")
WORKER_FIELDS = {"stage", "progreso", "notas"}


class OrderIn(BaseModel):
    cliente: str
    descripcion: str
    stage: str = "Ventas"
    precio: Optional[float] = 0
    fecha_entrega: Optional[str] = None
    notas: Optional[str] = ""
    telefono_cliente: Optional[str] = ""
    asignado_a: Optional[str] = None
    cliente_id: Optional[str] = None
    metal: Optional[str] = ""
    peso_metal: Optional[float] = Field(default=None, ge=0)
    piedra: Optional[str] = ""
    tipo: Optional[str] = "Fabricación"


class OrderUpdate(BaseModel):
    cliente: Optional[str] = None
    descripcion: Optional[str] = None
    stage: Optional[str] = None
    precio: Optional[float] = None
    fecha_entrega: Optional[str] = None
    notas: Optional[str] = None
    telefono_cliente: Optional[str] = None
    asignado_a: Optional[str] = None
    progreso: Optional[int] = Field(default=None, ge=0, le=100)
    metal: Optional[str] = None
    peso_metal: Optional[float] = Field(default=None, ge=0)
    piedra: Optional[str] = None
    tipo: Optional[str] = None


class AbonoIn(BaseModel):
    monto: float = Field(gt=0)
    nota: Optional[str] = ""


class NotaIn(BaseModel):
    texto: str = Field(min_length=1)


def log_entry(user, accion):
    return {"id": new_id(), "fecha": now_iso(), "usuario": user["name"], "usuario_id": user["id"], "accion": accion}


async def assignee_name(user_id):
    if not user_id:
        return None
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1})
    if not u:
        raise HTTPException(400, "Trabajador no encontrado")
    return u["name"]


async def get_order_or_404(order_id):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pedido no encontrado")
    return o


# ---------- Core operations (reused by Jarvis tools) ----------
async def op_create_order(data: dict, user) -> dict:
    check_stage(data.get("stage"))
    check_tipo(data.get("tipo"))
    
    # --- GENERADOR DE FOLIO (MJ-0001) ---
    counter = await db.counters.find_one_and_update(
        {"_id": "order_folio"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    folio = f"MJ-{counter['seq']:04d}"
    
    order = {
        **data, 
        "id": new_id(), 
        "folio": folio, 
        "fotos": [], 
        "abonos": [], 
        "progreso": 0, 
        "creado_por": user["name"],
        "asignado_nombre": await assignee_name(data.get("asignado_a")),
        "historial": [log_entry(user, "Pedido creado")], 
        "created_at": now_iso(), 
        "updated_at": now_iso()
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)
    
    # --- NOTIFICACIÓN DE NUEVO PEDIDO ---
    try:
        staff_users = await db.users.find({"role": {"$in": ["admin", "ventas"]}, "push_subscription": {"$exists": True}}).to_list(10)
        for u in staff_users:
            await send_push_notification(
                user_id=u["id"],
                title="🆕 Nuevo Pedido Creado",
                body=f"Se registró el pedido {folio} para {order['cliente']}.",
                url="/pedidos"
            )
    except Exception as e:
        logger.error(f"Error notificando nuevo pedido: {e}")
    # ------------------------------------
    
    return enrich_order(order)


async def op_update_order(order_id: str, update: dict, user) -> dict:
    order = await get_order_or_404(order_id)
    if not can_work_on(user, order):
        raise HTTPException(403, "Este trabajo no está asignado a ti ni a tu departamento")
    if not is_staff(user) and set(update) - WORKER_FIELDS:
        raise HTTPException(403, "Solo puedes actualizar etapa, progreso y notas")
    check_stage(update.get("stage"))
    check_tipo(update.get("tipo"))
    logs = []
    if "stage" in update and update["stage"] != order.get("stage"):
        logs.append(log_entry(user, f"Movió de {order.get('stage')} a {update['stage']}"))
        if update["stage"] in ["Terminado", "Entregado"]:
            update["progreso"] = 100
            saldo = enrich_order(dict(order))["saldo"]
            if saldo > 0:
                logs.append(log_entry(user, f"⚠ Terminado/Entregado con SALDO PENDIENTE de Q{saldo:,.2f}"))
    if "asignado_a" in update and update["asignado_a"] != order.get("asignado_a"):
        update["asignado_nombre"] = await assignee_name(update["asignado_a"])
        logs.append(log_entry(user, f"Asignó a {update['asignado_nombre']}"))
    if "progreso" in update and update["progreso"] != order.get("progreso"):
        logs.append(log_entry(user, f"Progreso {update['progreso']}%"))
    update["updated_at"] = now_iso()
    ops = {"$set": update}
    if logs:
        ops["$push"] = {"historial": {"$each": logs}}
    await db.orders.update_one({"id": order_id}, ops)
    
    # --- NOTIFICACIÓN DE PEDIDO TERMINADO / ENTREGADO ---
    if update.get("stage") in ["Terminado", "Entregado"] and order.get("stage") != update.get("stage"):
        try:
            # 1. Avisamos a los jefes (Admin/Ventas)
            staff_users = await db.users.find({"role": {"$in": ["admin", "ventas"]}, "push_subscription": {"$exists": True}}).to_list(10)
            for u in staff_users:
                await send_push_notification(
                    user_id=u["id"],
                    title=f"✅ Pedido {order['folio']} {update['stage']}",
                    body=f"El pedido de {order['cliente']} pasó a {update['stage']}.",
                    url="/pedidos"
                )
            
            # 2. Si hay un trabajador asignado, también le avisamos
            if order.get("asignado_a"):
                await send_push_notification(
                    user_id=order["asignado_a"],
                    title=f"🎉 Trabajo {order['folio']} {update['stage']}",
                    body=f"El pedido de {order['cliente']} ha finalizado.",
                    url="/mis-trabajos"
                )
        except Exception as e:
            logger.error(f"Error notificando pedido terminado: {e}")
    # ----------------------------------------------------
    
    return enrich_order(await get_order_or_404(order_id))


async def op_add_abono(order_id: str, monto: float, nota: str, user) -> dict:
    await get_order_or_404(order_id)
    abono = {"id": new_id(), "monto": round(monto, 2), "nota": nota or "", "fecha": now_iso(), "registrado_por": user["name"]}
    await db.orders.update_one({"id": order_id}, {"$push": {"abonos": abono, "historial": log_entry(user, f"Abono Q{monto:,.2f}")},
                                                  "$set": {"updated_at": now_iso()}})
    return enrich_order(await get_order_or_404(order_id))


# ---------- Routes ----------
@router.get("/orders")
async def list_orders(mine: bool = False, user=Depends(current_user)):
    # Solo mostramos los pedidos que NO estén archivados
    query = {"is_archived": {"$ne": True}}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    if mine:
        orders = [o for o in orders if o.get("asignado_a") == user["id"] or
                  (user.get("departamento") and o.get("stage") == user.get("departamento"))]
    
    # 🚨 ESCUDO DE SEGURIDAD FINANCIERA 🚨
    is_staff_user = user.get("role") in ["admin", "ventas"]
    if not is_staff_user:
        for o in orders:
            o["precio"] = 0
            o["abonos"] = []
            
    return [enrich_order(o) for o in orders]


@router.get("/orders/archived")
async def list_archived_orders(user=Depends(STAFF)):
    # Buscamos SOLO los que están archivados
    orders = await db.orders.find({"is_archived": True}, {"_id": 0}).sort("archived_at", -1).to_list(2000)
    return [enrich_order(o) for o in orders]


@router.get("/orders/cleanup-archive")
async def cleanup_archive():
    # Calcula la fecha de hace 30 días
    hace_30_dias = datetime.now(timezone.utc) - timedelta(days=30)
    fecha_limite = hace_30_dias.isoformat()
    
    # Borra físicamente de la base de datos los archivados viejos
    result = await db.orders.delete_many({
        "is_archived": True,
        "archived_at": {"$lt": fecha_limite}
    })
    return {"ok": True, "deleted_count": result.deleted_count, "message": f"Se eliminaron {result.deleted_count} pedidos antiguos del historial."}


@router.post("/orders")
async def create_order(payload: OrderIn, user=Depends(STAFF)):
    return await op_create_order(payload.model_dump(), user)


@router.patch("/orders/{order_id}")
async def update_order(order_id: str, payload: OrderUpdate, user=Depends(current_user)):
    update = payload.model_dump(exclude_unset=True)
    update = {k: v for k, v in update.items() if v is not None or k in ("asignado_a", "peso_metal", "fecha_entrega")}
    return await op_update_order(order_id, update, user)


@router.delete("/orders/{order_id}")
async def delete_order(order_id: str, user=Depends(STAFF)):
    # En lugar de borrar de la base de datos, lo marcamos como archivado
    r = await db.orders.update_one(
        {"id": order_id}, 
        {"$set": {"is_archived": True, "archived_at": now_iso(), "archived_by": user["name"]}}
    )
    if r.modified_count == 0:
        raise HTTPException(404, "Pedido no encontrado")
    return {"ok": True, "message": "Pedido archivado en el historial."}


@router.post("/orders/{order_id}/abonos")
async def add_abono(order_id: str, payload: AbonoIn, user=Depends(STAFF)):
    return await op_add_abono(order_id, payload.monto, payload.nota, user)


@router.delete("/orders/{order_id}/abonos/{abono_id}")
async def delete_abono(order_id: str, abono_id: str, user=Depends(STAFF)):
    order = await get_order_or_404(order_id)
    if not any(a["id"] == abono_id for a in order.get("abonos") or []):
        raise HTTPException(404, "Abono no encontrado")
    await db.orders.update_one({"id": order_id}, {"$pull": {"abonos": {"id": abono_id}},
                                                  "$push": {"historial": log_entry(user, "Eliminó un abono")}})
    return enrich_order(await get_order_or_404(order_id))


@router.post("/orders/{order_id}/notas")
async def add_note(order_id: str, payload: NotaIn, user=Depends(current_user)):
    order = await get_order_or_404(order_id)
    if not can_work_on(user, order):
        raise HTTPException(403, "Este trabajo no está asignado a ti ni a tu departamento")
    await db.orders.update_one({"id": order_id}, {"$push": {"historial": log_entry(user, payload.texto)},
                                                  "$set": {"updated_at": now_iso()}})
    return enrich_order(await get_order_or_404(order_id))


@router.post("/orders/{order_id}/photos")
async def upload_order_photo(order_id: str, file: UploadFile = File(...), user=Depends(current_user)):
    if not can_work_on(user, await get_order_or_404(order_id)):
        raise HTTPException(403, "No puedes editar este pedido")
    ext = ALLOWED_IMAGE_TYPES.get(file.content_type)
    if not ext:
        raise HTTPException(400, "Solo se permiten imágenes JPG, PNG o WEBP")
    data = await file.read()
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(400, "La imagen supera 25 MB")
    try:
        data = await asyncio.to_thread(shrink_image, data, 2000, 82)
    except Exception:
        raise HTTPException(400, "No se pudo leer la imagen")
    ext, content_type = "jpg", "image/jpeg"
    path = f"{APP_NAME}/orders/{order_id}/{new_id()}.{ext}"
    try:
        result = await asyncio.to_thread(put_object, path, data, content_type)
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(502, "No se pudo subir la imagen")
    
    foto = {
        "path": result["path"], 
        "url": result.get("url", ""), 
        "nombre": file.filename, 
        "subido_por": user["name"], 
        "created_at": now_iso()
    }
    
    await db.files.insert_one({
        "id": new_id(), 
        "user_id": user["id"], 
        "order_id": order_id,
        "storage_path": result["path"], 
        "url": result.get("url", ""),
        "original_filename": file.filename,
        "content_type": content_type, 
        "size": result.get("size", len(data)),
        "is_deleted": False, 
        "created_at": now_iso()
    })
    
    await db.orders.update_one({"id": order_id}, {"$push": {"fotos": foto}, "$set": {"updated_at": now_iso()}})
    return foto


@router.delete("/orders/{order_id}/photos")
async def delete_order_photo(order_id: str, path: str = Query(...), user=Depends(current_user)):
    order = await get_order_or_404(order_id)
    if not can_work_on(user, order):
        raise HTTPException(403, "No puedes editar este pedido")
    await db.orders.update_one({"id": order_id}, {"$pull": {"fotos": {"path": path}}})
    await db.files.update_one({"storage_path": path}, {"$set": {"is_deleted": True}})
    return {"ok": True}


@router.get("/files/{path:path}")
async def download_file(path: str, auth: str = Query(...)):
    user = await db.users.find_one({"id": decode_token(auth), "activo": {"$ne": False}}, {"_id": 0, "id": 1})
    if not user:
        raise HTTPException(401, "Token inválido")
    
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    
    if record and record.get("url"):
        return RedirectResponse(url=record["url"])

    try:
        data, ctype = await asyncio.to_thread(get_object, path)
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise HTTPException(502, "No se pudo obtener la imagen")
        
    return Response(content=data, media_type=record.get("content_type", ctype) if record else ctype,
                    headers={"Cache-Control": "private, max-age=3600"})