import re
from typing import Optional
from datetime import datetime, timezone, date
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from core import db, now_iso, new_id, enrich_order, require_roles, current_user

router = APIRouter(prefix="/api")
STAFF = require_roles("admin", "ventas")


class ClientUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    notas: Optional[str] = None
    cumpleanos: Optional[str] = None
    vip: Optional[bool] = None


class ClientNoteIn(BaseModel):
    texto: str = Field(min_length=1)


def norm(s):
    return " ".join(str(s or "").lower().split())


def days_to_birthday(cumple):
    try:
        d = date.fromisoformat(cumple)
    except (TypeError, ValueError):
        return None
    today = datetime.now(timezone.utc).date()
    try:
        nxt = d.replace(year=today.year)
    except ValueError:
        nxt = date(today.year, 3, 1)
    if nxt < today:
        nxt = nxt.replace(year=today.year + 1)
    return (nxt - today).days


def client_orders(client, orders):
    return [o for o in orders if o.get("cliente_id") == client["id"] or norm(o.get("cliente")) == norm(client["nombre"])]


async def client_or_404(cid):
    c = await db.clients.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    c.setdefault("notas_importantes", [])
    c["dias_cumpleanos"] = days_to_birthday(c.get("cumpleanos"))
    return c


async def client_profile(cid):
    c = await client_or_404(cid)
    name_rx = {"$regex": f"^\\s*{re.escape(c['nombre'].strip())}\\s*$", "$options": "i"}
    found = await db.orders.find({"$or": [{"cliente_id": cid}, {"cliente": name_rx}]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    mine = client_orders(c, [enrich_order(o) for o in found])
    c["pedidos"] = mine
    c["total_gastado"] = round(sum(float(o.get("precio") or 0) for o in mine), 2)
    c["saldo_pendiente"] = round(sum(o["saldo"] for o in mine), 2)
    return c


@router.get("/clients/{cid}")
async def get_client(cid: str, user=Depends(STAFF)):
    return await client_profile(cid)


@router.patch("/clients/{cid}")
async def update_client(cid: str, payload: ClientUpdate, user=Depends(STAFF)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update.get("cumpleanos"):
        try:
            date.fromisoformat(update["cumpleanos"])
        except ValueError:
            raise HTTPException(400, "Fecha de cumpleaños inválida (AAAA-MM-DD)")
    await client_or_404(cid)
    await db.clients.update_one({"id": cid}, {"$set": update})
    return await client_profile(cid)


@router.post("/clients/{cid}/notas")
async def add_client_note(cid: str, payload: ClientNoteIn, user=Depends(STAFF)):
    await client_or_404(cid)
    note = {"id": new_id(), "texto": payload.texto, "autor": user["name"], "fecha": now_iso()}
    await db.clients.update_one({"id": cid}, {"$push": {"notas_importantes": note}})
    return await client_profile(cid)


@router.delete("/clients/{cid}/notas/{nid}")
async def delete_client_note(cid: str, nid: str, user=Depends(STAFF)):
    await client_or_404(cid)
    await db.clients.update_one({"id": cid}, {"$pull": {"notas_importantes": {"id": nid}}})
    return await client_profile(cid)


@router.get("/clients-birthdays")
async def upcoming_birthdays(days: int = 14, user=Depends(current_user)):
    out = []
    for c in await db.clients.find({"cumpleanos": {"$nin": [None, ""]}}, {"_id": 0}).to_list(5000):
        d = days_to_birthday(c.get("cumpleanos"))
        if d is not None and d <= days:
            out.append({"id": c["id"], "nombre": c["nombre"], "telefono": c.get("telefono"), "dias": d})
    return sorted(out, key=lambda x: x["dias"])
