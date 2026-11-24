import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { STAGES, ORDER_TYPES, toISO, toLocalInput, apiError } from "@/lib/stages";
import { useFinishOrder } from "@/components/FinishOrderDialog";
import { DeadlineProgressBar } from "@/components/DeadlineProgressBar";
import { CheckCircle2, AlertTriangle, PauseCircle, RotateCcw } from "lucide-react";

const Label = ({ children }) => <div className="text-xs uppercase tracking-widest text-zinc-400 mb-1.5">{children}</div>;

const IMPORT_STAGES = ["Comprada (USA)", "En Bodega USA", "En Vuelo a GT", "En Aduana (GT)", "Lista en Taller", "Entregada al Cliente"];

const getNextStage = (currentStage, orderType) => {
  if (orderType === "Diseño" || orderType === "Molde" || orderType === "Diseño 3D") return "Terminado";
  if (currentStage === "Ventas") return "Diseño 3D";
  if (currentStage === "Diseño 3D") return "Ceras";
  if (currentStage === "Ceras" || currentStage === "Inyección") return "Casting";
  if (currentStage === "Casting" || currentStage === "Vulcanizado") return "Fabricación";
  if (currentStage === "Fabricación" || currentStage === "Grabado Láser" || currentStage === "Reparaciones") return "Terminado";
  return null; 
};

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
  const isDigital = order.tipo === "Diseño" || order.tipo === "Molde" || order.tipo === "Diseño 3D";
  const nextStage = getNextStage(order.stage, order.tipo);

  // --- FUNCIONES PARA LOS BOTONES DE PROBLEMAS ---
  const handlePausar = () => {
    const motivo = window.prompt("¿Por qué se pausa? (Ej. Falta piedra 2mm, esperando oro, etc.)");
    if (motivo) {
      patch({ notas: `${order.notas || ""}\n[PAUSADO en ${order.stage}]: ${motivo}` }, "Pedido pausado y motivo guardado");
    }
  };

  const handleRepetir = () => {
    const motivo = window.prompt("¿Qué pasó? (Ej. Se arruinó al pulir, falló la fundición, etc.)");
    if (!motivo) return;

    const isResin = isDigital || order.es_castable;
    const msg = isResin 
      ? "¿Regresar a Diseño 3D para imprimir de nuevo? (Cancelar = Regresar a Ceras/Inyección)" 
      : "¿Regresar a Ceras/Inyección para buscar molde de nuevo?";
      
    const goTo3D = window.confirm(msg);
    const targetStage = goTo3D ? "Diseño 3D" : "Ceras";
    
    patch({ 
      stage: targetStage, 
      progreso: 0, 
      notas: `${order.notas || ""}\n[REPETIR]: ${motivo} (Regresó a ${targetStage})` 
    }, `Repetido: Enviado a ${targetStage}`);
  };
  // -----------------------------------------------

  return (
    <div className="grid grid-cols-2 gap-3" data-testid="order-work">
      
      {/* ETAPA ACTUAL */}
      <div className={isImport ? "col-span-2" : ""}>
        <Label>Etapa actual</Label>
        {staff ? (
          <select 
            value={order.stage} 
            onChange={(e) => {
              if (e.target.value === "Entregado" && !staff) return toast.error("Solo Admin o Ventas pueden entregar.");
              patch({ stage: e.target.value }, `Movido a ${e.target.value}`);
            }}
            className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c5a572]"
          >
            {STAGES.map((s) => {
              if (s === "Entregado" && !staff) return null;
              return <option key={s} value={s}>{s}</option>;
            })}
          </select>
        ) : (
          <div className="h-9 flex items-center px-3 rounded-md bg-zinc-900/50 border border-zinc-800 text-sm text-[#c5a572] font-bold">
            {order.stage}
          </div>
        )}
      </div>

      {/* BOTÓN DE AVANCE DE CADENA */}
      {!staff && nextStage && (
        <div className="col-span-2 mt-1">
          <button 
            onClick={() => patch({ stage: nextStage, progreso: 100 }, `¡Trabajo terminado! Enviado a ${nextStage}`)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            <CheckCircle2 className="w-5 h-5" /> Terminar y enviar a {nextStage}
          </button>
        </div>
      )}

      {/* BOTONES DE PAUSA Y REPETIR (Solo para trabajadores) */}
      {!staff && (
        <div className="col-span-2 grid grid-cols-2 gap-2 mt-1">
          <button 
            onClick={handlePausar}
            className="w-full bg-amber-950/40 border border-amber-900/50 text-amber-400 font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <PauseCircle className="w-4 h-4" /> Pausar / Falta Mat.
          </button>
          <button 
            onClick={handleRepetir}
            className="w-full bg-red-950/40 border border-red-900/50 text-red-400 font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw className="w-4 h-4" /> Repetir / Arruinado
          </button>
        </div>
      )}

      {/* RASTREADOR DE IMPORTACIÓN */}
      {isImport && (
        <div className="col-span-2 bg-blue-950/20 border border-blue-900/50 p-3 rounded-lg mt-1">
          <Label>Seguimiento del Paquete (Interno)</Label>
          <select 
            value={order.import_status || IMPORT_STAGES[0]} 
            onChange={(e) => patch({ import_status: e.target.value }, `Importación: ${e.target.value}`)}
            className="flex h-9 w-full rounded-md border border-blue-800 bg-blue-950/50 px-3 py-1 text-sm text-blue-200 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            {IMPORT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* TIPO DE TRABAJO Y CASTABLE (Solo Admin/Ventas) */}
      {staff && !isImport && (
        <div className="col-span-2 grid grid-cols-2 gap-3 bg-zinc-900/30 p-3 rounded-lg border border-white/5 mt-2">
          <div>
            <Label>Tipo de trabajo</Label>
            <select 
              value={order.tipo || "Fabricación"} 
              onChange={(e) => patch({ tipo: e.target.value }, `Tipo: ${e.target.value}`)}
              className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c5a572]"
            >
              {ORDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>¿Es Castable? (Fundición)</Label>
            <label className="flex items-center gap-2 h-9 cursor-pointer">
              <input 
                type="checkbox" 
                checked={order.es_castable || false}
                onChange={(e) => patch({ es_castable: e.target.checked }, `Castable: ${e.target.checked ? "Sí" : "No"}`)}
                className="w-5 h-5 accent-[#c5a572] rounded border-zinc-800"
              />
              <span className="text-sm text-zinc-300">Requiere fundición</span>
            </label>
          </div>
        </div>
      )}

      {/* ASIGNAR TRABAJADOR */}
      <div>
        <Label>Asignar joyero / trabajador</Label>
        {staff ? (
          <select 
            value={order.asignado_a || ""} 
            onChange={(e) => patch({ asignado_a: e.target.value || null }, "Asignación actualizada")}
            className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c5a572]"
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

      {/* PROGRESO */}
      <div className="col-span-2 mt-2">
        <div className="flex justify-between mb-1"><Label>Progreso</Label><span className="text-xs font-mono text-amber-400">{progreso}%</span></div>
        <Slider value={[progreso]} max={100} step={5} onValueChange={([v]) => setProgreso(v)}
          onValueCommit={([v]) => {
            clearTimeout(timer.current);
            timer.current = setTimeout(() => v !== order.progreso && patch({ progreso: v }, `Progreso ${v}%`), 700);
          }} />
        <DeadlineProgressBar fecha_entrega={order.fecha_entrega} progreso={order.progreso} stage={order.stage} />
      </div>
      
      {/* BOTÓN FINAL (SOLO ADMIN/VENTAS) */}
      {staff && order.stage === "Terminado" && (
        <div className="col-span-2 mt-4">
          <button 
            onClick={() => patch({ stage: "Entregado" }, "Pedido entregado al cliente")}
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg"
          >
            Cerrar Orden y Entregar
          </button>
        </div>
      )}
    </div>
  );
};