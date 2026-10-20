# Iteration 4: Siri endpoint, inventory, clients profile/notes, stats charts, Terminado saldo historial
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
SIRI_TIMEOUT = 120


def H(t):
    return {"Authorization": f"Bearer {t}"}


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin():
    return login("admin@joyeria.com", "joyeria123")


@pytest.fixture(scope="module")
def worker():
    return login("carlos@joyeria.com", "taller123")


def find_orders(tok, name):
    r = requests.get(f"{API}/orders", headers=H(tok))
    assert r.status_code == 200
    return [o for o in r.json() if name.lower() in (o.get("cliente") or "").lower()]


# ---------- Inventory ----------
class TestInventory:
    def test_crud_and_bajo(self, admin, worker):
        r = requests.post(f"{API}/inventory", headers=H(admin),
                          json={"nombre": "TEST_Plata", "unidad": "g", "cantidad": 10, "minimo": 5})
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["bajo"] is False and m["cantidad"] == 10
        mid = m["id"]
        try:
            # invalid unit
            r = requests.post(f"{API}/inventory", headers=H(admin), json={"nombre": "TEST_x", "unidad": "lb"})
            assert r.status_code == 400
            # worker cannot create
            r = requests.post(f"{API}/inventory", headers=H(worker), json={"nombre": "TEST_w", "unidad": "g"})
            assert r.status_code == 403
            # worker can list
            r = requests.get(f"{API}/inventory", headers=H(worker))
            assert r.status_code == 200 and any(x["id"] == mid for x in r.json())
            # patch minimo -> bajo
            r = requests.patch(f"{API}/inventory/{mid}", headers=H(admin), json={"minimo": 10})
            assert r.status_code == 200 and r.json()["bajo"] is True
            # ajuste
            r = requests.post(f"{API}/inventory/{mid}/ajuste", headers=H(admin), json={"cantidad": 5, "motivo": "Compra"})
            assert r.status_code == 200 and r.json()["cantidad"] == 15 and r.json()["bajo"] is False
            r = requests.post(f"{API}/inventory/{mid}/ajuste", headers=H(admin), json={"cantidad": -100})
            assert r.status_code == 400
            r = requests.get(f"{API}/inventory/{mid}/movimientos", headers=H(admin))
            assert r.status_code == 200
            moves = r.json()
            assert len(moves) == 2 and moves[0]["delta"] == 5
        finally:
            r = requests.delete(f"{API}/inventory/{mid}", headers=H(admin))
            assert r.status_code == 200
            assert requests.delete(f"{API}/inventory/{mid}", headers=H(admin)).status_code == 404

    def test_consume(self, admin):
        m = requests.post(f"{API}/inventory", headers=H(admin),
                          json={"nombre": "TEST_Oro", "unidad": "g", "cantidad": 10, "minimo": 2}).json()
        o = requests.post(f"{API}/orders", headers=H(admin),
                          json={"cliente": "TEST_Consume", "descripcion": "anillo", "precio": 100}).json()
        try:
            r = requests.post(f"{API}/inventory/consume", headers=H(admin),
                              json={"order_id": o["id"], "items": [{"material_id": m["id"], "cantidad": 50}]})
            assert r.status_code == 400
            inv = [x for x in requests.get(f"{API}/inventory", headers=H(admin)).json() if x["id"] == m["id"]][0]
            assert inv["cantidad"] == 10
            r = requests.post(f"{API}/inventory/consume", headers=H(admin),
                              json={"order_id": o["id"], "items": [{"material_id": m["id"], "cantidad": 3.5}]})
            assert r.status_code == 200, r.text
            assert r.json()["materiales"][0]["cantidad"] == 6.5
            od = [x for x in requests.get(f"{API}/orders", headers=H(admin)).json() if x["id"] == o["id"]][0]
            assert any("Descontó del inventario" in h["accion"] for h in od["historial"])
            r = requests.post(f"{API}/inventory/consume", headers=H(admin),
                              json={"order_id": "nope", "items": [{"material_id": m["id"], "cantidad": 1}]})
            assert r.status_code == 404
        finally:
            requests.delete(f"{API}/inventory/{m['id']}", headers=H(admin))
            requests.delete(f"{API}/orders/{o['id']}", headers=H(admin))


# ---------- Orders: Terminado saldo / anticipo ----------
class TestTerminadoSaldo:
    def test_terminado_with_saldo_logs(self, admin):
        o = requests.post(f"{API}/orders", headers=H(admin),
                          json={"cliente": "TEST_Saldo", "descripcion": "aretes", "precio": 200}).json()
        try:
            r = requests.post(f"{API}/orders/{o['id']}/abonos", headers=H(admin), json={"monto": 50, "nota": "Anticipo"})
            assert r.status_code == 200 and r.json()["saldo"] == 150
            r = requests.patch(f"{API}/orders/{o['id']}", headers=H(admin), json={"stage": "Terminado"})
            assert r.status_code == 200
            od = r.json()
            assert od["stage"] == "Terminado"
            assert any("SALDO PENDIENTE" in h["accion"] for h in od["historial"])
        finally:
            requests.delete(f"{API}/orders/{o['id']}", headers=H(admin))


# ---------- Clients ----------
class TestClients:
    def test_profile_notes_birthday(self, admin, worker):
        c = requests.post(f"{API}/clients", headers=H(admin), json={"nombre": "TEST_Cliente Perfil", "telefono": "+52 55 1234 5678"})
        assert c.status_code == 200, c.text
        cid = c.json()["id"]
        o = requests.post(f"{API}/orders", headers=H(admin),
                          json={"cliente": "test_cliente perfil", "descripcion": "dije", "precio": 300}).json()
        try:
            r = requests.get(f"{API}/clients/{cid}", headers=H(admin))
            assert r.status_code == 200
            p = r.json()
            assert any(x["id"] == o["id"] for x in p["pedidos"])
            assert p["total_gastado"] == 300 and p["saldo_pendiente"] == 300
            assert requests.get(f"{API}/clients/{cid}", headers=H(worker)).status_code == 403
            assert requests.get(f"{API}/clients/nope", headers=H(admin)).status_code == 404
            r = requests.patch(f"{API}/clients/{cid}", headers=H(admin), json={"cumpleanos": "31-12-1990"})
            assert r.status_code == 400
            from datetime import date, timedelta
            bd = (date.today() + timedelta(days=3)).replace(year=1990).isoformat()
            r = requests.patch(f"{API}/clients/{cid}", headers=H(admin), json={"cumpleanos": bd, "email": "a@b.com"})
            assert r.status_code == 200 and r.json()["dias_cumpleanos"] in (2, 3, 4)
            r = requests.get(f"{API}/clients-birthdays", headers=H(admin))
            assert r.status_code == 200 and any(x["id"] == cid for x in r.json())
            r = requests.post(f"{API}/clients/{cid}/notas", headers=H(admin), json={"texto": "TEST alergia al níquel"})
            assert r.status_code == 200
            notes = r.json()["notas_importantes"]
            assert len(notes) == 1 and notes[0]["texto"] == "TEST alergia al níquel"
            assert requests.post(f"{API}/clients/{cid}/notas", headers=H(admin), json={"texto": ""}).status_code == 422
            r = requests.delete(f"{API}/clients/{cid}/notas/{notes[0]['id']}", headers=H(admin))
            assert r.status_code == 200 and r.json()["notas_importantes"] == []
        finally:
            requests.delete(f"{API}/orders/{o['id']}", headers=H(admin))
            requests.delete(f"{API}/clients/{cid}", headers=H(admin))


# ---------- Stats charts ----------
class TestCharts:
    def test_charts_admin(self, admin):
        r = requests.get(f"{API}/stats/charts", headers=H(admin))
        assert r.status_code == 200
        d = r.json()
        assert len(d["ingresos"]) == 12 and {"mes", "ventas", "cobrado"} <= set(d["ingresos"][0])
        assert all({"stage", "total"} <= set(e) for e in d["etapas"])

    def test_charts_worker(self, worker):
        d = requests.get(f"{API}/stats/charts", headers=H(worker)).json()
        assert d["ingresos"] is None and isinstance(d["etapas"], list)


# ---------- Siri ----------
class TestSiri:
    def test_key_and_regenerate(self, admin):
        r = requests.get(f"{API}/me/siri", headers=H(admin))
        assert r.status_code == 200
        k1 = r.json()["key"]
        assert r.json()["path"] == "/api/siri" and k1.startswith("jv_")
        assert requests.get(f"{API}/me/siri", headers=H(admin)).json()["key"] == k1
        k2 = requests.post(f"{API}/me/siri/regenerate", headers=H(admin)).json()["key"]
        assert k2 != k1
        r = requests.post(f"{API}/siri", json={"key": k1, "texto": "hola"})
        assert r.status_code == 401 and "inválida" in r.text
        r = requests.post(f"{API}/siri", json={"key": k2, "texto": "   "})
        assert r.status_code == 200 and "No escuché" in r.text

    def test_siri_flow(self, admin):
        key = requests.get(f"{API}/me/siri", headers=H(admin)).json()["key"]
        try:
            r = requests.post(f"{API}/siri", json={"key": key, "tz": "America/Mexico_City",
                              "texto": "Pedido rápido para TEST_Siri Cliente, un dije de luna en plata"}, timeout=SIRI_TIMEOUT)
            print("CREATE:", r.text)
            assert r.status_code == 200 and "text/plain" in r.headers["content-type"]
            os_ = find_orders(admin, "TEST_Siri Cliente")
            assert len(os_) == 1 and os_[0]["stage"] == "Ventas"
            oid = os_[0]["id"]
            requests.patch(f"{API}/orders/{oid}", headers=H(admin), json={"precio": 500})
            r = requests.post(f"{API}/siri", json={"key": key, "tz": "America/Mexico_City",
                              "texto": "Mueve el pedido de TEST_Siri Cliente a Terminado"}, timeout=SIRI_TIMEOUT)
            print("MOVE:", r.text)
            assert r.status_code == 200
            o = [x for x in find_orders(admin, "TEST_Siri Cliente") if x["id"] == oid][0]
            assert o["stage"] == "Terminado"
            assert "saldo" in r.text.lower() or "500" in r.text or "debe" in r.text.lower()
            r = requests.post(f"{API}/siri", json={"key": key, "tz": "America/Mexico_City",
                              "texto": "¿Cómo va el pedido de TEST_Siri Cliente?"}, timeout=SIRI_TIMEOUT)
            print("STATUS:", r.text)
            assert r.status_code == 200 and "termin" in r.text.lower()
        finally:
            for o in find_orders(admin, "TEST_Siri"):
                requests.delete(f"{API}/orders/{o['id']}", headers=H(admin))

    def test_siri_worker_cannot_create(self, worker, admin):
        key = requests.get(f"{API}/me/siri", headers=H(worker)).json()["key"]
        try:
            r = requests.post(f"{API}/siri", json={"key": key,
                              "texto": "Pedido rápido para TEST_SiriWorker, un anillo de oro"}, timeout=SIRI_TIMEOUT)
            print("WORKER:", r.text)
            assert r.status_code == 200
            assert find_orders(admin, "TEST_SiriWorker") == []
        finally:
            for o in find_orders(admin, "TEST_SiriWorker"):
                requests.delete(f"{API}/orders/{o['id']}", headers=H(admin))
