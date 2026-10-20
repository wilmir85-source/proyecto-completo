from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from core import db, now_iso, new_id, current_user, require_roles, can_work_on

router = APIRouter(prefix="/api")
STAFF = require_roles("admin", "ventas")
UNITS = ["g", "kg", "oz", "pz", "ml", "m"]


class MaterialIn(BaseModel):
    nombre: str = Field(min_length=1)
    unidad: str = "g"
    cantidad: float = Field(default=0, ge=0)
    minimo: float = Field(default=0, ge=0)
    notas: Optional[str] = ""


class MaterialUpdate(BaseModel):
    nombre: Optional[str] = None
    unidad: Optional[str] = None
    minimo: Optional[float] = Field(default=None, ge=0)
    notas: Optional[str] = None


class AjusteIn(BaseModel):
    cantidad: float
    motivo: Optional[str] = ""


class ConsumoItem(BaseModel):
    material_id: str
    cantidad: float = Field(gt=0)


class ConsumoIn(BaseModel):
    order_id: str
    items: List[ConsumoItem] = Field(min_length=1)


def enrich_material(m):
    m["bajo"] = float(m.get("cantidad") or 0) <= float(m.get("minimo") or 0)
    return m


async def material_or_404(mid):
    m = await db.materials.find_one({"id": mid}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Material no encontrado")
    return m


async def log_move(m, delta, motivo, user, order_id=None):
    await db.inventory_moves.insert_one({
        "id": new_id(), "material_id": m["id"], "material": m["nombre"], "delta": delta, "unidad": m["unidad"],
        "motivo": motivo, "order_id": order_id, "usuario": user["name"], "fecha": now_iso()})


@router.get("/inventory")
async def list_materials(user=Depends(current_user)):
    return [enrich_material(m) for m in await db.materials.find({}, {"_id": 0}).sort("nombre", 1).to_list(1000)]


@router.post("/inventory")
async def create_material(payload: MaterialIn, user=Depends(STAFF)):
    if payload.unidad not in UNITS:
        raise HTTPException(400, f"Unidad inválida. Opciones: {', '.join(UNITS)}")
    m = {**payload.model_dump(), "id": new_id(), "created_at": now_iso(), "updated_at": now_iso()}
    await db.materials.insert_one(m)
    m.pop("_id", None)
    await log_move(m, m["cantidad"], "Alta inicial", user)
    return enrich_material(m)


@router.patch("/inventory/{mid}")
async def update_material(mid: str, payload: MaterialUpdate, user=Depends(STAFF)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "unidad" in update and update["unidad"] not in UNITS:
        raise HTTPException(400, "Unidad inválida")
    await material_or_404(mid)
    await db.materials.update_one({"id": mid}, {"$set": {**update, "updated_at": now_iso()}})
    return enrich_material(await material_or_404(mid))


@router.delete("/inventory/{mid}")
async def delete_material(mid: str, user=Depends(STAFF)):
    r = await db.materials.delete_one({"id": mid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Material no encontrado")
    await db.inventory_moves.delete_many({"material_id": mid})
    return {"ok": True}


@router.post("/inventory/{mid}/ajuste")
async def adjust_material(mid: str, payload: AjusteIn, user=Depends(STAFF)):
    m = await material_or_404(mid)
    nueva = round(float(m["cantidad"]) + payload.cantidad, 3)
    if nueva < 0:
        raise HTTPException(400, f"Stock insuficiente: hay {m['cantidad']} {m['unidad']}")
    await db.materials.update_one({"id": mid}, {"$set": {"cantidad": nueva, "updated_at": now_iso()}})
    await log_move(m, payload.cantidad, payload.motivo or ("Entrada" if payload.cantidad > 0 else "Salida"), user)
    return enrich_material(await material_or_404(mid))


@router.get("/inventory/{mid}/movimientos")
async def material_moves(mid: str, user=Depends(current_user)):
    return await db.inventory_moves.find({"material_id": mid}, {"_id": 0}).sort("fecha", -1).to_list(200)


@router.post("/inventory/consume")
async def consume(payload: ConsumoIn, user=Depends(current_user)):
    order = await db.orders.find_one({"id": payload.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Pedido no encontrado")
    if not can_work_on(user, order):
        raise HTTPException(403, "No puedes editar este pedido")
    mats = {i.material_id: await material_or_404(i.material_id) for i in payload.items}
    for i in payload.items:
        if mats[i.material_id]["cantidad"] < i.cantidad:
            m = mats[i.material_id]
            raise HTTPException(400, f"Stock insuficiente de {m['nombre']}: hay {m['cantidad']} {m['unidad']}")
    usados = []
    for i in payload.items:
        m = mats[i.material_id]
        r = await db.materials.update_one({"id": m["id"], "cantidad": {"$gte": i.cantidad}},
                                          {"$inc": {"cantidad": -i.cantidad}, "$set": {"updated_at": now_iso()}})
        if r.modified_count == 0:
            for u in usados:
                await db.materials.update_one({"id": u["material_id"]}, {"$inc": {"cantidad": u["cantidad"]}})
            raise HTTPException(400, f"Stock insuficiente de {m['nombre']}")
        usados.append({"material_id": m["id"], "material": m["nombre"], "cantidad": i.cantidad, "unidad": m["unidad"]})
    for u in usados:
        await log_move(mats[u["material_id"]], -u["cantidad"], f"Pedido de {order['cliente']}", user, order["id"])
    texto = ", ".join(f"{u['cantidad']} {u['unidad']} de {u['material']}" for u in usados)
    await db.orders.update_one({"id": order["id"]}, {"$push": {
        "materiales_usados": {"$each": usados},
        "historial": {"id": new_id(), "fecha": now_iso(), "usuario": user["name"], "usuario_id": user["id"],
                      "accion": f"Descontó del inventario: {texto}"}}})
    return {"ok": True, "usados": usados,
            "materiales": [enrich_material(await material_or_404(mid)) for mid in mats]}
