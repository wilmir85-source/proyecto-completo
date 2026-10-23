from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from pywebpush import webpush, WebPushException
import json
import os
from core import db, current_user, now_iso

router = APIRouter(prefix="/api")

# Estas variables las pondremos en Render después
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
        "apns": {
            "payload": {
                "aps": {
                    "sound": "default"
                }
            }
        }
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
        user_id=user["id"],
        title="¡Hola, señor!",
        body="Soy Jarvis. Esta es una prueba de mi nueva voz.",
        url="/pedidos"
    )
    if success:
        return {"ok": True, "message": "Notificación enviada."}
    raise HTTPException(400, "No se pudo enviar. Revisa si diste permiso.")