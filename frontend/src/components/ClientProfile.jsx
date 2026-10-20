import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Cake, MessageCircle, Send, Trash2, StickyNote, Crown } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate, apiError, waPhone } from "@/lib/stages";
import { useBrand } from "@/hooks/useBrand";
import { StageBadge, DueBadge, PayBadge } from "@/components/Badges";

const first = (n) => (n || "").split(" ")[0];
const TEMPLATES = [
  { id: "listo", label: "Pedido listo", text: (c) => `Hola ${first(c.nombre)}, ¡tu pedido ya está listo para recoger en la joyería! Te esperamos.` },
  { id: "saldo", label: "Recordar saldo", text: (c) => `Hola ${first(c.nombre)}, te recordamos que tienes un saldo pendiente de ${money(c.saldo_pendiente)}. ¡Gracias por tu preferencia!` },
  { id: "cumple", label: "Feliz cumpleaños", text: (c) => `¡Feliz cumpleaños, ${first(c.nombre)}! De parte de toda la joyería te deseamos un día brillante. Pasa por un detalle especial.` },
  { id: "avance", label: "Avance del pedido", text: (c) => `Hola ${first(c.nombre)}, te escribimos para contarte que tu pedido va avanzando en el taller. Pronto te avisamos cuando esté listo.` },
];

const waLink = (phone, text, cc) => `https://wa.me/${waPhone(phone, cc)}?text=${encodeURIComponent(text)}`;

const Field = ({ label, children }) => (
  <div><div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">{label}</div>{children}</div>
);

const Notes = ({ c, onChange }) => {
  const [texto, setTexto] = useState("");
  const add = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    try { onChange((await api.post(`/clients/${c.id}/notas`, { texto })).data); setTexto(""); } catch (err) { toast.error(apiError(err)); }
  };
  const del = async (nid) => {
    try { onChange((await api.delete(`/clients/${c.id}/notas/${nid}`)).data); } catch (err) { toast.error(apiError(err)); }
  };
  return (
    <div data-testid="client-notes">
      <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2"><StickyNote className="w-3.5 h-3.5" />Notas importantes</div>
      <div className="flex flex-wrap gap-2 mb-3">
        {c.notas_importantes.map((n) => (
          <span key={n.id} className="group inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200" data-testid="client-note-chip">
            {n.texto}
            <button onClick={() => del(n.id)} className="text-amber-500/60 hover:text-red-400" data-testid={`del-note-${n.id}`}><Trash2 className="w-3 h-3" /></button>
          </span>
        ))}
        {!c.notas_importantes.length && <span className="text-xs text-zinc-600">Sin notas. Ej: alergia al níquel, estilo minimalista, talla 7.</span>}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Agregar nota importante" className="bg-zinc-900 border-zinc-800" data-testid="input-client-note" />
        <Button type="submit" size="icon" className="bg-amber-600 hover:bg-amber-500 text-black shrink-0" data-testid="btn-add-client-note"><Send className="w-4 h-4" /></Button>
      </form>
    </div>
  );
};

const WhatsApp = ({ c }) => {
  const brand = useBrand();
  const [tpl, setTpl] = useState(TEMPLATES[0].id);
  const t = TEMPLATES.find((x) => x.id === tpl);
  if (!c.telefono) return <div className="text-xs text-zinc-500">Agrega un teléfono (con código de país, ej. +52...) para enviar WhatsApp.</div>;
  return (
    <div data-testid="client-whatsapp">
      <div className="flex flex-wrap gap-2 mb-3">
        {TEMPLATES.map((x) => (
          <button key={x.id} onClick={() => setTpl(x.id)} data-testid={`wa-tpl-${x.id}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${tpl === x.id ? "bg-emerald-600 text-black border-emerald-600" : "border-white/10 text-zinc-400 hover:text-zinc-100"}`}>{x.label}</button>
        ))}
      </div>
      <p className="text-xs text-zinc-400 bg-zinc-900 rounded-lg p-3 mb-3 border border-white/5">{t.text(c)}</p>
      <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-500 text-black" data-testid="btn-send-whatsapp">
        <a href={waLink(c.telefono, t.text(c), brand.codigo_pais)} target="_blank" rel="noreferrer"><MessageCircle className="w-4 h-4 mr-2" />Enviar por WhatsApp</a>
      </Button>
    </div>
  );
};

export const ClientProfile = ({ clientId, onClose, onChanged }) => {
  const [c, setC] = useState(null);
  useEffect(() => { setC(null); if (clientId) api.get(`/clients/${clientId}`).then((r) => setC(r.data)); }, [clientId]);
  const update = (data) => { setC(data); onChanged(); };
  const patch = async (k, v) => {
    if ((c[k] ?? "") === v) return;
    try { update((await api.patch(`/clients/${c.id}`, { [k]: v })).data); toast.success("Guardado"); } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <Dialog open={!!clientId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="client-profile">
        {c && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl flex flex-wrap items-center gap-3">
                {c.nombre}
                <button onClick={() => patch("vip", !c.vip)} data-testid="client-vip-toggle"
                  className={`text-xs font-sans px-2.5 py-1 rounded-full border flex items-center gap-1 transition-colors ${c.vip ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "border-zinc-700 text-zinc-500 hover:text-amber-300"}`}>
                  <Crown className="w-3 h-3" />{c.vip ? "Cliente VIP" : "Marcar VIP"}
                </button>
                {c.dias_cumpleanos !== null && c.dias_cumpleanos <= 14 && (
                  <span className="text-xs font-sans px-2 py-1 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30 flex items-center gap-1" data-testid="client-birthday-badge">
                    <Cake className="w-3 h-3" />{c.dias_cumpleanos === 0 ? "¡Hoy cumple!" : `Cumple en ${c.dias_cumpleanos} días`}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[["Pedidos", c.pedidos.length], ["Total", money(c.total_gastado)], ["Saldo", money(c.saldo_pendiente)]].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-zinc-900 border border-white/5 py-3">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">{l}</div>
                    <div className={`font-display text-xl ${l === "Saldo" && c.saldo_pendiente > 0 ? "text-red-400" : ""}`} data-testid={`client-stat-${l.toLowerCase()}`}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Teléfono"><Input defaultValue={c.telefono} onBlur={(e) => patch("telefono", e.target.value)} className="bg-zinc-900 border-zinc-800" data-testid="client-edit-telefono" /></Field>
                <Field label="Email"><Input defaultValue={c.email} onBlur={(e) => patch("email", e.target.value)} className="bg-zinc-900 border-zinc-800" data-testid="client-edit-email" /></Field>
                <Field label="Cumpleaños"><Input type="date" defaultValue={c.cumpleanos || ""} onBlur={(e) => e.target.value && patch("cumpleanos", e.target.value)} className="bg-zinc-900 border-zinc-800" data-testid="client-edit-cumpleanos" /></Field>
              </div>
              <Notes c={c} onChange={update} />
              <div className="border-t border-white/5 pt-5"><WhatsApp c={c} /></div>
              <div className="border-t border-white/5 pt-5" data-testid="client-orders">
                <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Historial de pedidos</div>
                {!c.pedidos.length && <div className="text-xs text-zinc-600">Sin pedidos aún.</div>}
                <div className="space-y-2">
                  {c.pedidos.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-900/60 border border-white/5 px-3 py-2.5 text-sm" data-testid={`client-order-${o.id}`}>
                      <span className="flex-1 min-w-[140px] truncate">{o.descripcion}</span>
                      <StageBadge stage={o.stage} />
                      {["atrasado", "por_vencer"].includes(o.estado_entrega) && <DueBadge status={o.estado_entrega} />}
                      <PayBadge status={o.estado_pago} />
                      <span className="text-xs font-mono text-zinc-400">{money(o.precio)}</span>
                      <span className="text-[10px] text-zinc-600 w-full">{fmtDate(o.created_at, { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
