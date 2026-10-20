import asyncio
import os
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from core import db, client, logger, LEGACY_STAGES, init_storage
import routes_auth
import routes_orders
import routes_misc
import routes_jarvis
import routes_inventory
import routes_clients
import routes_pdf
import routes_settings

app = FastAPI(title="Jarvis Joyería API")
health = APIRouter(prefix="/api")


@health.get("/")
async def root():
    return {"service": "Jarvis Joyería", "ok": True}


for r in (health, routes_auth.router, routes_orders.router, routes_misc.router, routes_jarvis.router,
          routes_inventory.router, routes_clients.router, routes_pdf.router, routes_settings.router):
    app.include_router(r)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id"],
)


@app.on_event("startup")
async def startup():
    for old, new in LEGACY_STAGES.items():
        await db.orders.update_many({"stage": old}, {"$set": {"stage": new}})
    await routes_auth.seed_admin()
    await routes_settings.seed_settings()
    await db.orders.create_index("share_token", sparse=True)
    for coll in ("orders", "tasks", "clients", "materials"):
        await db[coll].create_index("id", unique=True)
    await db.users.create_index("siri_key", sparse=True)
    await db.orders.create_index("stage")
    await db.orders.create_index("asignado_a")
    await db.chat_messages.create_index([("user_id", 1), ("session_id", 1)])
    try:
        await asyncio.to_thread(init_storage)
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
