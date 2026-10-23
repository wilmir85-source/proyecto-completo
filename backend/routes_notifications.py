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
    if not user or not user.get("push_subscription"):
        return False
    
    subscription_info = user["push_subscription"]
    payload = {
        "title": title,
        "body": body,
        "url": url,
        "icon": "/icon-192.png",
        "badge": "/icon-192.png",
        "apns": {"payload": {"aps": {"sound": "default"}}}
    }

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS
        )
        return True
    except WebPushException as ex:
        print(f"Error enviando push: {ex}")
        if "410" in str(ex):
            await db.users.update_one({"id": user_id}, {"$unset": {"push_subscription": ""}})
        return False

@router.post("/notifications/test")
async def test_notification(user=Depends(current_user)):
    success = await send_push_notification(
        user_id=user["id"], title="Prueba de Jarvis", body="¡Todo listo para trabajar!", url="/pedidos"
    )
    if success: return {"ok": True, "message": "Notificación enviada."}
    raise HTTPException(400, "No se pudo enviar.")

# --- LA SECRETARIA TÓXICA (Cron Job PRO) ---
@router.get("/cron/reminders")
async def trigger_daily_reminders():
    try:
        users_with_push = await db.users.find({"push_subscription": {"$exists": True}}).to_list(100)
        if not users_with_push:
            return {"ok": True, "message": "Nadie tiene notificaciones activadas."}

        orders = await db.orders.find({"is_archived": {"$ne": True}}).to_list(1000)
        materials = await db.materials.find({}).to_list(500)
        
        hoy = datetime.now(timezone.utc)
        reporte = []

        atrasados = 0
        estancados = 0
        inminentes = 0

        for o in orders:
            if o.get("stage") == "Terminado":
                continue

            # 1. Pedidos Atrasados y Entregas Inminentes
            fecha_str = o.get("fecha_entrega")
            if fecha_str:
                try:
                    fecha = datetime.fromisoformat(fecha_str.replace("Z", "+00:00"))
                    if fecha < hoy:
                        atrasados += 1
                    elif (fecha - hoy).total_seconds() < 86400: # Menos de 24 horas
                        inminentes += 1
                except:
                    pass

            # 2. Pedidos Estancados (Más de 3 días sin actualizar)
            updated_str = o.get("updated_at")
            if updated_str and o.get("stage") not in ["Ventas", "Terminado"]:
                try:
                    updated = datetime.fromisoformat(updated_str.replace("Z", "+00:00"))
                    if (hoy - updated).days >= 3:
                        estancados += 1
                except:
                    pass

        # 3. Inventario Bajo
        stock_bajo = 0
        for m in materials:
            if float(m.get("cantidad", 0)) <= float(m.get("minimo", 0)):
                stock_bajo += 1

        # Armamos el reporte final
        if atrasados > 0: reporte.append(f"🔴 {atrasados} pedido(s) ATRASADO(S).")
        if inminentes > 0: reporte.append(f"⏰ {inminentes} pedido(s) vencen HOY o MAÑANA.")
        if estancados > 0: reporte.append(f"⚠️ {estancados} pedido(s) llevan +3 días estancados.")
        if stock_bajo > 0: reporte.append(f"📦 {stock_bajo} material(es) con STOCK BAJO.")

        if not reporte:
            mensaje = "Todo bajo control, señor. No hay retrasos ni problemas de inventario. Excelente trabajo."
            titulo = "Reporte Matutino: Todo en orden ☕"
        else:
            mensaje = " ".join(reporte) + " Revise el tablero inmediatamente."
            titulo = "¡A trabajar! Reporte de Jarvis 📋"

        # Enviar a todos
        enviados = 0
        for u in users_with_push:
            success = await send_push_notification(
                user_id=u["id"], title=titulo, body=mensaje, url="/pedidos"
            )
            if success: enviados += 1

        return {"ok": True, "enviados": enviados, "reporte": mensaje}
    except Exception as e:
        print(f"Error en cron: {e}")
        raise HTTPException(500, str(e))