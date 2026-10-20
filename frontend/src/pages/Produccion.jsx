import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { STAGE_STYLES, DUE_STYLES, ROLE_LABELS, fmtDate } from "@/lib/stages";
import { useUsers } from "@/hooks/useUsers";
import { OrderDetail } from "@/components/OrderDetail";
import { Avatar, DueBadge, ProgressBar } from "@/components/Badges";
import { Users } from "lucide-react";

const DeptCard = ({ d, onOpen }) => {
  const s = STAGE_STYLES[d.stage];
  const tone = d.atrasados ? "border-red-500/50" : d.por_vencer ? "border-yellow-500/40" : "border-white/5";
  return (
    <div className={`card-glass rounded-2xl p-5 border ${tone}`} data-testid={`dept-${d.stage}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${s.bar}`} />
          <span className={`font-display text-base ${s.text}`}>{d.stage}</span>
        </div>
        <span className="font-display text-3xl font-light">{d.total}</span>
      </div>
      <div className="flex gap-3 text-xs mb-4">
        <span className={d.atrasados ? "text-red-400" : "text-zinc-600"} data-testid={`dept-late-${d.stage}`}>{d.atrasados} atrasados</span>
        <span className={d.por_vencer ? "text-yellow-400" : "text-zinc-600"}>{d.por_vencer} por vencer</span>
      </div>
      <div className="space-y-1.5 mb-4">
        {d.pedidos.slice(0, 4).map((o) => (
          <button key={o.id} onClick={() => onOpen(o.id)} className="w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors" data-testid={`dept-order-${o.id}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DUE_STYLES[o.estado_entrega].dot}`} />
            <span className="truncate flex-1 text-zinc-300">{o.cliente}</span>
            <span className="text-zinc-500 shrink-0">{fmtDate(o.fecha_entrega, { day: "numeric", month: "short" })}</span>
          </button>
        ))}
        {d.pedidos.length > 4 && <div className="text-[10px] text-zinc-600 px-2">+{d.pedidos.length - 4} más</div>}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 border-t border-white/5 pt-3">
        <Users className="w-3 h-3" /> {d.trabajadores.length ? d.trabajadores.join(", ") : "Sin trabajadores"}
      </div>
    </div>
  );
};

const WorkerRow = ({ w }) => (
  <div className="grid grid-cols-12 items-center gap-3 py-3 border-b border-white/5 text-sm" data-testid={`worker-row-${w.id}`}>
    <div className="col-span-5 flex items-center gap-2 min-w-0">
      <Avatar name={w.name} />
      <div className="min-w-0">
        <div className="truncate">{w.name}</div>
        <div className="text-[10px] text-zinc-500">{ROLE_LABELS[w.role]} · {w.departamento || "—"}</div>
      </div>
    </div>
    <div className="col-span-2 text-center font-mono">{w.asignados}</div>
    <div className="col-span-2 flex justify-center gap-1">
      {w.atrasados > 0 && <DueBadge status="atrasado" />}
      {w.atrasados === 0 && w.por_vencer > 0 && <DueBadge status="por_vencer" />}
    </div>
    <div className="col-span-3"><ProgressBar value={w.progreso_promedio} /><div className="text-[10px] text-zinc-500 mt-1">{w.progreso_promedio}% prom.</div></div>
  </div>
);

export default function Produccion() {
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const { users } = useUsers();

  const load = () => {
    api.get("/production").then((r) => setData(r.data)).catch(() => {});
    api.get("/orders").then((r) => setOrders(r.data)).catch(() => {});
  };
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, []);

  return (
    <div className="p-5 md:p-12 max-w-[1600px]">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">Control de planta</div>
        <h1 className="font-display text-4xl font-light">Producción por departamento</h1>
        <div className="flex gap-4 mt-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Atrasado</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" />Vence en 48h</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />A tiempo</span>
        </div>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-10" data-testid="dept-grid">
        {data?.departamentos.map((d) => <DeptCard key={d.stage} d={d} onOpen={setSelectedId} />)}
      </div>
      <div className="card-glass rounded-2xl p-6" data-testid="workers-table">
        <h2 className="font-display text-xl mb-4">Carga por trabajador</h2>
        <div className="grid grid-cols-12 gap-3 text-[10px] uppercase tracking-widest text-zinc-500 pb-2 border-b border-white/10">
          <div className="col-span-5">Trabajador</div><div className="col-span-2 text-center">Asignados</div>
          <div className="col-span-2 text-center">Estado</div><div className="col-span-3">Avance</div>
        </div>
        {data?.trabajadores.map((w) => <WorkerRow key={w.id} w={w} />)}
      </div>
      <OrderDetail order={orders.find((o) => o.id === selectedId)} users={users} onClose={() => setSelectedId(null)} onChange={load} />
    </div>
  );
}
