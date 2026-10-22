import json
import unicodedata
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from google import genai
import os
#from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, ToolCallReady, StreamDone
#from emergentintegrations.llm.openai import OpenAITextToSpeech
from core import db, logger, STAGES, now_iso, new_id, enrich_order, is_staff, current_user, can_work_on
from routes_orders import op_create_order, op_update_order, op_add_abono
from routes_misc import op_create_task, task_query
from routes_clients import client_profile, days_to_birthday

router = APIRouter(prefix="/api")
ACTION_MARK = "\u0001"
VOICES = {"onyx", "nova", "alloy", "echo", "fable", "shimmer", "ash", "coral", "sage"}

class ChatIn(BaseModel):
    message: str
    session_id: Optional[str] = None
    tz: Optional[str] = "UTC"

class TTSIn(BaseModel):
    text: str
    voice: Optional[str] = "onyx"

def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s or "").lower()) if unicodedata.category(c) != "Mn")

async def find_order(ref):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    q = norm(ref)
    exact = [o for o in orders if o["id"] == ref]
    hits = exact or [o for o in orders if q in norm(o.get("cliente")) or q in norm(o.get("descripcion"))]
    active = [o for o in hits if o.get("stage") != "Terminado"]
    return (active or hits or [None])[0]

async def find_user(name):
    if not name:
        return None
    q = norm(name)
    for u in await db.users.find({"activo": {"$ne": False}}, {"_id": 0, "password": 0}).to_list(500):
        if q in norm(u["name"]) or q == norm(u["email"]):
            return u
    raise HTTPException(400, f"No encontré al trabajador '{name}'")

TOOLS = [
    {"type": "function", "function": {
        "name": "crear_tarea", "description": "Crea una tarea o recordatorio.",
        "parameters": {"type": "object", "properties": {
            "titulo": {"type": "string"},
            "fecha": {"type": "string"},
            "prioridad": {"type": "string", "enum": ["baja", "media", "alta"]},
            "asignar_a": {"type": "string"}},
            "required": ["titulo"]}}},
    {"type": "function", "function": {
        "name": "completar_tarea", "description": "Marca como completada una tarea pendiente por su título.",
        "parameters": {"type": "object", "properties": {"titulo": {"type": "string"}}, "required": ["titulo"]}}},
    {"type": "function", "function": {
        "name": "crear_pedido", "description": "Registra un pedido nuevo de joyería.",
        "parameters": {"type": "object", "properties": {
            "cliente": {"type": "string"}, "descripcion": {"type": "string"},
            "etapa": {"type": "string", "enum": STAGES}, "precio": {"type": "number"},
            "fecha_entrega": {"type": "string"},
            "telefono_cliente": {"type": "string"}, "asignar_a": {"type": "string"}},
            "required": ["cliente", "descripcion"]}}},
    {"type": "function", "function": {
        "name": "actualizar_pedido", "description": "Mueve de etapa, asigna, cambia progreso o agrega nota.",
        "parameters": {"type": "object", "properties": {
            "pedido": {"type": "string"}, "etapa": {"type": "string", "enum": STAGES}, 
            "progreso": {"type": "integer"}, "asignar_a": {"type": "string"}, 
            "fecha_entrega": {"type": "string"}, "nota": {"type": "string"}},
            "required": ["pedido"]}}},
    {"type": "function", "function": {
        "name": "registrar_abono", "description": "Registra un pago/abono del cliente a un pedido.",
        "parameters": {"type": "object", "properties": {
            "pedido": {"type": "string"}, "monto": {"type": "number"}, "nota": {"type": "string"}},
            "required": ["pedido", "monto"]}}},
    {"type": "function", "function": {
        "name": "consultar_pedido", "description": "Obtiene el estado detallado de un pedido.",
        "parameters": {"type": "object", "properties": {"pedido": {"type": "string"}}, "required": ["pedido"]}}},
    {"type": "function", "function": {
        "name": "consultar_cliente", "description": "Perfil de un cliente, notas, cumpleaños, pedidos y saldo.",
        "parameters": {"type": "object", "properties": {"nombre": {"type": "string"}}, "required": ["nombre"]}}},
    {"type": "function", "function": {
        "name": "agregar_nota_cliente", "description": "Guarda una nota importante en el perfil del cliente.",
        "parameters": {"type": "object", "properties": {"nombre": {"type": "string"}, "nota": {"type": "string"}},
                       "required": ["nombre", "nota"]}}},
]

async def find_client(name):
    q = norm(name)
    for c in await db.clients.find({}, {"_id": 0, "id": 1, "nombre": 1}).to_list(5000):
        if q in norm(c["nombre"]):
            return c
    return None

async def run_tool(name, args, user):
    try:
        if name == "crear_tarea":
            u = await find_user(args.get("asignar_a"))
            t = await op_create_task({"titulo": args["titulo"], "descripcion": "", "fecha": args.get("fecha"),
                                      "prioridad": args.get("prioridad", "media"), "completada": False,
                                      "asignado_a": u["id"] if u else None}, user)
            return {"ok": True, "tarea": t["titulo"], "fecha": t.get("fecha")}
        if name == "completar_tarea":
            q = norm(args["titulo"])
            for t in await db.tasks.find({**task_query(user), "completada": False}, {"_id": 0}).to_list(1000):
                if q in norm(t["titulo"]):
                    await db.tasks.update_one({"id": t["id"]}, {"$set": {"completada": True}})
                    return {"ok": True, "tarea": t["titulo"]}
            return {"error": "No encontré esa tarea pendiente"}
        if name == "crear_pedido":
            if not is_staff(user):
                return {"error": "Solo ventas o admin pueden crear pedidos"}
            u = await find_user(args.get("asignar_a"))
            o = await op_create_order({"cliente": args["cliente"], "descripcion": args["descripcion"],
                                       "stage": args.get("etapa", "Ventas"), "precio": args.get("precio", 0),
                                       "fecha_entrega": args.get("fecha_entrega"), "notas": "",
                                       "telefono_cliente": args.get("telefono_cliente", ""),
                                       "asignado_a": u["id"] if u else None}, user)
            return {"ok": True, "pedido": o["cliente"], "etapa": o["stage"], "id": o["id"]}
        if name in ("consultar_cliente", "agregar_nota_cliente"):
            if not is_staff(user):
                return {"error": "Solo ventas o admin pueden ver clientes"}
            c = await find_client(args["nombre"])
            if not c:
                return {"error": f"No encontré al cliente '{args['nombre']}'"}
            if name == "agregar_nota_cliente":
                await db.clients.update_one({"id": c["id"]}, {"$push": {"notas_importantes": {
                    "id": new_id(), "texto": args["nota"], "autor": user["name"], "fecha": now_iso()}}})
                return {"ok": True, "cliente": c["nombre"], "nota": args["nota"]}
            p = await client_profile(c["id"])
            return {"ok": True, "cliente": p["nombre"], "telefono": p.get("telefono"), "cumpleanos": p.get("cumpleanos"),
                    "dias_para_cumpleanos": p.get("dias_cumpleanos"), "notas_generales": p.get("notas"),
                    "notas_importantes": [n["texto"] for n in p["notas_importantes"]],
                    "total_gastado": p["total_gastado"], "saldo_pendiente": p["saldo_pendiente"],
                    "pedidos": [{"descripcion": o["descripcion"], "etapa": o["stage"], "entrega": o.get("fecha_entrega"),
                                 "saldo": o["saldo"]} for o in p["pedidos"][:10]]}
        if name in ("actualizar_pedido", "registrar_abono", "consultar_pedido"):
            o = await find_order(args["pedido"])
            if not o:
                return {"error": f"No encontré un pedido que coincida con '{args['pedido']}'"}
            if name == "consultar_pedido":
                e = enrich_order(o)
                last = (e["historial"] or [{}])[-1]
                info = {"ok": True, "cliente": e["cliente"], "descripcion": e["descripcion"], "etapa": e["stage"],
                        "estado_entrega": e["estado_entrega"], "fecha_entrega": e.get("fecha_entrega"),
                        "asignado": e.get("asignado_nombre"), "progreso": e.get("progreso"),
                        "ultima_novedad": last.get("accion")}
                if is_staff(user):
                    info.update({"total": e.get("precio"), "abonado": e["abonado"], "saldo": e["saldo"]})
                return info
            if name == "registrar_abono":
                if not is_staff(user):
                    return {"error": "Solo ventas o admin registran abonos"}
                r = await op_add_abono(o["id"], float(args["monto"]), args.get("nota", ""), user)
                return {"ok": True, "pedido": r["cliente"], "abonado": r["abonado"], "saldo": r["saldo"]}
            if not can_work_on(user, o):
                return {"error": "Ese pedido no está asignado a ti ni a tu departamento"}
            update = {}
            if args.get("etapa"): update["stage"] = args["etapa"]
            if args.get("progreso") is not None: update["progreso"] = max(0, min(100, int(args["progreso"])))
            if args.get("fecha_entrega"): update["fecha_entrega"] = args["fecha_entrega"]
            if args.get("asignar_a"): update["asignado_a"] = (await find_user(args["asignar_a"]))["id"]
            r = await op_update_order(o["id"], update, user) if update else enrich_order(o)
            if args.get("nota"):
                await db.orders.update_one({"id": o["id"]}, {"$push": {"historial": {
                    "id": new_id(), "fecha": now_iso(), "usuario": user["name"], "usuario_id": user["id"],
                    "accion": args["nota"]}}})
            return {"ok": True, "pedido": r["cliente"], "etapa": r["stage"], "asignado": r.get("asignado_nombre"),
                    "progreso": r.get("progreso"),
                    "alerta_saldo_pendiente": r["saldo"] if r["stage"] == "Terminado" and r["saldo"] > 0 else None}
        return {"error": "Herramienta desconocida"}
    except HTTPException as e:
        return {"error": e.detail}

def action_note(actions):
    if not actions: return ""
    done = "; ".join(f"{a['tool']} {json.dumps(a['result'], ensure_ascii=False, default=str)}" for a in actions)
    return f"\n[ACCIONES YA EJECUTADAS EN ESTE TURNO: {done}]"

async def build_context(user, tz) -> str:
    orders = [enrich_order(o) for o in await db.orders.find({}, {"_id": 0}).sort("fecha_entrega", 1).to_list(300)]
    tasks = await db.tasks.find({**task_query(user), "completada": False}, {"_id": 0}).to_list(100)
    users = await db.users.find({"activo": {"$ne": False}}, {"_id": 0, "password": 0}).to_list(200)
    now_local = datetime.now(timezone.utc).astimezone(tz)
    active = [o for o in orders if o.get("stage") != "Terminado"]
    lines = [
        f"Ahora: {now_local.strftime('%A %Y-%m-%d %H:%M')} (zona {tz.key})",
        f"Usuario: {user['name']} | rol: {user.get('role')} | depto: {user.get('departamento') or '—'}",
        f"Pedidos activos: {len(active)} | atrasados: {sum(o['estado_entrega'] == 'atrasado' for o in active)} | "
        f"por vencer: {sum(o['estado_entrega'] == 'por_vencer' for o in active)}",
        "", "EQUIPO:"]
    lines += [f"- {u['name']} ({u.get('role')})" for u in users]
    lines += ["", "PEDIDOS ACTIVOS:"]
    for o in active[:80]:
        pago = f"saldo ${o['saldo']}" if is_staff(user) else ""
        lines.append(f"- [{o['stage']}] {o['cliente']}: {o['descripcion']} | entrega {o.get('fecha_entrega') or 'sin fecha'} | asignado: {o.get('asignado_nombre') or '—'} {pago}")
    lines += ["", "TAREAS PENDIENTES:"]
    lines += [f"- {t['titulo']} - {t.get('fecha') or 'sin fecha'}" for t in tasks]
    if is_staff(user):
        lines += ["", "CLIENTES (notas):"]
        for c in await db.clients.find({}, {"_id": 0}).sort("nombre", 1).to_list(150):
            notas = "; ".join(n["texto"] for n in c.get("notas_importantes") or [])
            lines.append(f"- {c['nombre']} tel {c.get('telefono') or '—'} | {notas if notas else 'sin notas'}")
    return "\n".join(lines)

JARVIS_SYSTEM = """Eres JARVIS, el asistente de inteligencia artificial 24/7 de la joyería "Mundo de Joyas".
Hablas SIEMPRE en español, elegante y profesional. Eres secretaria y jefe de producción.
- Alertas proactivamente sobre pedidos ATRASADOS o POR VENCER.
- EJECUTAS acciones usando tus herramientas cuando te lo piden.
- Tus respuestas se leen en voz alta: sé breve (2-4 frases), sin markdown, sin emojis.
Departamentos: Ventas, Diseño 3D, Ceras, Inyección, Vulcanizado, Casting, Fabricación, Grabado Láser, Reparaciones, Importación de máquinas, Terminado."""

async def jarvis_stream(user, message, session_id, tz_name, extra=""):
    try:
        tz = ZoneInfo(tz_name or "UTC")
    except Exception:
        tz = ZoneInfo("UTC")
        
    system = JARVIS_SYSTEM + extra + "\n\n=== DATOS EN VIVO ===\n" + await build_context(user, tz)
    
    past = await db.chat_messages.find({"user_id": user["id"], "session_id": session_id},
                                       {"_id": 0, "role": 1, "content": 1}).sort("created_at", 1).to_list(40)
                                       
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    
    # FIX CRÍTICO: Gemini requiere que los roles alternen (user, model, user, model)
    gemini_history = []
    for m in past[-20:]:
        role = "user" if m["role"] == "user" else "model"
        if gemini_history and gemini_history[-1]["role"] == role:
            # Si hay dos seguidos del mismo rol, los juntamos en un solo mensaje
            gemini_history[-1]["parts"][0]["text"] += "\n" + m["content"]
        else:
            gemini_history.append({"role": role, "parts": [{"text": m["content"]}]})
        
    try:
        chat = client.chats.create(
            model="gemini-1.5-flash",
            history=gemini_history,
            config={'system_instruction': system}
        )
        
        response = chat.send_message(message)
        full_text = response.text
        
        yield f"data: {json.dumps({'type': 'delta', 'content': full_text})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        
        await db.chat_messages.insert_many([
            {"id": new_id(), "user_id": user["id"], "session_id": session_id, "role": "user",
             "content": message, "created_at": now_iso()},
            {"id": new_id(), "user_id": user["id"], "session_id": session_id, "role": "assistant",
             "content": full_text, "created_at": now_iso()}])
             
    except Exception as e:
        logger.error(f"Error en Gemini: {e}")
        # ALERTA: Ahora el error real se mostrará en la pantalla para saber qué pasa
        yield f"data: {json.dumps({'type': 'delta', 'content': f'⚠️ ERROR DE GOOGLE: {str(e)}'})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

@router.post("/chat")
async def chat_endpoint(payload: ChatIn, user=Depends(current_user)):
    session_id = payload.session_id or new_id()
    return StreamingResponse(jarvis_stream(user, payload.message, session_id, payload.tz), media_type="text/plain",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "X-Session-Id": session_id})

# ---------- Siri / Apple Shortcuts ----------
SIRI_EXTRA = "\nESTÁS RESPONDIENDO A TRAVÉS DE SIRI: responde en 1-2 frases cortas."

class SiriIn(BaseModel):
    key: str
    texto: str
    tz: Optional[str] = None

async def user_siri_key(user_id, regenerate=False):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "siri_key": 1})
    key = u.get("siri_key")
    if regenerate or not key:
        key = "jv_" + new_id().replace("-", "")
        await db.users.update_one({"id": user_id}, {"$set": {"siri_key": key}})
    return key

@router.get("/me/siri")
async def my_siri(user=Depends(current_user)):
    return {"key": await user_siri_key(user["id"]), "path": "/api/siri"}

@router.post("/me/siri/regenerate")
async def regenerate_siri(user=Depends(current_user)):
    return {"key": await user_siri_key(user["id"], regenerate=True), "path": "/api/siri"}

@router.post("/siri")
async def siri(payload: SiriIn):
    user = await db.users.find_one({"siri_key": payload.key, "activo": {"$ne": False}}, {"_id": 0, "password": 0})
    if not user:
        return Response("Clave de Jarvis inválida.", media_type="text/plain; charset=utf-8", status_code=401)
    if not payload.texto.strip():
        return Response("No escuché ningún comando.", media_type="text/plain; charset=utf-8")
    tz = payload.tz or user.get("tz") or "America/Mexico_City"
    session_id = f"siri-{user['id']}-{datetime.now(timezone.utc).strftime('%Y%m%d')}"
    chunks = [c async for c in jarvis_stream(user, payload.texto, session_id, tz, SIRI_EXTRA)]
    text = "".join(chunks).split(ACTION_MARK)[0].strip() or "Listo."
    return Response(text, media_type="text/plain; charset=utf-8")

@router.post("/tts")
async def tts(payload: TTSIn, user=Depends(current_user)):
    raise HTTPException(status_code=503, detail="La función de voz está desactivada temporalmente")