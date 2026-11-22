# Iteration 7: Requisitions, role-based inbox notifications, money hiding for trabajador
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin@joyeria.com", "joyeria123"),
    "ventas": ("ventas@joyeria.com", "ventas123"),
    "worker": ("maria@joyeria.com", "maria123"),
}


def _login(role):
    e, p = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": e, "password": p})
    if r.status_code != 200:
        pytest.skip(f"login failed for {role}: {r.status_code}")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    s.user = r.json()["user"]
    return s


@pytest.fixture(scope="module")
def clients():
    return {k: _login(k) for k in CREDS}


@pytest.fixture(scope="module")
def created_req(clients):
    w = clients["worker"]
    payload = {"categoria": "Piedras", "item": "TEST_Zafiros 2mm", "cantidad": 5, "unidad": "pz", "urgente": True, "nota": "TEST nota"}
    r = w.post(f"{API}/requisitions", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    time.sleep(1.5)  # notify_staff runs as background task
    yield d
    # No DELETE endpoint exists for requisitions; cleanup via mongo by id
    try:
        from pymongo import MongoClient
        env = dict(l.split("=", 1) for l in open("/app/backend/.env").read().splitlines() if "=" in l)
        db = MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')]
        db.requisitions.delete_one({"id": d["id"]})
        db.inbox.delete_many({"ref_id": d["id"]})
    except Exception as ex:
        print("cleanup failed", ex)


class TestRequisitionCreate:
    def test_create_fields(self, created_req, clients):
        assert created_req["estado"] == "pendiente"
        assert created_req["solicitante_nombre"] == clients["worker"].user["name"]
        assert "costo" not in created_req
        assert "_id" not in created_req

    def test_invalid_category(self, clients):
        r = clients["worker"].post(f"{API}/requisitions", json={"categoria": "XX", "item": "a", "cantidad": 1})
        assert r.status_code == 422

    def test_zero_qty(self, clients):
        r = clients["worker"].post(f"{API}/requisitions", json={"categoria": "Oro", "item": "a", "cantidad": 0})
        assert r.status_code == 422

    def test_worker_list_only_own(self, created_req, clients):
        w = clients["worker"]
        items = w.get(f"{API}/requisitions").json()
        assert any(i["id"] == created_req["id"] for i in items)
        assert all(i["solicitante_id"] == w.user["id"] for i in items)
        assert all("costo" not in i for i in items)


class TestInbox:
    @pytest.mark.parametrize("role", ["admin", "ventas"])
    def test_staff_notified(self, created_req, clients, role):
        d = clients[role].get(f"{API}/notifications/inbox").json()
        mine = [n for n in d["items"] if n["ref_id"] == created_req["id"]]
        assert len(mine) == 1
        n = mine[0]
        assert n["titulo"] == f"Nueva requisición de Piedras de {clients['worker'].user['name']}"
        assert "TEST_Zafiros 2mm" in n["mensaje"] and "URGENTE" in n["mensaje"]
        assert n["url"] == f"/requisiciones/{created_req['id']}"
        assert n["leida"] is False
        assert d["no_leidas"] >= 1

    def test_worker_not_notified(self, created_req, clients):
        d = clients["worker"].get(f"{API}/notifications/inbox").json()
        assert not any(n.get("ref_id") == created_req["id"] for n in d["items"])

    def test_mark_read_one(self, created_req, clients):
        a = clients["admin"]
        d = a.get(f"{API}/notifications/inbox").json()
        n = [x for x in d["items"] if x["ref_id"] == created_req["id"]][0]
        r = a.post(f"{API}/notifications/inbox/{n['id']}/read")
        assert r.status_code == 200
        d2 = a.get(f"{API}/notifications/inbox").json()
        assert d2["no_leidas"] == d["no_leidas"] - 1
        assert [x for x in d2["items"] if x["id"] == n["id"]][0]["leida"] is True

    def test_read_other_users_notification_404(self, created_req, clients):
        d = clients["ventas"].get(f"{API}/notifications/inbox").json()
        n = [x for x in d["items"] if x["ref_id"] == created_req["id"]][0]
        r = clients["worker"].post(f"{API}/notifications/inbox/{n['id']}/read")
        assert r.status_code == 404

    def test_read_all(self, created_req, clients):
        v = clients["ventas"]
        assert v.post(f"{API}/notifications/inbox/read-all").status_code == 200
        assert v.get(f"{API}/notifications/inbox").json()["no_leidas"] == 0


class TestRequisitionPermissions:
    def test_worker_patch_403(self, created_req, clients):
        r = clients["worker"].patch(f"{API}/requisitions/{created_req['id']}", json={"estado": "aprobada"})
        assert r.status_code == 403

    def test_admin_patch_status_cost(self, created_req, clients):
        a = clients["admin"]
        r = a.patch(f"{API}/requisitions/{created_req['id']}", json={"estado": "comprada", "costo": 123.5})
        assert r.status_code == 200
        d = a.get(f"{API}/requisitions/{created_req['id']}").json()
        assert d["estado"] == "comprada" and d["costo"] == 123.5
        assert d["atendido_por"] == a.user["name"]

    def test_worker_get_own_no_cost(self, created_req, clients):
        d = clients["worker"].get(f"{API}/requisitions/{created_req['id']}").json()
        assert d["estado"] == "comprada" and "costo" not in d

    def test_worker_get_others_403(self, clients):
        # admin-created requisition is "other user" for maria
        a = clients["admin"]
        r = a.post(f"{API}/requisitions", json={"categoria": "Oro", "item": "TEST_admin oro", "cantidad": 1})
        rid = r.json()["id"]
        try:
            g = clients["worker"].get(f"{API}/requisitions/{rid}")
            assert g.status_code == 403
        finally:
            time.sleep(1)
            from pymongo import MongoClient
            env = dict(l.split("=", 1) for l in open("/app/backend/.env").read().splitlines() if "=" in l)
            db = MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')]
            db.requisitions.delete_one({"id": rid})
            db.inbox.delete_many({"ref_id": rid})

    def test_not_found(self, clients):
        assert clients["admin"].get(f"{API}/requisitions/nope").status_code == 404


@pytest.fixture(scope="class")
def test_order(clients):
    a = clients["admin"]
    r = a.post(f"{API}/orders", json={"cliente": "TEST_Cliente Iter7", "descripcion": "TEST_Anillo", "stage": "Ceras",
                                      "precio": 1500, "asignado_a": clients["worker"].user["id"]})
    assert r.status_code == 200, r.text
    o = r.json()
    ab = a.post(f"{API}/orders/{o['id']}/abonos", json={"monto": 500, "nota": "TEST"})
    print("abono", ab.status_code)
    yield o
    a.delete(f"{API}/orders/{o['id']}")  # soft-archive only -> hard delete our TEST order by id
    from pymongo import MongoClient
    env = dict(l.split("=", 1) for l in open("/app/backend/.env").read().splitlines() if "=" in l)
    MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')].orders.delete_one({"id": o["id"]})


@pytest.mark.usefixtures("test_order")
class TestMoneyHidden:
    def test_orders_worker(self, clients):
        orders = clients["worker"].get(f"{API}/orders").json()
        assert len(orders) >= 1
        for o in orders:
            assert o["precio"] == 0 and o["abonos"] == [] and o["saldo"] == 0

    def test_orders_admin_has_prices(self, clients):
        orders = clients["admin"].get(f"{API}/orders").json()
        assert any(float(o.get("precio") or 0) > 0 for o in orders)

    def test_production_worker(self, clients):
        d = clients["worker"].get(f"{API}/production").json()
        for dep in d["departamentos"]:
            for o in dep["pedidos"]:
                assert o["precio"] == 0 and o["abonos"] == [] and o["saldo"] == 0

    def test_charts_worker(self, clients):
        assert clients["worker"].get(f"{API}/stats/charts").json()["ingresos"] is None

    def test_sales_summary_worker_403(self, clients):
        assert clients["worker"].get(f"{API}/sales/summary").status_code == 403

    def test_worker_patch_order_hides_money(self, clients):
        w = clients["worker"]
        orders = [o for o in w.get(f"{API}/orders", params={"mine": True}).json()]
        if not orders:
            orders = w.get(f"{API}/orders").json()
        for o in orders:
            r = w.patch(f"{API}/orders/{o['id']}", json={"progreso": o.get("progreso", 0)})
            if r.status_code == 200:
                d = r.json()
                assert d["precio"] == 0 and d["abonos"] == [] and d["saldo"] == 0
                return
        pytest.skip("worker cannot patch any order")
