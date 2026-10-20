import { Link } from "react-router-dom";
import { DUE_STYLES, fmtDate } from "@/lib/stages";
import { DueBadge, StageBadge, Avatar } from "@/components/Badges";
import { Siren } from "lucide-react";

export const AttentionList = ({ orders }) => {
  const urgent = orders
    .filter((o) => ["atrasado", "por_vencer"].includes(o.estado_entrega))
    .sort((a, b) => new Date(a.fecha_entrega) - new Date(b.fecha_entrega));
  if (!urgent.length) return null;
  return (
    <div className="card-glass rounded-2xl p-6 mb-10 border border-red-500/20" data-testid="attention-list">
      <div className="flex items-center gap-2 mb-4">
        <Siren className="w-5 h-5 text-red-400" />
        <h2 className="font-display text-xl">Requieren atención</h2>
        <span className="text-xs text-zinc-500">({urgent.length})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {urgent.slice(0, 8).map((o) => (
          <Link to="/pedidos" key={o.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 hover:bg-white/5 transition-colors ${DUE_STYLES[o.estado_entrega].card}`} data-testid={`attention-${o.id}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${DUE_STYLES[o.estado_entrega].dot}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{o.cliente} <span className="text-zinc-500">· {o.descripcion}</span></div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{fmtDate(o.fecha_entrega)}</div>
            </div>
            <StageBadge stage={o.stage} />
            {o.asignado_nombre && <Avatar name={o.asignado_nombre} />}
            <DueBadge status={o.estado_entrega} />
          </Link>
        ))}
      </div>
    </div>
  );
};
