# Iteration 6: business settings/logo, share order public tracking, client VIP, order tipo, new stage
import io
import os
import uuid
import pytest
import requests
from PIL import Image
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]


def png_bytes(color=(200, 150, 20)):
    buf = io.BytesIO()
    Image.new("RGB", (300, 300), color).save(buf, "PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def admin():
    return login("admin@joyeria.com", "joyeria123")


@pytest.fixture(scope="module")
def worker():
    return login("carlos@joyeria.com", "taller123")


@pytest.fixture(scope="module")
def ventas():
    email = f"test_ventas_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"name": "TEST_Ventas", "email": email, "password": "test12345", "departamento": "Ventas"})
    assert r.status_code == 200, r.text
    yield login(email, "test12345")
    mc = MongoClient("mongodb://localhost:27017")
    mc["test_database"].users.delete_many({"email": email})


@pytest.fixture(scope="module")
def created(admin):
    ids = {"orders": [], "clients": []}
    yield ids
    for i in ids["orders"]:
        requests.delete(f"{API}/orders/{i}", headers=admin[0])
    for i in ids["clients"]:
        requests.delete(f"{API}/clients/{i}", headers=admin[0])


def mk_order(admin, created, **kw):
    body = {"cliente": "TEST_Lucia Ramos", "descripcion": "TEST collar", "telefono_cliente": "5511112222", "precio": 1000, **kw}
    r = requests.post(f"{API}/orders", json=body, headers=admin[0])
    assert r.status_code == 200, r.text
    created["orders"].append(r.json()["id"])
    return r.json()


# ---------- Settings / logo ----------
class TestSettings:
    def test_public_settings(self):
        r = requests.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        assert d["nombre"] == "Mundo de Joyas"
        assert "has_logo" in d and isinstance(d["has_logo"], bool)

    def test_patch_forbidden_non_admin(self, worker, ventas):
        assert requests.patch(f"{API}/settings", json={"nombre": "X"}, headers=worker[0]).status_code == 403
        assert requests.patch(f"{API}/settings", json={"nombre": "X"}, headers=ventas[0]).status_code == 403
        assert requests.patch(f"{API}/settings", json={"nombre": "X"}).status_code in (401, 403)

    def test_patch_admin_and_restore(self, admin):
        r = requests.patch(f"{API}/settings", json={"nombre": "TEST_Joyas", "telefono": "+52 55 1234 5678"}, headers=admin[0])
        assert r.status_code == 200 and r.json()["nombre"] == "TEST_Joyas"
        assert requests.get(f"{API}/settings").json()["telefono"] == "+52 55 1234 5678"
        r = requests.patch(f"{API}/settings", json={"nombre": "Mundo de Joyas", "telefono": "", "direccion": ""}, headers=admin[0])
        assert r.json()["nombre"] == "Mundo de Joyas" and r.json()["telefono"] == ""

    def test_logo_flow(self, admin, worker):
        default = requests.get(f"{API}/public/logo")
        assert default.status_code == 200 and default.headers["content-type"].startswith("image/")
        files = {"file": ("logo.png", png_bytes(), "image/png")}
        assert requests.post(f"{API}/settings/logo", files=files, headers=worker[0]).status_code == 403
        bad = requests.post(f"{API}/settings/logo", files={"file": ("a.txt", b"hello", "text/plain")}, headers=admin[0])
        assert bad.status_code == 400
        r = requests.post(f"{API}/settings/logo", files={"file": ("logo.png", png_bytes(), "image/png")}, headers=admin[0])
        assert r.status_code == 200, r.text
        assert r.json()["has_logo"] is True
        img = requests.get(f"{API}/public/logo")
        assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg"
        assert img.content != default.content
        d = requests.delete(f"{API}/settings/logo", headers=admin[0])
        assert d.status_code == 200 and d.json()["has_logo"] is False
        after = requests.get(f"{API}/public/logo")
        assert after.status_code == 200 and after.content == default.content


# ---------- Order tipo & stages ----------
class TestTipoStage:
    def test_create_with_tipo_and_new_stage(self, admin, created):
        o = mk_order(admin, created, tipo="Importación de máquinas", stage="Importación de máquinas")
        assert o["tipo"] == "Importación de máquinas" and o["stage"] == "Importación de máquinas"
        r = requests.patch(f"{API}/orders/{o['id']}", json={"tipo": "Diseño"}, headers=admin[0])
        assert r.status_code == 200 and r.json()["tipo"] == "Diseño"

    def test_default_tipo(self, admin, created):
        o = mk_order(admin, created)
        assert o["tipo"] == "Fabricación"

    def test_invalid_stage(self, admin, created):
        r = requests.post(f"{API}/orders", json={"cliente": "TEST_x", "descripcion": "x", "stage": "Nope"}, headers=admin[0])
        assert r.status_code == 400

    def test_invalid_tipo_rejected(self, admin, created):
        r = requests.post(f"{API}/orders", json={"cliente": "TEST_x", "descripcion": "x", "tipo": "Basura"}, headers=admin[0])
        if r.status_code == 200:
            created["orders"].append(r.json()["id"])
        assert r.status_code == 400, f"tipo not validated against ORDER_TYPES (got {r.status_code})"

    def test_worker_cannot_change_tipo(self, worker, admin, created):
        o = mk_order(admin, created, stage=worker[1].get("departamento") or "Casting")
        r = requests.patch(f"{API}/orders/{o['id']}", json={"tipo": "Otro"}, headers=worker[0])
        assert r.status_code == 403
        r = requests.patch(f"{API}/orders/{o['id']}", json={"stage": "Fabricación"}, headers=worker[0])
        assert r.status_code == 200 and r.json()["stage"] == "Fabricación"


# ---------- Share / public tracking ----------
class TestShare:
    def test_share_permissions(self, admin, worker, ventas, created):
        o = mk_order(admin, created)
        assert requests.post(f"{API}/orders/{o['id']}/share", headers=worker[0]).status_code == 403
        assert requests.post(f"{API}/orders/nonexistent-id/share", headers=admin[0]).status_code == 404
        r = requests.post(f"{API}/orders/{o['id']}/share", headers=ventas[0])
        assert r.status_code == 200

    def test_share_stable_and_public(self, admin, created):
        o = mk_order(admin, created, tipo="Diseño", fecha_entrega="2030-01-15T12:00:00Z", metal="Oro 14k")
        requests.post(f"{API}/orders/{o['id']}/abonos", json={"monto": 300}, headers=admin[0])
        t1 = requests.post(f"{API}/orders/{o['id']}/share", headers=admin[0]).json()
        t2 = requests.post(f"{API}/orders/{o['id']}/share", headers=admin[0]).json()
        assert t1["token"] == t2["token"] and t1["path"] == f"/seguimiento/{t1['token']}"
        r = requests.get(f"{API}/public/orders/{t1['token']}")
        assert r.status_code == 200
        d = r.json()
        assert d["cliente"] == "TEST_Lucia"
        assert d["descripcion"] == "TEST collar" and d["tipo"] == "Diseño" and d["stage"] == "Ventas"
        assert isinstance(d["flujo"], list) and "Terminado" in d["flujo"]
        assert d["precio"] == 1000 and d["abonado"] == 300 and d["saldo"] == 700 and d["estado_pago"] == "debe"
        assert d["fotos"] == 0 and d["estado_entrega"] == "a_tiempo" and d["vip"] is False
        flat = str(d)
        for leak in ("5511112222", o["id"], "historial", "asignado", "abonos", "notas", "share_token"):
            assert leak not in flat, f"leaks {leak}"
        assert requests.get(f"{API}/public/orders/{t1['token']}/foto/0").status_code == 404
        assert requests.get(f"{API}/public/orders/badtoken123").status_code == 404

    def test_public_photo(self, admin, created):
        o = mk_order(admin, created)
        files = {"file": ("p.png", png_bytes((10, 20, 200)), "image/png")}
        up = requests.post(f"{API}/orders/{o['id']}/photos", files=files, headers=admin[0])
        assert up.status_code == 200, up.text
        tok = requests.post(f"{API}/orders/{o['id']}/share", headers=admin[0]).json()["token"]
        assert requests.get(f"{API}/public/orders/{tok}").json()["fotos"] == 1
        p = requests.get(f"{API}/public/orders/{tok}/foto/0")
        assert p.status_code == 200 and p.headers["content-type"].startswith("image/")
        assert requests.get(f"{API}/public/orders/{tok}/foto/1").status_code == 404

    def test_stage_custom_flow(self, admin, created):
        o = mk_order(admin, created, stage="Importación de máquinas")
        tok = requests.post(f"{API}/orders/{o['id']}/share", headers=admin[0]).json()["token"]
        d = requests.get(f"{API}/public/orders/{tok}").json()
        assert "Importación de máquinas" in d["flujo"] and d["flujo"][-1] == "Terminado"

    def test_existing_ana_token(self):
        p = os.path.join(os.path.dirname(__file__), ".share_token")
        if not os.path.exists(p):
            pytest.skip("no stored token")
        tok = open(p).read().strip()
        r = requests.get(f"{API}/public/orders/{tok}")
        assert r.status_code == 200
        assert r.json()["cliente"] == "Ana" and r.json()["vip"] is True


# ---------- VIP ----------
class TestVip:
    def test_vip_by_id_and_by_name(self, admin, created):
        c = requests.post(f"{API}/clients", json={"nombre": "TEST_Vip Persona", "telefono": "5599990000"}, headers=admin[0])
        assert c.status_code == 200, c.text
        cid = c.json()["id"]
        created["clients"].append(cid)
        r = requests.patch(f"{API}/clients/{cid}", json={"vip": True}, headers=admin[0])
        assert r.status_code == 200 and r.json()["vip"] is True
        o1 = mk_order(admin, created, cliente="TEST_Vip Persona", cliente_id=cid)
        o2 = mk_order(admin, created, cliente="test_vip persona")
        for o in (o1, o2):
            tok = requests.post(f"{API}/orders/{o['id']}/share", headers=admin[0]).json()["token"]
            assert requests.get(f"{API}/public/orders/{tok}").json()["vip"] is True
        requests.patch(f"{API}/clients/{cid}", json={"vip": False}, headers=admin[0])
        tok = requests.post(f"{API}/orders/{o1['id']}/share", headers=admin[0]).json()["token"]
        assert requests.get(f"{API}/public/orders/{tok}").json()["vip"] is False

    def test_regex_chars_in_name(self, admin, created):
        o = mk_order(admin, created, cliente="TEST_(Paren [x] +")
        tok = requests.post(f"{API}/orders/{o['id']}/share", headers=admin[0]).json()["token"]
        r = requests.get(f"{API}/public/orders/{tok}")
        assert r.status_code == 200


# ---------- PDF ----------
class TestPdf:
    def test_pdf_contains_name_and_tipo(self, admin, created):
        o = mk_order(admin, created, tipo="Grabado")
        r = requests.get(f"{API}/orders/{o['id']}/pdf", headers=admin[0])
        assert r.status_code == 200 and r.content[:4] == b"%PDF"
        try:
            from pypdf import PdfReader
        except ImportError:
            pytest.skip("pypdf missing")
        text = "".join(p.extract_text() for p in PdfReader(io.BytesIO(r.content)).pages)
        assert "Mundo de Joyas" in text and "Grabado" in text
