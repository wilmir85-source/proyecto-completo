import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { STAGES, ORDER_TYPES, toISO, toLocalInput, apiError } from "@/lib/stages";
import { SimpleSelect, UserSelect } from "@/components/Selects";
import { useFinishOrder } from "@/components/FinishOrderDialog";

const Label = ({ children }) => <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">{children}</div>;

export const OrderWork = ({ order, staff, users, onChange }) => {
  const [progreso, setProgreso] = useState(order.progreso || 0);
  const timer = useRef(null);

  const { notifyFinished } = useFinishOrder();
  
  const patch = async (body, msg) => {
    try {
      const { data } = await api.patch(`/orders/${order.id}`, body);
      toast.success(msg);
      if (body.stage === "Terminado") notifyFinished(data);
      onChange();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="grid grid-cols-2 gap-3" data-testid="order-work">
      <div>
        <Label>Etapa / departamento</Label>
        <SimpleSelect value={order.stage} onChange={(v) => patch({ stage: v }, `Movido a ${v}`)} options={STAGES} testid="detail-stage-select" />
      </div>
      {staff && (
        <div className="col-span-2">
          <Label>Tipo de trabajo</Label>
          <SimpleSelect value={order.tipo || "Fabricación"} onChange={(v) => patch({ tipo: v }, `Tipo: ${v}`)} options={ORDER_TYPES} testid="detail-tipo-select" />
        </div>
      )}
      <div>
        <Label>Asignar joyero / trabajador</Label>
        {staff
          ? <UserSelect users={users} value={order.asignado_a} onChange={(v) => patch({ asignado_a: v || null }, "Asignación actualizada")} testid="detail-assign-select" />
          : <div className="h-9 flex items-center text-sm text-zinc-300">{order.asignado_nombre || "Sin asignar"}</div>}
      </div>
      {staff && (
        <>
          <div className="col-span-2">
            <Label>Fecha de entrega estimada</Label>
            <Input type="datetime-local" defaultValue={toLocalInput(order.fecha_entrega)} className="bg-zinc-900 border-zinc-800"
              onBlur={(e) => e.target.value !== toLocalInput(order.fecha_entrega) && patch({ fecha_entrega: toISO(e.target.value) }, "Fecha actualizada")}
              data-testid="detail-fecha-input" />
          </div>
          <div className="col-span-2 grid grid-cols-3 gap-3">
            {[["metal", "Metal", "text"], ["peso_metal", "Peso metal (g)", "number"], ["piedra", "Tipo de piedra", "text"]].map(([k, l, t]) => (
              <div key={k}>
                <Label>{l}</Label>
                <Input type={t} step="0.01" defaultValue={order[k] ?? ""} className="bg-zinc-900 border-zinc-800" data-testid={`detail-${k}-input`}
                  onBlur={(e) => {
                    const v = t === "number" ? (e.target.value === "" ? null : parseFloat(e.target.value)) : e.target.value;
                    if (v !== (order[k] ?? (t === "number" ? null : ""))) patch({ [k]: v }, `${l} actualizado`);
                  }} />
              </div>
            ))}
          </div>
        </>
      )}
      {!staff && (order.metal || order.peso_metal || order.piedra) && (
        <div className="col-span-2 text-xs text-zinc-400">{[order.metal, order.peso_metal && `${order.peso_metal} g`, order.piedra].filter(Boolean).join(" · ")}</div>
      )}
      <div className="col-span-2">
        <div className="flex justify-between"><Label>Progreso</Label><span className="text-xs font-mono text-amber-400" data-testid="detail-progress-value">{progreso}%</span></div>
        <Slider value={[progreso]} max={100} step={5} onValueChange={([v]) => setProgreso(v)}
          onValueCommit={([v]) => {
            clearTimeout(timer.current);
            timer.current = setTimeout(() => v !== order.progreso && patch({ progreso: v }, `Progreso ${v}%`), 700);
          }} data-testid="detail-progress-slider" />
      </div>
    </div>
  );
};