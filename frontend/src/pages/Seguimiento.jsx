import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Check, Crown, Clock, AlertTriangle, MessageCircle, Loader2 } from "lucide-react";
import { money, fmtDate, PAY_STYLES, waPhone } from "@/lib/stages";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PAY_TEXT = { pagado: "Pagado completo", debe: "Saldo pendiente", sin_precio: "Precio por confirmar" };

const Timeline = ({ flujo, stage }) => {
  const idx = flujo.indexOf(stage);
  return (
    <ol className="space-y-0" data-testid="tracking-timeline">
      {flujo.map((s, i) => {
        const done = i < idx || stage === "Terminado";
        const current = i === idx && stage !== "Terminado";
        return (
          <li key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center border ${done ? "bg-amber-500 border-amber-500 text-black" : current ? "border-amber-400 text-amber-300 animate-pulse" : "border-zinc-700 text-zinc-700"}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
              </span>
              {i < flujo.length - 1 && <span className={`w-px h-6 ${done ? "bg-amber-500" : "bg-zinc-800"}`} />}
            </div>
            <span className={`text-sm pt-0.5 ${current ? "text-amber-300 font-medium" : done ? "text-zinc-300" : "text-zinc-600"}`}>{s}{current && " · en proceso"}</span>
          </li>
        );
      })}
    </ol>
  );
};

const Row = ({ label, children, testid }) => (
  <div className="flex justify-between gap-4 py-2.5 border-b border-white/5 text-sm"><span className="text-zinc-500">{label}</span><span className="text-right text-zinc-200" data-testid={testid}>{children}</span></div>
);

export default function Seguimiento() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { axios.get(`${API}/public/orders/${token}`).then((r) => { setD(r.data); document.title = `Tu pedido · ${r.data.negocio.nombre}`; }).catch(() => setErr(true)); }, [token]);

  if (err) return <div className="min-h-screen flex items-center justify-center text-zinc-400 p-6 text-center" data-testid="tracking-error">Este enlace no es válido o el pedido ya no existe.</div>;
  if (!d) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;
  const n = d.negocio;
  const wa = n.telefono ? `https://wa.me/${waPhone(n.telefono, n.codigo_pais)}?text=${encodeURIComponent(`Hola, soy ${d.cliente}. Quisiera información sobre mi pedido: ${d.descripcion}`)}` : null;

  return (
    <div className="min-h-screen px-5 py-10 flex justify-center" data-testid="tracking-page">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center space-y-3">
          <img src={`${API}/public/logo?v=${n.logo_v}`} alt={n.nombre} className="w-20 h-20 rounded-2xl mx-auto object-cover border border-amber-500/30" />
          <div className="font-display text-2xl">{n.nombre}</div>
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Seguimiento de tu pedido</div>
        </header>
        <div className="card-glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-zinc-400 text-sm">Hola, {d.cliente}</span>
            {d.vip && <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300" data-testid="tracking-vip"><Crown className="w-3 h-3" />Cliente VIP</span>}
          </div>
          <h1 className="font-display text-2xl font-light mb-4" data-testid="tracking-description">{d.descripcion}</h1>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden mb-1"><div className="h-full bg-gradient-to-r from-amber-600 to-amber-400" style={{ width: `${d.stage === "Terminado" ? 100 : d.progreso}%` }} /></div>
          <div className="text-xs text-zinc-500 mb-4" data-testid="tracking-progress">{d.stage === "Terminado" ? "¡Tu pieza está lista!" : `Avance ${d.progreso}%`}</div>
          <Row label="Tipo de trabajo" testid="tracking-type">{d.tipo}</Row>
          <Row label="Etapa actual" testid="tracking-stage">{d.stage}</Row>
          {(d.metal || d.piedra) && <Row label="Material">{[d.metal, d.piedra].filter(Boolean).join(" · ")}</Row>}
          <Row label="Entrega estimada" testid="tracking-delivery">
            <span className="inline-flex items-center gap-1">{d.estado_entrega === "atrasado" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> : <Clock className="w-3.5 h-3.5 text-zinc-500" />}{fmtDate(d.fecha_entrega, { weekday: "short", day: "numeric", month: "long" })}</span>
          </Row>
        </div>
        <div className="card-glass rounded-2xl p-6" data-testid="tracking-payment">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest text-zinc-500">Pago</span>
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${PAY_STYLES[d.estado_pago].chip}`} data-testid="tracking-pay-status">{PAY_TEXT[d.estado_pago]}</span>
          </div>
          <Row label="Total">{money(d.precio)}</Row>
          <Row label="Abonado">{money(d.abonado)}</Row>
          <Row label="Saldo" testid="tracking-saldo"><span className={d.saldo > 0 ? "text-amber-300" : "text-emerald-400"}>{money(d.saldo)}</span></Row>
        </div>
        <div className="card-glass rounded-2xl p-6"><Timeline flujo={d.flujo} stage={d.stage} /></div>
        {d.fotos > 0 && (
          <div className="grid grid-cols-3 gap-2" data-testid="tracking-photos">
            {Array.from({ length: Math.min(d.fotos, 6) }).map((_, i) => <img key={`foto-${token}-${i}`} src={`${API}/public/orders/${token}/foto/${i}`} alt="" className="aspect-square w-full object-cover rounded-xl border border-white/10" />)}
          </div>
        )}
        {wa && <a href={wa} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-black font-medium transition-colors" data-testid="tracking-whatsapp"><MessageCircle className="w-4 h-4" />Escribir a la joyería</a>}
        <p className="text-center text-xs text-zinc-500">{n.mensaje}{n.direccion ? ` · ${n.direccion}` : ""}</p>
        <p className="text-center text-[10px] text-zinc-600">Actualizado {fmtDate(d.actualizado)}</p>
      </div>
    </div>
  );
}
