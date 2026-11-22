import { AlertTriangle } from "lucide-react";
import { CAT_ICON, ESTADOS, UNIT_LABEL } from "@/lib/requisitions";
import { fmtDate, money } from "@/lib/stages";
import { MoneyGate } from "@/lib/permissions";

export const EstadoChip = ({ estado }) => (
  <span className={`inline-flex items-center text-xs font-medium px-3 py-1 rounded-full border ${ESTADOS[estado]?.chip}`} data-testid="req-status">
    {ESTADOS[estado]?.label || estado}
  </span>
);

export const RequisitionCard = ({ r, onOpen, highlight }) => {
  const Icon = CAT_ICON[r.categoria] || CAT_ICON.Otro;
  return (
    <button onClick={() => onOpen(r)} data-testid={`req-card-${r.id}`}
      className={`card-glass w-full text-left p-5 flex gap-4 items-start transition-transform hover:-translate-y-0.5 ${highlight ? "ring-2 ring-[#c5a572]" : ""} ${r.urgente && r.estado === "pendiente" ? "border-red-500/50" : ""}`}>
      <span className="shrink-0 w-12 h-12 rounded-2xl bg-[#c5a572]/10 border border-[#c5a572]/30 flex items-center justify-center text-[#e3c993]">
        <Icon className="w-6 h-6" />
      </span>
      <span className="flex-1 min-w-0 space-y-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-white">{r.categoria}</span>
          {r.urgente && <span className="inline-flex items-center gap-1 text-xs text-red-300"><AlertTriangle className="w-3.5 h-3.5" /> Urgente</span>}
        </span>
        <span className="block text-sm text-zinc-200">{r.cantidad} {UNIT_LABEL[r.unidad] || r.unidad} · {r.item}</span>
        <span className="block text-xs text-zinc-400">Pidió {r.solicitante_nombre} · {fmtDate(r.created_at)}</span>
        <span className="flex flex-wrap items-center gap-3 pt-1">
          <EstadoChip estado={r.estado} />
          <MoneyGate>{r.costo != null && <span className="text-sm text-[#e3c993] font-medium" data-testid="req-cost">{money(r.costo)}</span>}</MoneyGate>
        </span>
      </span>
    </button>
  );
};
