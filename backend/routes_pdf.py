import asyncio
import io
import re
import unicodedata
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from core import logger, get_object, current_user, enrich_order, parse_dt, shrink_image, can_work_on
from routes_orders import get_order_or_404
from routes_settings import logo_bytes, get_settings

router = APIRouter(prefix="/api")

MAX_PX = 1000
JPEG_QUALITY = 70
GOLD = colors.HexColor("#B45309")
INK = colors.HexColor("#18181B")
MUTED = colors.HexColor("#71717A")
LINE = colors.HexColor("#E4E4E7")

H1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=18, textColor=INK, leading=22)
H2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11, textColor=GOLD, spaceBefore=12, spaceAfter=6)
BODY = ParagraphStyle("body", fontName="Helvetica", fontSize=10, textColor=INK, leading=14)
SMALL = ParagraphStyle("small", fontName="Helvetica", fontSize=8, textColor=MUTED, leading=10)


def compress(data: bytes) -> io.BytesIO | None:
    try:
        return io.BytesIO(shrink_image(data, MAX_PX, JPEG_QUALITY))
    except Exception as e:
        logger.error(f"PDF image compress failed: {e}")
        return None


async def load_photo(path):
    try:
        data, _ = await asyncio.to_thread(get_object, path)
        return await asyncio.to_thread(compress, data)
    except Exception as e:
        logger.error(f"PDF photo fetch failed: {e}")
        return None


def fmt(iso, tz):
    d = parse_dt(iso)
    return d.astimezone(tz).strftime("%d/%m/%Y %H:%M") if d else "—"


def esc(v):
    return escape(str(v)) if v not in (None, "") else "—"


def kv_table(rows, widths):
    t = Table([[Paragraph(f"<b>{k}</b>", SMALL), Paragraph(esc(v), BODY)] for k, v in rows], colWidths=widths)
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
                           ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    return t


def photo_grid(buffers, width):
    cols, gap = 3, 0.3 * cm
    cell = (width - gap * (cols - 1)) / cols
    imgs = []
    for b in buffers:
        im = Image(b)
        ratio = im.imageHeight / im.imageWidth
        im.drawWidth, im.drawHeight = (cell, cell * ratio) if ratio <= 1 else (cell / ratio, cell)
        imgs.append(im)
    rows = [imgs[i:i + cols] + [""] * (cols - len(imgs[i:i + cols])) for i in range(0, len(imgs), cols)]
    t = Table(rows, colWidths=[cell + gap] * cols)
    t.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    return t


def build_pdf(o, photos, tz, logo_data, negocio, is_staff) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=1.6 * cm, rightMargin=1.6 * cm,
                            topMargin=1.4 * cm, bottomMargin=1.4 * cm, title=f"Orden {o['id'][:8].upper()}")
    width = doc.width
    logo = Image(io.BytesIO(logo_data), width=1.8 * cm, height=1.8 * cm, kind="proportional") if logo_data else ""
    
    head = Table([[logo, [Paragraph(esc(negocio.get("nombre")), SMALL), Paragraph("Orden de Trabajo", H1),
                          Paragraph(f"Pedido #{o['id'][:8].upper()} · Creado {fmt(o.get('created_at'), tz)}", SMALL)],
                   [Paragraph(f"<b>Entrega estimada</b><br/>{fmt(o.get('fecha_entrega'), tz)}", BODY),
                    Paragraph(f"Etapa: {esc(o.get('stage'))}", SMALL)]]],
                 colWidths=[2.2 * cm, width - 7.2 * cm, 5 * cm])
    
    head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, 0), 1.2, GOLD),
                              ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
    
    peso = f"{o['peso_metal']} g" if o.get("peso_metal") else None
    
    story = [head,
             Paragraph("Datos del cliente", H2),
             kv_table([("Nombre", o.get("cliente")), ("Teléfono", o.get("telefono_cliente"))], [4 * cm, width - 4 * cm]),
             Paragraph("Detalles del trabajo", H2),
             kv_table([("Tipo de trabajo", o.get("tipo")), ("Descripción de la pieza", o.get("descripcion")), ("Metal", o.get("metal")),
                       ("Peso del metal", peso), ("Tipo de piedra", o.get("piedra")),
                       ("Joyero asignado", o.get("asignado_nombre")), ("Progreso", f"{o.get('progreso', 0)}%"),
                       ("Notas", o.get("notas"))], [4 * cm, width - 4 * cm])]

    # --- SECCIÓN FINANCIERA (Solo para Admin y Ventas) ---
    if is_staff:
        total = float(o.get("precio") or 0)
        abonado = o.get("abonado", 0)
        saldo = o.get("saldo", 0)
        
        fin_rows = [
            ("Total", f"Q{total:,.2f}"),
            ("Abonado", f"Q{abonado:,.2f}"),
            ("Saldo Pendiente", f"Q{saldo:,.2f}")
        ]
        story.append(Paragraph("Estado de Cuenta", H2))
        story.append(kv_table(fin_rows, [4 * cm, width - 4 * cm]))

    # --- FOTOS ---
    story += [Paragraph(f"Fotos de referencia ({len(photos)})", H2),
              photo_grid(photos, width) if photos else Paragraph("Sin fotos de referencia.", SMALL)]
    
    # --- FIRMAS ---
    story += [Spacer(1, 1.2 * cm),
              Table([["Firma del joyero: ______________________", "Revisado por: ______________________"]],
                    colWidths=[width / 2] * 2, style=[("FONTSIZE", (0, 0), (-1, -1), 9), ("TEXTCOLOR", (0, 0), (-1, -1), MUTED)])]
    
    doc.build(story)
    return buf.getvalue()


@router.get("/orders/{order_id}/pdf")
async def order_pdf(order_id: str, tz: str = Query("America/Mexico_City"), user=Depends(current_user)):
    o = enrich_order(await get_order_or_404(order_id))
    if not can_work_on(user, o):
        raise HTTPException(403, "Este trabajo no está asignado a ti ni a tu departamento")
    
    # Verificamos si el usuario es Admin o Ventas
    is_staff = user.get("role") in ("admin", "ventas")
    
    try:
        zone = ZoneInfo(tz)
    except Exception:
        zone = ZoneInfo("America/Mexico_City")
        
    photos = [p for p in await asyncio.gather(*(load_photo(f["path"]) for f in o["fotos"][:12])) if p]
    
    # Pasamos el parámetro is_staff a la función build_pdf
    pdf = await asyncio.to_thread(build_pdf, o, photos, zone, await logo_bytes(), await get_settings(), is_staff)
    
    base = re.sub(r"[^A-Za-z0-9_-]+", "_", unicodedata.normalize("NFKD", o["cliente"]).encode("ascii", "ignore").decode()).strip("_")
    name = f"orden_{base or 'pedido'}_{o['id'][:8]}.pdf"
    
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})