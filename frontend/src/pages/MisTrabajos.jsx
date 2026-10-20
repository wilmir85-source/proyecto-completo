import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { DUE_STYLES, fmtDate, fileUrl } from "@/lib/stages";
import { OrderDetail } from "@/components/OrderDetail";
import { DueBadge, StageBadge, ProgressBar } from "@/components/Badges";
import { Hammer } from "lucide-react";

const ORDER = { atrasado: 0, por_vencer: 1, a_tiempo: 2, sin_fecha: 3, terminado: 4 };

export default function MisTrabajos() {
  const { user } = useAuth();
  const { users } = useUsers();
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const load = () => api.get("/orders", { params: { mine: true } }).then((r) =>
    setOrders(r.data.sort((a, b) => ORDER[a.estado_entrega] - ORDER[b.estado_entrega])));
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, []);

  const active = orders.filter((o) => o.stage !== "Terminado");

  return (
    <div className="p-5 md:p-12 max-w-4xl">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">{user?.departamento || "Sin departamento"}</div>
        <h1 className="font-display text-4xl font-light">Mis trabajos</h1>
        <p className="text-sm text-zinc-500 mt-2">Pedidos asignados a ti o que están en tu departamento. Toca uno para actualizar etapa, progreso y bitácora.</p>
      </header>
      {active.length === 0 && (
        <div className="card-glass rounded-2xl p-10 text-center text-zinc-500" data-testid="my-work-empty">
          <Hammer className="w-8 h-8 mx-auto mb-3 text-zinc-600" />No tienes trabajos pendientes.
        </div>
      )}
      <div className="space-y-3" data-testid="my-work-list">
        {active.map((o) => (
          <button key={o.id} onClick={() => setSelectedId(o.id)}
            className={`w-full text-left card-glass rounded-2xl p-4 flex gap-4 items-center border hover:bg-zinc-900 transition-colors ${DUE_STYLES[o.estado_entrega].card}`}
            data-testid={`my-work-${o.id}`}>
            {o.fotos?.[0]
              ? <img src={fileUrl(o.fotos[0].path)} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
              : <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-white/5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-medium truncate">{o.cliente}</span>
                <StageBadge stage={o.stage} />
                <DueBadge status={o.estado_entrega} />
              </div>
              <div className="text-xs text-zinc-400 truncate">{o.descripcion}</div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1"><ProgressBar value={o.progreso} /></div>
                <span className="text-[10px] font-mono text-zinc-500">{o.progreso}%</span>
                <span className="text-[10px] text-zinc-500">{fmtDate(o.fecha_entrega)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      <OrderDetail order={orders.find((o) => o.id === selectedId)} users={users} onClose={() => setSelectedId(null)} onChange={load} />
    </div>
  );
}
