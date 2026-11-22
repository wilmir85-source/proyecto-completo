import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiError, fmtDate } from "@/lib/stages";
import { ACTIONS, UNIT_LABEL } from "@/lib/requisitions";
import { MoneyGate, canSeeMoney } from "@/lib/permissions";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EstadoChip } from "@/components/RequisitionCard";

const Row = ({ label, children }) => (
  <div className="flex justify-between gap-4 py-3 border-b border-white/5 text-sm">
    <span className="text-zinc-400">{label}</span><span className="text-zinc-100 text-right">{children}</span>
  </div>
);

const StaffActions = ({ r, onSaved }) => {
  const [costo, setCosto] = useState(r.costo ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setCosto(r.costo ?? ""), [r]);

  const save = async (body, msg) => {
    setSaving(true);
    try { await api.patch(`/requisitions/${r.id}`, body); toast.success(msg); onSaved(); }
    catch (e) { toast.error(apiError(e)); }
    setSaving(false);
  };

  return (
    <div className="space-y-4 pt-2">
      <MoneyGate>
        <div className="flex gap-3">
          <Input type="number" min="0" step="any" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="Costo (opcional)" className="bg-zinc-950 border-zinc-700" data-testid="req-cost-input" />
          <button disabled={saving || costo === ""} onClick={() => save({ costo: parseFloat(costo) }, "Costo guardado")} data-testid="req-cost-save"
            className="min-h-[48px] px-5 rounded-xl border border-[#c5a572]/50 text-[#e3c993] text-sm hover:bg-[#c5a572]/10 disabled:opacity-50">Guardar costo</button>
        </div>
      </MoneyGate>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((a) => (
          <button key={a.estado} disabled={saving || r.estado === a.estado} onClick={() => save({ estado: a.estado }, `Marcado: ${a.label}`)} data-testid={`req-action-${a.estado}`}
            className={`min-h-[52px] rounded-xl text-sm font-medium border transition-colors disabled:opacity-40 ${a.estado === "rechazada" ? "border-red-500/40 text-red-300 hover:bg-red-500/10" : "border-white/10 text-zinc-100 hover:bg-white/5"}`}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export const RequisitionDialog = ({ r, onClose, onSaved }) => {
  const { user } = useAuth();
  return (
    <Dialog open={!!r} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-zinc-950 border-white/10 rounded-2xl max-w-lg" data-testid="req-dialog">
        {r && (
          <>
            <DialogHeader><DialogTitle className="font-display text-2xl">Pedido de {r.categoria}</DialogTitle></DialogHeader>
            <div>
              <Row label="Estado"><EstadoChip estado={r.estado} /></Row>
              <Row label="Material">{r.item}</Row>
              <Row label="Cantidad">{r.cantidad} {UNIT_LABEL[r.unidad] || r.unidad}</Row>
              <Row label="Lo pidió">{r.solicitante_nombre}</Row>
              <Row label="Fecha">{fmtDate(r.created_at)}</Row>
              {r.urgente && <Row label="Prioridad"><span className="text-red-300 font-medium">Urgente</span></Row>}
              {r.nota && <Row label="Nota">{r.nota}</Row>}
              {r.atendido_por && <Row label="Atendió">{r.atendido_por}</Row>}
            </div>
            {canSeeMoney(user) && <StaffActions r={r} onSaved={onSaved} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
