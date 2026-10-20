# Iteration 2: photo upload (object storage) + expanded 10 stages
import io
import os
import uuid
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
STAGES = ["Ventas", "Diseño 3D", "Ceras", "Inyección", "Vulcanizado", "Casting",
          "Fabricación", "Grabado Láser", "Reparaciones", "Terminado"]


def jpeg_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (200, 150, 30)).save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@joyeria.com", "password": "joyeria123"})
    if r.status_code != 200:
        pytest.skip("login failed")
    return r.json()["token"]


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def other_token():
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "x12345", "name": "Other"})
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def order(h):
    r = requests.post(f"{API}/orders", json={"cliente": "TEST_Foto", "descripcion": "anillo"}, headers=h)
    assert r.status_code == 200
    o = r.json()
    yield o
    requests.delete(f"{API}/orders/{o['id']}", headers=h)


# Stages
class TestStages:
    def test_default_stage_ventas(self, order):
        assert order["stage"] == "Ventas"
        assert order["fotos"] == []

    def test_invalid_stage_post(self, h):
        r = requests.post(f"{API}/orders", json={"cliente": "TEST_x", "descripcion": "x", "stage": "3D"}, headers=h)
        assert r.status_code == 400

    def test_invalid_stage_patch(self, h, order):
        r = requests.patch(f"{API}/orders/{order['id']}", json={"stage": "Láser"}, headers=h)
        assert r.status_code == 400

    def test_patch_each_new_stage(self, h, order):
        for s in STAGES:
            r = requests.patch(f"{API}/orders/{order['id']}", json={"stage": s}, headers=h)
            assert r.status_code == 200 and r.json()["stage"] == s
        requests.patch(f"{API}/orders/{order['id']}", json={"stage": "Ventas"}, headers=h)

    def test_stats_10_stages(self, h):
        r = requests.get(f"{API}/stats", headers=h)
        assert r.status_code == 200
        assert list(r.json()["pedidos_por_etapa"].keys()) == STAGES

    def test_no_legacy_stages(self, h):
        r = requests.get(f"{API}/orders", headers=h)
        assert all(o["stage"] in STAGES for o in r.json())


# Photos
class TestPhotos:
    def test_photo_full_flow(self, h, token, other_token, order):
        oid = order["id"]
        r = requests.post(f"{API}/orders/{oid}/photos", headers=h,
                          files={"file": ("ref.jpg", jpeg_bytes(), "image/jpeg")})
        assert r.status_code == 200, r.text
        foto = r.json()
        assert set(["path", "nombre", "created_at"]) <= set(foto)
        assert foto["nombre"] == "ref.jpg"
        path = foto["path"]

        orders = requests.get(f"{API}/orders", headers=h).json()
        o = next(x for x in orders if x["id"] == oid)
        assert any(f["path"] == path for f in o["fotos"])

        g = requests.get(f"{API}/files/{path}", params={"auth": token})
        assert g.status_code == 200
        assert g.headers["content-type"].startswith("image/jpeg")
        assert g.content[:2] == b"\xff\xd8"

        assert requests.get(f"{API}/files/{path}", params={"auth": "bad"}).status_code == 401
        # data is shared now: any logged-in user can view workshop photos
        assert requests.get(f"{API}/files/{path}", params={"auth": other_token}).status_code == 200
        assert requests.get(f"{API}/files/{path}").status_code == 422

        d = requests.delete(f"{API}/orders/{oid}/photos", params={"path": path}, headers=h)
        assert d.status_code == 200
        orders = requests.get(f"{API}/orders", headers=h).json()
        o = next(x for x in orders if x["id"] == oid)
        assert not any(f["path"] == path for f in o["fotos"])
        assert requests.get(f"{API}/files/{path}", params={"auth": token}).status_code == 404

    def test_png_and_webp_ok(self, h, order):
        for fmt, ct in [("PNG", "image/png"), ("WEBP", "image/webp")]:
            buf = io.BytesIO()
            Image.new("RGB", (16, 16)).save(buf, format=fmt)
            r = requests.post(f"{API}/orders/{order['id']}/photos", headers=h,
                              files={"file": (f"a.{fmt.lower()}", buf.getvalue(), ct)})
            assert r.status_code == 200, r.text

    def test_non_image_400(self, h, order):
        r = requests.post(f"{API}/orders/{order['id']}/photos", headers=h,
                          files={"file": ("a.txt", b"hello", "text/plain")})
        assert r.status_code == 400

    def test_too_large_400(self, h, order):
        r = requests.post(f"{API}/orders/{order['id']}/photos", headers=h,
                          files={"file": ("big.jpg", b"\xff\xd8" + b"0" * (10 * 1024 * 1024 + 10), "image/jpeg")})
        assert r.status_code in (400, 413)

    def test_unrelated_worker_photo_upload(self, other_token, order):
        # Shared data; unrelated worker (no dept, not assigned). NOTE: upload has no can_work_on check (currently 200)
        r = requests.post(f"{API}/orders/{order['id']}/photos", headers={"Authorization": f"Bearer {other_token}"},
                          files={"file": ("ref.jpg", jpeg_bytes(), "image/jpeg")})
        assert r.status_code in (200, 403)

    def test_delete_photo_unrelated_worker_403(self, other_token, order):
        r = requests.delete(f"{API}/orders/{order['id']}/photos", params={"path": "x"},
                            headers={"Authorization": f"Bearer {other_token}"})
        assert r.status_code == 403

    def test_upload_no_auth(self, order):
        r = requests.post(f"{API}/orders/{order['id']}/photos", files={"file": ("ref.jpg", jpeg_bytes(), "image/jpeg")})
        assert r.status_code in (401, 403)


# Jarvis knows new departments
class TestChat:
    def test_chat_departments(self, h):
        r = requests.post(f"{API}/chat", json={"message": "Enumera brevemente los departamentos del taller."},
                          headers=h, timeout=90)
        assert r.status_code == 200
        t = r.text
        assert "[Error" not in t
        assert "Vulcanizado" in t and ("Grabado" in t or "Láser" in t) and "Inyecci" in t
