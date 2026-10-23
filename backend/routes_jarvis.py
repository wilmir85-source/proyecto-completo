import json
import unicodedata
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from groq import Groq
from tavily import TavilyClient
import os
import io

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

class SiriIn(BaseModel):
    key: str
    texto: str
    tz: Optional[str] = None

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
    if not name: return None
    q = norm(name)
    for u in await db.users.find({"activo": {"$ne": False}}, {"_id": 0, "password": 0}).to_list(500):
        if q in norm(u["name"]) or q == norm(u["email"]):
            return u
    raise HTTPException(400, f"No encontré al trabajador '{name}'")

async def find_client(name):
    q = norm(name)
    for c in await db.clients.find({}, {"_id": 0, "id": 1, "nombre": 1}).to_list(5000):
        if q in norm(c["nombre"]):
            return c
    return None

TOOLS = [
    {"type": "function", "function": {
        "name": "buscar_en_internet",
        "description": "Busca información actualizada en internet. Úsala para precios del oro, tendencias de joyería, noticias, o cualquier dato en tiempo real.",
        "parameters": {"type": "object", "properties": {
            "consulta": {"type": "string", "description": "La búsqueda a realizar, ej: 'precio del oro hoy en Guatemala por gramo'"}},
            "required": ["consulta"]}}},
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
            "pedido": {"type": "string"}, "etapa": {"type": "string", "enum":