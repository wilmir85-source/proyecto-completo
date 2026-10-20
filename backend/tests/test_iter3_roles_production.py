# Iteration 3: multi-user roles, permissions, assignment, due status, payments, production, calendar, tasks
import os
import uuid
from datetime import datetime, timezone, timedelta
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def iso(delta_hours):
    return (datetime.now(timezone.utc) + timedelta(hours=delta_hours)).isoformat()


def H(t):
    return {"Authorization": f"Bearer {t}"}


def register(dept, name="TEST_user"):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "taller123", "name": name,
                                                       "departamento": dept, "telefono": "5551234"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "email": email}


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@joyeria.com", "password": "joyeria123"})
    if r.status_code != 200:
        pytest.skip("admin login failed")
    return r.json()


@pytest.fixture(scope="module")
def worker():
    return register("Casting", "TEST_Worker Casting")


@pytest.fixture(scope="module")
def seller():
    return register("Ventas", "TEST_Seller")


@pytest.fixture(scope="module")
def orders(admin):
    created = []
    yield created
    for oid in created:
        requests.delete(f"{API}/orders/{oid}", headers=H(admin["token"]))


def mk(admin, orders, **kw):
    payload = {"cliente": "TEST_Cliente", "descripcion": "Anillo test", "precio": 1000, **kw}
    r = requests.post(f"{API}/orders", json=payload, headers=H(admin["token"]))
    assert r.status_code == 200, r.text
    o = r.json()
    orders.append(o["id"])
    return o


# --- Auth / roles ---
class TestAuth:
    def test_admin_login(self, admin):
        assert admin["user"]["role"] == "admin"

    def test_register_roles(self, worker, seller):
        assert worker["user"]["role"] == "trabajador" and worker["user"]["departamento"] == "Casting"
        assert worker["user"]["telefono"] == "5551234"
        assert seller["user"]["role"] == "ventas"

    def test_register_invalid_dept(self):
        r = requests.post(f"{API}/auth/register", json={"email": f"test_{uuid.uuid4().hex[:6]}@example.com",
                                                           "password": "abcdef", "name": "x", "departamento": "Nope"})
        assert r.status_code == 400

    def test_carlos_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": "carlos@joyeria.com", "password": "taller123"})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "trabajador"

    def test_brute_force(self):
        email = f"test_bf_{uuid.uuid4().hex[:6]}@example.com"
        codes = [requests.post(f"{API}/auth/login", json={"email": email, "password": "bad"}).status_code for _ in range(6)]
        assert codes[:5] == [401] * 5 and codes[5] == 429, codes


# --- User admin ---
class TestUsers:
    def test_non_admin_patch_forbidden(self, worker, seller):
        r = requests.patch(f"{API}/users/{worker['user']['id']}", json={"role": "admin"}, headers=H(seller["token"]))
        assert r.status_code == 403

    def test_admin_cannot_demote_self(self, admin):
        r = requests.patch(f"{API}/users/{admin['user']['id']}", json={"role": "ventas"}, headers=H(admin["token"]))
        assert r.status_code == 400
        r = requests.patch(f"{API}/users/{admin['user']['id']}", json={"activo": False}, headers=H(admin["token"]))
        assert r.status_code == 400

    def test_deactivate_user(self, admin):
        u = register("Ceras", "TEST_Deact")
        r = requests.patch(f"{API}/users/{u['user']['id']}", json={"activo": False, "departamento": "Inyección"},
                           headers=H(admin["token"]))
        assert r.status_code == 200 and r.json()["activo"] is False and r.json()["departamento"] == "Inyección"
        r = requests.post(f"{API}/auth/login", json={"email": u["email"], "password": "taller123"})
        assert r.status_code == 403
        assert requests.get(f"{API}/auth/me", headers=H(u["token"])).status_code == 401


# --- Permissions & order work ---
class TestOrders:
    def test_worker_forbidden_staff_ops(self, admin, worker, orders):
        o = mk(admin, orders)
        wh = H(worker["token"])
        assert requests.post(f"{API}/orders", json={"cliente": "x", "descripcion": "y"}, headers=wh).status_code == 403
        assert requests.delete(f"{API}/orders/{o['id']}", headers=wh).status_code == 403
        assert requests.post(f"{API}/orders/{o['id']}/abonos", json={"monto": 10}, headers=wh).status_code == 403
        assert requests.post(f"{API}/clients", json={"nombre": "x"}, headers=wh).status_code == 403
        # not assigned, stage Ventas != Casting
        assert requests.patch(f"{API}/orders/{o['id']}", json={"progreso": 10}, headers=wh).status_code == 403

    def test_worker_dept_order(self, admin, worker, orders):
        o = mk(admin, orders, stage="Casting")
        wh = H(worker["token"])
        r = requests.patch(f"{API}/orders/{o['id']}", json={"progreso": 40, "notas": "ok"}, headers=wh)
        assert r.status_code == 200 and r.json()["progreso"] == 40
        r = requests.patch(f"{API}/orders/{o['id']}", json={"precio": 1}, headers=wh)
        assert r.status_code == 403
        mine = requests.get(f"{API}/orders?mine=true", headers=wh).json()
        assert o["id"] in [x["id"] for x in mine]

    def test_assignment_history_and_notes(self, admin, worker, orders):
        o = mk(admin, orders, stage="Ventas")
        r = requests.patch(f"{API}/orders/{o['id']}", json={"asignado_a": worker["user"]["id"]}, headers=H(admin["token"]))
        assert r.status_code == 200 and r.json()["asignado_nombre"] == "TEST_Worker Casting"
        wh = H(worker["token"])
        r = requests.patch(f"{API}/orders/{o['id']}", json={"stage": "Ceras", "progreso": 60}, headers=wh)
        assert r.status_code == 200
        r = requests.post(f"{API}/orders/{o['id']}/notas", json={"texto": "TEST bitacora"}, headers=wh)
        assert r.status_code == 200
        acc = [h["accion"] for h in r.json()["historial"]]
        assert any("Asignó" in a for a in acc) and any("Movió de Ventas a Ceras" in a for a in acc)
        assert any("Progreso 60%" in a for a in acc) and "TEST bitacora" in acc
        assert o["id"] in [x["id"] for x in requests.get(f"{API}/orders?mine=true", headers=wh).json()]

    def test_terminado_sets_100(self, admin, orders):
        o = mk(admin, orders)
        r = requests.patch(f"{API}/orders/{o['id']}", json={"stage": "Terminado"}, headers=H(admin["token"]))
        assert r.json()["progreso"] == 100 and r.json()["estado_entrega"] == "terminado"

    def test_estado_entrega(self, admin, orders):
        assert mk(admin, orders, fecha_entrega=iso(-5))["estado_entrega"] == "atrasado"
        assert mk(admin, orders, fecha_entrega=iso(24))["estado_entrega"] == "por_vencer"
        assert mk(admin, orders, fecha_entrega=iso(24 * 7))["estado_entrega"] == "a_tiempo"
        assert mk(admin, orders)["estado_entrega"] == "sin_fecha"

    def test_shared_data(self, admin, seller, orders):
        o = mk(admin, orders)
        ids = [x["id"] for x in requests.get(f"{API}/orders", headers=H(seller["token"])).json()]
        assert o["id"] in ids


# --- Payments ---
class TestPayments:
    def test_abonos_flow(self, admin, seller, orders):
        o = mk(admin, orders, precio=500)
        assert o["estado_pago"] == "debe" and o["saldo"] == 500
        r = requests.post(f"{API}/orders/{o['id']}/abonos", json={"monto": 200, "nota": "TEST"}, headers=H(seller["token"]))
        assert r.status_code == 200 and r.json()["abonado"] == 200 and r.json()["saldo"] == 300
        r = requests.post(f"{API}/orders/{o['id']}/abonos", json={"monto": 300}, headers=H(seller["token"]))
        d = r.json()
        assert d["estado_pago"] == "pagado" and d["saldo"] == 0
        r = requests.delete(f"{API}/orders/{o['id']}/abonos/{d['abonos'][1]['id']}", headers=H(admin["token"]))
        assert r.json()["abonado"] == 200 and r.json()["estado_pago"] == "debe"
        assert requests.post(f"{API}/orders/{o['id']}/abonos", json={"monto": 0}, headers=H(admin["token"])).status_code == 422
        assert mk(admin, orders, precio=0)["estado_pago"] == "sin_precio"

    def test_sales_summary(self, admin, worker):
        r = requests.get(f"{API}/sales/summary", headers=H(admin["token"]))
        assert r.status_code == 200
        for k in ("total_vendido", "total_abonado", "saldo_pendiente", "pedidos_con_deuda", "pedidos_pagados"):
            assert k in r.json()
        assert requests.get(f"{API}/sales/summary", headers=H(worker["token"])).status_code == 403


# --- Production ---
class TestProduction:
    def test_production(self, admin, worker, orders):
        o = mk(admin, orders, stage="Casting", fecha_entrega=iso(-2), asignado_a=worker["user"]["id"])
        d = requests.get(f"{API}/production", headers=H(worker["token"])).json()
        assert len(d["departamentos"]) == 10
        cast = next(x for x in d["departamentos"] if x["stage"] == "Casting")
        assert cast["atrasados"] >= 1 and "TEST_Worker Casting" in cast["trabajadores"]
        assert o["id"] in [p["id"] for p in cast["pedidos"]]
        w = next(x for x in d["trabajadores"] if x["id"] == worker["user"]["id"])
        assert w["asignados"] >= 1 and w["atrasados"] >= 1

    def test_stats(self, admin):
        d = requests.get(f"{API}/stats", headers=H(admin["token"])).json()
        assert len(d["pedidos_por_etapa"]) == 11 and "pedidos_atrasados" in d and "pedidos_por_vencer" in d


# --- Calendar ---
class TestCalendar:
    def test_ics(self, admin, worker, orders):
        mk(admin, orders, stage="Casting", fecha_entrega=iso(30))
        requests.post(f"{API}/tasks", json={"titulo": "TEST_cal task", "fecha": iso(5)}, headers=H(worker["token"]))
        p = requests.get(f"{API}/me/calendar", headers=H(worker["token"])).json()["path"]
        r = requests.get(f"{BASE_URL}{p}")
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/calendar")
        t = r.text
        assert t.startswith("BEGIN:VCALENDAR") and "END:VCALENDAR" in t
        assert "TEST_cal task" in t and "TRIGGER:-PT30M" in t
        assert "TRIGGER:-P1D" in t and "TRIGGER:-PT2H" in t
        assert requests.get(f"{API}/calendar/nonexistent-token.ics").status_code == 404


# --- Tasks visibility ---
class TestTasks:
    def test_task_visibility(self, admin, worker, seller):
        r = requests.post(f"{API}/tasks", json={"titulo": "TEST_assigned", "asignado_a": worker["user"]["id"]},
                          headers=H(seller["token"]))
        assert r.status_code == 200 and r.json()["asignado_nombre"] == "TEST_Worker Casting"
        tid = r.json()["id"]
        assert tid in [t["id"] for t in requests.get(f"{API}/tasks", headers=H(worker["token"])).json()]
        assert tid in [t["id"] for t in requests.get(f"{API}/tasks", headers=H(admin["token"])).json()]
        other = register("Ceras", "TEST_Other")
        assert tid not in [t["id"] for t in requests.get(f"{API}/tasks", headers=H(other["token"])).json()]
        requests.delete(f"{API}/tasks/{tid}", headers=H(admin["token"]))
