import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { STAGES, ORDER_TYPES, toISO, toLocalInput, apiError } from "@/lib/stages";
import { useFinishOrder } from "@/components/FinishOrderDialog";
import { DeadlineProgressBar } from "@/components/DeadlineProgressBar";

const Label = ({ children }) => <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">{children}</div>;

// ESTADOS INTERNOS PARA LAS IMPORTACIONES
const IMPORT_STAGES = [
  "Comprada (USA)",
  "En Bodega USA",
  "En Vuelo a GT",
  "En Aduana (GT)",
  "Lista en Taller",
  "Entregada al Cliente"
];

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

  const isImport = order.tipo === "Importación de máquinas";

  return (
    <div className="grid grid-cols-2 gap-3" data-testid="order-work">
      
      {/* ETAPA / DEPARTAMENTO */}
      <div className={isImport ? "col-span-2" : ""}>
        <Label>Etapa / departamento</Label>
        <select 
          value={order.stage} 
          onChange={(e) => patch({ stage: e.target.value }, `Movido a ${e.target.value}`)}
          className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
        >
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* RASTREADOR DE IMPORTACIÓN (SOLO SI ES IMPORTACIÓN) */}
      {isImport && (
        <div className="col-span-2 bg-blue-950/20 border border-blue-900/50 p-3 rounded-lg mt-1">
          <Label>Seguimiento del Paquete (Interno)</Label>
          <select 
            value={order.import_status || IMPORT_STAGES[0]} 
            onChange={(e) => patch({ import_status: e.target.value }, `Importación: ${e.target.value}`)}
            className="flex h-9 w-full rounded-md border border-blue-800 bg-blue-950/50 px-3 py-1 text-sm text-blue-200 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            {IMPORT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="text-[10px] text-blue-400/70 mt-1.5">* Esta información es privada y no se muestra al cliente en el PDF ni en el seguimiento.</p>
        </div>
      )}

      {/* TIPO DE TRABAJO */}
      {staff && (
        <div className="col-span-2">
          <Label>Tipo de trabajo</Label>
          <select 
            value={order.tipo || "Fabricación"} 
            onChange={(e) => patch({ tipo: e.target.value }, `Tipo: ${e.target.value}`)}
            className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
          >
            {ORDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {/* ASIGNAR TRABAJADOR */}
      <div>
        <Label>Asignar joyero / trabajador</Label>
        {staff ? (
          <select 
            value={order.asignado_a || ""} 
            onChange={(e) => patch({ asignado_a: e.target.value || null }, "Asignación actualizada")}
            className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
          >
            <option value="">Sin asignar</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        ) : (
          <div className="h-9 flex items-center text-sm text-zinc-300">{order.asignado_nombre || "Sin asignar"}</div>
        )}
      </div>

      {/* FECHA DE ENTREGA Y MATERIALES */}
      {staff && (
        <>
          <div className="col-span-2">
            <Label>Fecha de entrega estimada</Label>
            <Input type="datetime-local" defaultValue={toLocalInput(order.fecha_entrega)} className="bg-zinc-900 border-zinc-800"
              onBlur={(e) => e.target.value !== toLocalInput(order.fecha_entrega) && patch({ fecha_entrega: toISO(e.target.value) }, "Fecha actualizada")}
            />
          </div>
          {/* Ocultamos los materiales de joyería si es una importación */}
          {!isImport && (
            <div className="col-span-2 grid grid-cols-3 gap-3">
              {[["metal", "Metal", "text"], ["peso_metal", "Peso metal (g)", "number"], ["piedra", "Tipo de piedra", "text"]].map(([k, l, t]) => (
                <div key={k}>
                  <Label>{l}</Label>
                  <Input type={t} step="0.01" defaultValue={order[k] ?? ""} className="bg-zinc-900 border-zinc-800"
                    onBlur={(e) => {
                      const v = t === "number" ? (e.target.value === "" ? null : parseFloat(e.target.value)) : e.target.value;
                      if (v !== (order[k] ?? (t === "number" ? null : ""))) patch({ [k]: v }, `${l} actualizado`);
                    }} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!staff && (order.metal || order.peso_metal || order.piedra) && !isImport && (
        <div className="col-span-2 text-xs text-zinc-400">{[order.metal, order.peso_metal && `${order.peso_metal} g`, order.piedra].filter(Boolean).join(" · ")}</div>
      )}

      {/* PROGRESO Y BARRA DE TIEMPO */}
      <div className="col-span-2 mt-2">
        <div className="flex justify-between mb-1"><Label>Progreso del trabajo</Label><span className="text-xs font-mono text-amber-400">{progreso}%</span></div>
        <Slider value={[progreso]} max={100} step={5} onValueChange={([v]) => setProgreso(v)}
          onValueCommit={([v]) => {
            clearTimeout(timer.current);
            timer.current = setTimeout(() => v !== order.progreso && patch({ progreso: v }, `Progreso ${v}%`), 700);
          }} />
        
        <DeadlineProgressBar fecha_entrega={order.fecha_entrega} progreso={order.progreso} stage={order.stage} />
      </div>
    </div>
  );
};