from typing import Optional, Literal
from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from core import (db, STAGES, now_iso, new_id, parse_dt, enrich_order, current_user, require_roles, is_staff)

router = APIRouter(prefix="/api")


class TaskIn(BaseModel):
    titulo: str
    descripcion: Optional[str] = ""
    fecha: Optional[str] = None
    prioridad: Literal["baja", "media", "alta"] = "media"
    completada: bool = False
    asignado_a: Optional[str] = None


class TaskUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha: Optional[str] = None
    prioridad: Optional[Literal["baja", "media", "alta"]] = None
    completada: Optional[bool] = None
    asignado_a: Optional[str] = None


class ClientIn(BaseModel):
    nombre: str
    telefono: Optional[str] = ""
    email: Optional[str] = ""
    notas: Optional[str] = ""
    cumpleanos: Optional[str] = None
    vip: bool = False


# ---------- Tasks ----------
def task_query(user):
    return {} if user.get("role") == "admin" else {"$or": [{"user_id": user["id"]}, {"asignado_a": user["id"]}]}


async def op_create_task(data: dict, user) -> dict:
    task = {**data, "id": new_id(), "user_id": user["id"], "creado_por": user["name"], "created_at": now_iso()}
    if task.get("asignado_a"):
        u = await db.users.find_one({"id": task["asignado_a"]}, {"_id": 0, "name": 1})
        if not u:
            raise HTTPException(400, "Usuario asignado no existe")
        task["asignado_nombre"] = u["name"]
    await db.tasks.insert_one(task)
    task.pop("_id", None)
    return task


@router.get("/tasks")
async def list_tasks(user=Depends(current_user)):
    return await db.tasks.find(task_query(user), {"_id": 0}).sort("fecha", 1).to_list(1000)


@router.post("/tasks")
async def create_task(payload: TaskIn, user=Depends(current_user)):
    return await op_create_task(payload.model_dump(), user)


@router.patch("/tasks/{task_id}")
async def update_task(task_id: str, payload: TaskUpdate, user=Depends(current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update.get("asignado_a"):
        u = await db.users.find_one({"id": update["asignado_a"]}, {"_id": 0, "name": 1})
        if not u:
            raise HTTPException(400, "Usuario asignado no existe")
        update["asignado_nombre"] = u["name"]
    r = await db.tasks.update_one({"id": task_id, **task_query(user)}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Tarea no encontrada")
    return await db.tasks.find_one({"id": task_id}, {"_id": 0})


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user=Depends(current_user)):
    q = {"id": task_id} if user.get("role") == "admin" else {"id": task_id, "user_id": user["id"]}
    r = await db.tasks.delete_one(q)
    if r.deleted_count == 0:
        raise HTTPException(404, "Tarea no encontrada")
    return {"ok": True}


# ---------- Clients (shared) ----------
@router.get("/clients")
async def list_clients(user=Depends(current_user)):
    return await db.clients.find({}, {"_id": 0}).sort("nombre", 1).to_list(2000)


@router.post("/clients")
async def create_client(payload: ClientIn, user=Depends(require_roles("admin", "ventas"))):
    c = {**payload.model_dump(), "id": new_id(), "user_id": user["id"], "created_at": now_iso()}
    await db.clients.insert_one(c)
    c.pop("_id", None)
    return c


@router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user=Depends(require_roles("admin", "ventas"))):
    r = await db.clients.delete_one({"id": client_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Cliente no encontrado")
    return {"ok": True}


# ---------- Stats / Production / Sales ----------
async def all_orders():
    return [enrich_order(o) for o in await db.orders.find({}, {"_id": 0}).to_list(5000)]


def count_status(orders, status):
    return sum(1 for o in orders if o["estado_entrega"] == status)


@router.get("/stats")
async def stats(user=Depends(current_user)):
    orders = await all_orders()
    active = [o for o in orders if o.get("stage") != "Terminado"]
    mine = [o for o in active if o.get("asignado_a") == user["id"]]
    tasks = await db.tasks.find(task_query(user), {"_id": 0, "completada": 1}).to_list(5000)
    return {
        "total_pedidos": len(orders),
        "pedidos_activos": len(active),
        "pedidos_por_etapa": {s: sum(1 for o in orders if o.get("stage") == s) for s in STAGES},
        "pedidos_atrasados": count_status(orders, "atrasado"),
        "pedidos_por_vencer": count_status(orders, "por_vencer"),
        "pedidos_terminados": sum(1 for o in orders if o.get("stage") == "Terminado"),
        "mis_trabajos": len(mine),
        "mis_atrasados": count_status(mine, "atrasado"),
        "tareas_pendientes": sum(1 for t in tasks if not t.get("completada")),
        "total_tareas": len(tasks),
    }


@router.get("/stats/charts")
async def stats_charts(user=Depends(current_user)):
    orders = await all_orders()
    pie = [{"stage": s, "total": n} for s in STAGES if (n := sum(1 for o in orders if o.get("stage") == s))]
    if not is_staff(user):
        return {"ingresos": None, "etapas": pie}
    now = datetime.now(timezone.utc)
    months = []
    y, m = now.year, now.month
    for _ in range(12):
        months.insert(0, f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    ventas = {k: 0.0 for k in months}
    cobrado = {k: 0.0 for k in months}
    for o in orders:
        k = (o.get("created_at") or "")[:7]
        if k in ventas:
            ventas[k] += float(o.get("precio") or 0)
        for a in o.get("abonos") or []:
            ka = (a.get("fecha") or "")[:7]
            if ka in cobrado:
                cobrado[ka] += float(a.get("monto") or 0)
    return {"ingresos": [{"mes": k, "ventas": round(ventas[k], 2), "cobrado": round(cobrado[k], 2)} for k in months],
            "etapas": pie}


@router.get("/production")
async def production(user=Depends(current_user)):
    orders = [o for o in await all_orders() if o.get("stage") != "Terminado"]
    users = await db.users.find({"activo": {"$ne": False}}, {"_id": 0, "password": 0}).to_list(500)
    departamentos = []
    for s in STAGES[:-1]:
        lst = [o for o in orders if o.get("stage") == s]
        departamentos.append({
            "stage": s, "total": len(lst), "atrasados": count_status(lst, "atrasado"),
            "por_vencer": count_status(lst, "por_vencer"),
            "trabajadores": [u["name"] for u in users if u.get("departamento") == s],
            "pedidos": sorted(lst, key=lambda o: o.get("fecha_entrega") or "9999"),
        })
    trabajadores = []
    for u in users:
        lst = [o for o in orders if o.get("asignado_a") == u["id"]]
        trabajadores.append({"id": u["id"], "name": u["name"], "role": u.get("role"), "departamento": u.get("departamento"),
                             "asignados": len(lst), "atrasados": count_status(lst, "atrasado"),
                             "por_vencer": count_status(lst, "por_vencer"),
                             "progreso_promedio": round(sum(o.get("progreso", 0) for o in lst) / len(lst)) if lst else 0})
    return {"departamentos": departamentos, "trabajadores": trabajadores}


@router.get("/sales/summary")
async def sales_summary(user=Depends(require_roles("admin", "ventas"))):
    orders = await all_orders()
    deudores = [o for o in orders if o["estado_pago"] == "debe"]
    return {
        "total_vendido": round(sum(float(o.get("precio") or 0) for o in orders), 2),
        "total_abonado": round(sum(o["abonado"] for o in orders), 2),
        "saldo_pendiente": round(sum(o["saldo"] for o in orders), 2),
        "pedidos_con_deuda": len(deudores),
        "pedidos_pagados": sum(1 for o in orders if o["estado_pago"] == "pagado"),
    }


# ---------- iPhone / Calendar feed ----------
def ics_dt(d):
    return d.strftime("%Y%m%dT%H%M%SZ")


def ics_escape(s):
    return str(s or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def ics_event(uid, start, title, desc, alarms):
    lines = ["BEGIN:VEVENT", f"UID:{uid}@jarvis-joyeria", f"DTSTAMP:{ics_dt(datetime.now(timezone.utc))}",
             f"DTSTART:{ics_dt(start)}",
             f"DTEND:{ics_dt(start + timedelta(minutes=30))}", f"SUMMARY:{ics_escape(title)}",
             f"DESCRIPTION:{ics_escape(desc)}"]
    for a in alarms:
        lines += ["BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{ics_escape(title)}", f"TRIGGER:{a}", "END:VALARM"]
    lines.append("END:VEVENT")
    return lines


@router.get("/me/calendar")
async def my_calendar(user=Depends(current_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "calendar_token": 1})
    token = u.get("calendar_token")
    if not token:
        token = new_id()
        await db.users.update_one({"id": user["id"]}, {"$set": {"calendar_token": token}})
    return {"path": f"/api/calendar/{token}.ics"}


@router.get("/calendar/{token}.ics")
async def calendar_feed(token: str):
    user = await db.users.find_one({"calendar_token": token}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(404, "Calendario no encontrado")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Jarvis Joyeria//ES", "CALSCALE:GREGORIAN",
             "METHOD:PUBLISH", "X-WR-CALNAME:Jarvis Joyería", "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
             "X-PUBLISHED-TTL:PT15M"]
    for t in await db.tasks.find({**task_query(user), "completada": False}, {"_id": 0}).to_list(1000):
        d = parse_dt(t.get("fecha"))
        if d:
            lines += ics_event(f"task-{t['id']}", d, f"Tarea: {t['titulo']}", t.get("descripcion"), ["-PT30M", "PT0M"])
    for o in await all_orders():
        d = parse_dt(o.get("fecha_entrega"))
        relevant = is_staff(user) or o.get("asignado_a") == user["id"] or o.get("stage") == user.get("departamento")
        if d and relevant and o.get("stage") != "Terminado":
            desc = f"{o['descripcion']} | Etapa: {o['stage']} | Saldo: ${o['saldo']}"
            lines += ics_event(f"order-{o['id']}", d, f"Entrega: {o['cliente']}", desc, ["-P1D", "-PT2H"])
    lines.append("END:VCALENDAR")
    return Response(content="\r\n".join(lines) + "\r\n", media_type="text/calendar; charset=utf-8",
                    headers={"Content-Disposition": "inline; filename=jarvis.ics"})
