import asyncio
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from core import db, logger, now_iso, new_id, current_user, require_roles, is_staff, STAFF_ROLES
from routes_notifications import send_push_notification

router = APIRouter(prefix="/api")
STAFF = require_roles(*STAFF_ROLES)

CATEGORIAS = ["Piedras", "Oro", "Plata", "Herramientas", "Insumos de taller", "Otro"]
ESTADOS = ["pendiente", "aprobada", "comprada", "entregada", "rechazada"]


class RequisitionIn(BaseModel):
    categoria: Literal["Piedras", "Oro", "Plata", "Herramientas", "Insumos de taller", "Otro"]
    item: str = Field(min_length=1, max_length=160)
    cantidad: float = Field(gt=0)
    unidad: str = Field(default="pz", max_length=20)
    urgente: bool = False
    nota: Optional[str] = Field(default="", max_length=500)


class RequisitionUpdate(BaseModel):
    estado: Optional[Literal["pendiente", "aprobada", "comprada", "entregada", "rechazada"]] = None
    costo: Optional[float] = Field(default=None, ge=0)
    respuesta: Optional[str] = Field(default=None, max_length=500)


def view_req(r: dict, user) -> dict:
    if not is_staff(user):
        r.pop("costo", None)
    return r


async def req_or_404(rid: str, user) -> dict:
    r = await db.requisitions.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Pedido de material no encontrado")
    if not is_staff(user) and r["solicitante_id"] != user["id"]:
        raise HTTPException(403, "No puedes ver este pedido de material")
    return r


async def notify_staff(req: dict, author_id: str):
    try:
        recipients = await db.users.find(
            {"role": {"$in": list(STAFF_ROLES)}, "activo": {"$ne": False}, "id": {"$ne": author_id}},
            {"_id": 0, "id": 1}).to_list(200)
        titulo = f"Nueva requisición de {req['categoria']} de {req['solicitante_nombre']}"
        mensaje = f"{req['cantidad']:g} {req['unidad']} · {req['item']}" + (" · URGENTE" if req.get("urgente") else "")
        url = f"/requisiciones/{req['id']}"
        docs = [{"id": new_id(), "user_id": u["id"], "tipo": "requisicion", "ref_id": req["id"], "titulo": titulo,
                 "mensaje": mensaje, "url": url, "leida": False, "created_at": now_iso()} for u in recipients]
        if docs:
            await db.inbox.insert_many(docs)
        for u in recipients:
            await send_push_notification(u["id"], titulo, mensaje, url)
    except Exception as e:
        logger.error(f"Error notificando requisición: {e}")


@router.get("/requisitions/meta")
async def requisitions_meta(user=Depends(current_user)):
    return {"categorias": CATEGORIAS, "estados": ESTADOS}


@router.post("/requisitions")
async def create_requisition(payload: RequisitionIn, user=Depends(current_user)):
    req = {**payload.model_dump(), "id": new_id(), "estado": "pendiente", "costo": None, "respuesta": "",
           "solicitante_id": user["id"], "solicitante_nombre": user.get("name") or user.get("email"),
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.requisitions.insert_one(req)
    req.pop("_id", None)
    asyncio.create_task(notify_staff(dict(req), user["id"]))
    return view_req(req, user)


@router.get("/requisitions")
async def list_requisitions(user=Depends(current_user)):
    query = {} if is_staff(user) else {"solicitante_id": user["id"]}
    items = await db.requisitions.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [view_req(r, user) for r in items]


@router.get("/requisitions/{rid}")
async def get_requisition(rid: str, user=Depends(current_user)):
    return view_req(await req_or_404(rid, user), user)


@router.patch("/requisitions/{rid}")
async def update_requisition(rid: str, payload: RequisitionUpdate, user=Depends(STAFF)):
    await req_or_404(rid, user)
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update.update({"updated_at": now_iso(), "atendido_por": user.get("name")})
    await db.requisitions.update_one({"id": rid}, {"$set": update})
    return await req_or_404(rid, user)


@router.get("/notifications/inbox")
async def inbox(user=Depends(current_user)):
    items = await db.inbox.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    unread = await db.inbox.count_documents({"user_id": user["id"], "leida": False})
    return {"items": items, "no_leidas": unread}


@router.post("/notifications/inbox/read-all")
async def read_all(user=Depends(current_user)):
    await db.inbox.update_many({"user_id": user["id"], "leida": False}, {"$set": {"leida": True}})
    return {"ok": True}


@router.post("/notifications/inbox/{nid}/read")
async def read_one(nid: str, user=Depends(current_user)):
    r = await db.inbox.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"leida": True}})
    if r.matched_count == 0:
        raise HTTPException(404, "Aviso no encontrado")
    return {"ok": True}
