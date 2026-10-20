# Iteration 3: Jarvis tool-calling + no re-execution on follow-up (slow, LLM)
import os
import json
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MARK = "\u0001"


@pytest.fixture(scope="module")
def h():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@joyeria.com", "password": "joyeria123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def order(h):
    name = f"TESTZ{uuid.uuid4().hex[:5]}"
    o = requests.post(f"{API}/orders", json={"cliente": name, "descripcion": "Pulsera oro", "precio": 1000}, headers=h).json()
    yield o
    requests.delete(f"{API}/orders/{o['id']}", headers=h)


def chat(h, msg, sid):
    r = requests.post(f"{API}/chat", json={"message": msg, "session_id": sid, "tz": "America/Mexico_City"},
                      headers=h, timeout=150)
    assert r.status_code == 200
    text = r.text
    actions = json.loads(text.split(MARK, 1)[1]) if MARK in text else []
    print("\nREPLY:", text.split(MARK)[0][:300], "\nACTIONS:", actions)
    return text, actions


def get(h, oid):
    return next(o for o in requests.get(f"{API}/orders", headers=h).json() if o["id"] == oid)


def test_abono_then_followup_no_duplicate(h, order):
    sid = f"test-{uuid.uuid4().hex[:8]}"
    _, acts = chat(h, f"Registra un abono de 100 al pedido de {order['cliente']}", sid)
    assert any(a["tool"] == "registrar_abono" for a in acts)
    assert get(h, order["id"])["abonado"] == 100
    _, acts2 = chat(h, f"¿Cuánto debe ahora {order['cliente']}?", sid)
    assert not any(a["tool"] == "registrar_abono" for a in acts2)
    assert get(h, order["id"])["abonado"] == 100


def test_move_stage(h, order):
    sid = f"test-{uuid.uuid4().hex[:8]}"
    _, acts = chat(h, f"Mueve el pedido de {order['cliente']} a Casting", sid)
    assert any(a["tool"] == "actualizar_pedido" for a in acts)
    assert get(h, order["id"])["stage"] == "Casting"
    _, acts2 = chat(h, "Gracias, ¿en qué etapa quedó?", sid)
    assert not acts2


def test_reminder_creates_task(h):
    sid = f"test-{uuid.uuid4().hex[:8]}"
    _, acts = chat(h, "Recuérdame mañana a las 10 llamar a proveedor TESTPROV", sid)
    assert any(a["tool"] == "crear_tarea" and a["result"].get("ok") for a in acts)
    tasks = [t for t in requests.get(f"{API}/tasks", headers=h).json() if "TESTPROV" in t["titulo"].upper()
             or "proveedor" in t["titulo"].lower()]
    assert tasks and tasks[-1].get("fecha")
    print("TASK:", tasks[-1])
    for t in tasks:
        if "TESTPROV" in t["titulo"].upper():
            requests.delete(f"{API}/tasks/{t['id']}", headers=h)
