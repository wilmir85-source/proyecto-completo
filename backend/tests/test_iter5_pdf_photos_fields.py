# Iteration 5: order metal/peso/piedra fields, photo upload re-encode (25MB), work-order PDF
import io
import os
import numpy as np
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]


def noise_jpeg(w=4000, h=3000, q=95):
    arr = np.random.randint(0, 255, (h, w, 3), dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, "JPEG", quality=q)
    return buf.getvalue()


def small_png():
    buf = io.BytesIO()
    Image.new("RGBA", (300, 200), (10, 200, 30, 128)).save(buf, "PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def admin():
    return login("admin@joyeria.com", "joyeria123")


@pytest.fixture(scope="module")
def worker():
    return login("carlos@joyeria.com", "taller123")


@pytest.fixture(scope="module")
def created(admin):
    ids = []
    yield ids
    for i in ids:
        requests.delete(f"{API}/orders/{i}", headers=admin[0])


def mk(admin, created, **kw):
    body = {"cliente": "TEST_Cliente PDF", "descripcion": "TEST anillo oro", "telefono_cliente": "5512345678", **kw}
    r = requests.post(f"{API}/orders", json=body, headers=admin[0])
    assert r.status_code == 200, r.text
    created.append(r.json()["id"])
    return r.json()


class TestFields:
    def test_create_with_fields(self, admin, created):
        o = mk(admin, created, metal="Oro 18k", peso_metal=4.5, piedra="Diamante")
        g = [x for x in requests.get(f"{API}/orders", headers=admin[0]).json() if x["id"] == o["id"]][0]
        assert (g["metal"], g["peso_metal"], g["piedra"]) == ("Oro 18k", 4.5, "Diamante")

    def test_negative_peso_rejected(self, admin):
        r = requests.post(f"{API}/orders", json={"cliente": "TEST_x", "descripcion": "x", "peso_metal": -1}, headers=admin[0])
        assert r.status_code == 422

    def test_patch_fields(self, admin, created):
        o = mk(admin, created, metal="Plata")
        r = requests.patch(f"{API}/orders/{o['id']}", json={"metal": "Platino", "peso_metal": 7.25, "piedra": "Rubí"}, headers=admin[0])
        assert r.status_code == 200
        d = r.json()
        assert (d["metal"], d["peso_metal"], d["piedra"]) == ("Platino", 7.25, "Rubí")

    def test_patch_peso_null_clears(self, admin, created):
        o = mk(admin, created, peso_metal=3.0)
        r = requests.patch(f"{API}/orders/{o['id']}", json={"peso_metal": None}, headers=admin[0])
        assert r.status_code == 200
        assert r.json()["peso_metal"] is None, f"peso_metal not cleared: {r.json()['peso_metal']}"

    def test_worker_patch_metal_403(self, admin, worker, created):
        o = mk(admin, created, asignado_a=worker[1]["id"])
        r = requests.patch(f"{API}/orders/{o['id']}", json={"metal": "Cobre"}, headers=worker[0])
        assert r.status_code == 403
        r = requests.patch(f"{API}/orders/{o['id']}", json={"progreso": 20}, headers=worker[0])
        assert r.status_code == 200


class TestPhotos:
    def test_large_jpeg_reencoded(self, admin, created):
        o = mk(admin, created)
        data = noise_jpeg()
        assert len(data) > 5 * 1024 * 1024
        r = requests.post(f"{API}/orders/{o['id']}/photos", files={"file": ("TEST_big.jpg", data, "image/jpeg")}, headers=admin[0])
        assert r.status_code == 200, r.text
        p = r.json()["path"]
        assert p.endswith(".jpg")
        f = requests.get(f"{API}/files/{p}", params={"auth": admin[0]["Authorization"][7:]})
        assert f.status_code == 200 and f.headers["content-type"].startswith("image/jpeg")
        im = Image.open(io.BytesIO(f.content))
        assert max(im.size) == 2000 and len(f.content) < len(data)

    def test_png_rgba_to_jpg(self, admin, created):
        o = mk(admin, created)
        r = requests.post(f"{API}/orders/{o['id']}/photos", files={"file": ("TEST.png", small_png(), "image/png")}, headers=admin[0])
        assert r.status_code == 200 and r.json()["path"].endswith(".jpg")

    def test_over_25mb(self, admin, created):
        o = mk(admin, created)
        big = b"\xff\xd8" + os.urandom(26 * 1024 * 1024)
        r = requests.post(f"{API}/orders/{o['id']}/photos", files={"file": ("TEST.jpg", big, "image/jpeg")}, headers=admin[0])
        assert r.status_code == 400 and "25" in r.json()["detail"]

    def test_corrupt(self, admin, created):
        o = mk(admin, created)
        r = requests.post(f"{API}/orders/{o['id']}/photos", files={"file": ("TEST.jpg", b"notanimage" * 100, "image/jpeg")}, headers=admin[0])
        assert r.status_code == 400

    def test_non_image_type(self, admin, created):
        o = mk(admin, created)
        r = requests.post(f"{API}/orders/{o['id']}/photos", files={"file": ("TEST.pdf", b"%PDF-1.4", "application/pdf")}, headers=admin[0])
        assert r.status_code == 400


class TestPdf:
    def test_pdf_no_photos(self, admin, created):
        o = mk(admin, created, metal="Oro 14k", peso_metal=2.5, piedra="Zafiro")
        r = requests.get(f"{API}/orders/{o['id']}/pdf", headers=admin[0])
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert "attachment" in r.headers["content-disposition"] and ".pdf" in r.headers["content-disposition"]
        assert r.content[:4] == b"%PDF"
        from pypdf import PdfReader
        txt = "".join(p.extract_text() for p in PdfReader(io.BytesIO(r.content)).pages)
        assert "Sin fotos de referencia." in txt
        for s in ["TEST_Cliente PDF", "5512345678", "Oro 14k", "2.5 g", "Zafiro", o["id"][:8].upper()]:
            assert s in txt, s

    def test_pdf_with_large_photos_small(self, admin, created):
        o = mk(admin, created)
        for i in range(3):
            r = requests.post(f"{API}/orders/{o['id']}/photos", files={"file": (f"TEST_{i}.jpg", noise_jpeg(), "image/jpeg")}, headers=admin[0])
            assert r.status_code == 200
        r = requests.get(f"{API}/orders/{o['id']}/pdf", headers=admin[0])
        assert r.status_code == 200
        assert len(r.content) < 3 * 1024 * 1024, len(r.content)
        from pypdf import PdfReader
        rd = PdfReader(io.BytesIO(r.content))
        n = sum(len(p.images) for p in rd.pages)
        assert n >= 3
        print("PDF size", len(r.content), "images", n)

    def test_pdf_404(self, admin):
        assert requests.get(f"{API}/orders/nope-123/pdf", headers=admin[0]).status_code == 404

    def test_pdf_no_token(self, admin, created):
        o = mk(admin, created)
        assert requests.get(f"{API}/orders/{o['id']}/pdf").status_code in (401, 403)

    def test_pdf_special_chars(self, admin, created):
        # markup-like chars in text fields must not crash reportlab
        o = mk(admin, created, cliente="TEST_Juan & Hijos <b>", descripcion="Anillo <talla 7> & grabado", notas="a < b")
        r = requests.get(f"{API}/orders/{o['id']}/pdf", headers=admin[0])
        assert r.status_code == 200, r.text[:200]

    def test_pdf_unicode_filename(self, admin, created):
        o = mk(admin, created, cliente="TEST_Zoë Łukasz 💍")
        r = requests.get(f"{API}/orders/{o['id']}/pdf", headers=admin[0])
        assert r.status_code == 200, r.text[:200]
