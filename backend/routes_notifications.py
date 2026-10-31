from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from pywebpush import webpush, WebPushException
import json
import os
from datetime import datetime, timezone, timedelta
from core import db, current_user, now_iso

router = APIRouter(prefix="/api")

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_CLAIMS = {"sub": "mailto:admin@joyeria.com"}

class PushSubscription(BaseModel):
    endpoint: str
    expirationTime: str | None = None
    keys: dict

@router.post("/notifications/subscribe")
async def subscribe(subscription: PushSubscription, user=Depends(current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"push_subscription": subscription.dict(), "updated_at": now_iso()}}
    )
    return {"ok": True, "message": "Suscripción guardada."}

async def send_push_notification(user_id: str, title: str, body: str, url: str = "/"):
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("push_subscription"): return False
    
    payload = {
        "title": title, "body": body, "url": url,
        "icon": "/icon-192.png", "badge": "/icon-192.png",
        "apns": {"payload": {"aps": {"sound": "default"}}}
    }
    try:
        webpush(subscription_info=user["push_subscription"], data=json.dumps(payload),
                vapid_private_key=VAPID_PRIVATE_KEY, vapid_claims=VAPID_CLAIMS)
        return True
    except WebPushException as ex:
        print(f"Error enviando push: {ex}")
        if "410" in str(ex):
            await db.users.update_one({"id": user_id}, {"$unset": {"push_subscription": ""}})
        return False

async def notify_all_users(title: str, body: str, url: str = "/"):
    users_with_push = await db.users.find({"push_subscription": {"$exists": True}}).to_list(100)
    enviados = 0
    for u in users_with_push:
        if await send_push_notification(u["id"], title, body, url):
            enviados += 1
    return enviados

@router.post("/notifications/test")
async def test_notification(user=Depends(current_user)):
    success = await send_push_notification(
        user_id=user["id"],
        title="¡Hola, señor!",
        body="Soy Jarvis. Esta es una prueba de mi nueva voz. Todo está funcionando perfectamente.",
        url="/pedidos"
    )
    if success:
        return {"ok": True, "message": "Notificación enviada. Revisa tu pantalla."}
    raise HTTPException(400, "No se pudo enviar. Revisa si diste permiso o si la suscripción expiró.")

@router.get("/cron/morning")
async def morning_reminders():
    orders = await db.orders.find({"is_archived": {"$ne": True}}).to_list(1000)
    materials = await db.materials.find({}).to_list(500)
    hoy = datetime.now(timezone.utc)
    
    atrasados, inminentes, estancados = 0, 0, 0

    for o in orders:
        if o.get("stage") in ["Terminado", "Entregado"]: continue
        fecha_str = o.get("fecha_entrega")
        if fecha_str:
            try:
                fecha = datetime.fromisoformat(fecha_str.replace("Z", "+00:00"))
                if fecha < hoy: atrasados += 1
                elif (fecha - hoy).total_seconds() < 86400: inminentes += 1
            except: pass
        
        updated_str = o.get("updated_at")
        if updated_str and o.get("stage") not in ["Ventas", "Terminado", "Entregado"]:
            try:
                updated = datetime.fromisoformat(updated_str.replace("Z", "+00:00"))
                if (hoy - updated).days >= 3: estancados += 1
            except: pass

    stock_bajo = sum(1 for m in materials if float(m.get("cantidad", 0)) <= float(m.get("minimo", 0)))
    
    reporte = []
    if atrasados > 0: reporte.append(f"🔴 {atrasados} atrasados.")
    if inminentes > 0: reporte.append(f"⏰ {inminentes} vencen hoy/mañana.")
    if estancados > 0: reporte.append(f"⚠️ {estancados} estancados (+3 días).")
    if stock_bajo > 0: reporte.append(f"📦 {stock_bajo} materiales bajos.")

    if not reporte:
        title, body = "Todo en orden ☕", "Buenos días, señor. No hay retrasos ni problemas de inventario. Excelente trabajo."
    else:
        title, body = "¡A trabajar! 📋", " ".join(reporte) + " Revise el tablero."

    enviados = await notify_all_users(title, body, "/pedidos")
    return {"ok": True, "enviados": enviados, "reporte": body}

@router.get("/cron/evening")
async def evening_summary():
    orders = await db.orders.find({"is_archived": {"$ne": True}}).to_list(1000)
    hoy = datetime.now(timezone.utc)
    
    atrasados, inminentes = 0, 0

    for o in orders:
        if o.get("stage") in ["Terminado", "Entregado"]: continue
        fecha_str = o.get("fecha_entrega")
        if fecha_str:
            try:
                fecha = datetime.fromisoformat(fecha_str.replace("Z", "+00:00"))
                if fecha < hoy: atrasados += 1
                elif (fecha - hoy).total_seconds() < 86400: inminentes += 1
            except: pass

    # SOLO NOTIFICAMOS SI HAY ALGO URGENTE
    if atrasados == 0 and inminentes == 0:
        return {"ok": True, "message": "Sin urgencias nocturnas. No se envió notificación."}

    reporte = []
    if atrasados > 0: reporte.append(f"🔴 {atrasados} pedidos atrasados.")
    if inminentes > 0: reporte.append(f"⏰ {inminentes} vencen mañana.")
    
    body = " ".join(reporte) + " Revise el tablero antes de cerrar."
    enviados = await notify_all_users("🚨 URGENTE: Cierre de día", body, "/pedidos")
    return {"ok": True, "enviados": enviados, "reporte": body}