# Iteration 4: Jarvis chat reads client notes (consultar_cliente), adds notes (agregar_nota_cliente), knows low inventory
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@joyeria.com", "password": "joyeria123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def chat(h, msg):
    r = requests.post(f"{API}/chat", headers=h, json={"message": msg, "session_id": f"test-{uuid.uuid4().hex}",
                                                       "tz": "America/Mexico_City"}, timeout=120)
    assert r.status_code == 200
    print(msg, "->", r.text[:600])
    return r.text


def test_reads_client_note(admin):
    c = requests.post(f"{API}/clients", headers=admin, json={"nombre": "TEST_Lucia Ramos", "telefono": "5215550001"}).json()
    try:
        requests.post(f"{API}/clients/{c['id']}/notas", headers=admin, json={"texto": "Alergia al níquel"})
        t = chat(admin, "¿Qué debo saber de TEST_Lucia Ramos?").lower()
        assert "níquel" in t or "niquel" in t
    finally:
        requests.delete(f"{API}/clients/{c['id']}", headers=admin)


def test_adds_client_note(admin):
    c = requests.post(f"{API}/clients", headers=admin, json={"nombre": "TEST_Mario Gil"}).json()
    try:
        chat(admin, "Anota que TEST_Mario Gil prefiere estilo minimalista")
        p = requests.get(f"{API}/clients/{c['id']}", headers=admin).json()
        assert any("minimalista" in n["texto"].lower() for n in p["notas_importantes"]), p["notas_importantes"]
    finally:
        requests.delete(f"{API}/clients/{c['id']}", headers=admin)


def test_knows_low_inventory(admin):
    m = requests.post(f"{API}/inventory", headers=admin,
                      json={"nombre": "TEST_Cera Azul", "unidad": "g", "cantidad": 1, "minimo": 50}).json()
    try:
        t = chat(admin, "¿Qué materiales del inventario están bajos de stock?").lower()
        assert "cera azul" in t
    finally:
        requests.delete(f"{API}/inventory/{m['id']}", headers=admin)
