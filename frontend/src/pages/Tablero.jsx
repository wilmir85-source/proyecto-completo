import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom"; // <-- NUEVO
import { api } from "@/lib/api";
import { toast } from "sonner";
import { STAGES, STAGE_STYLES, apiError } from "@/lib/stages";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { OrderDetail } from "@/components/OrderDetail";
import { OrderCard } from "@/components/OrderCard";
import { NewOrderDialog } from "@/components/NewOrderDialog";
import { useFinishOrder } from "@/components/FinishOrderDialog";
import { User, AlertTriangle, Clock } from "lucide-react";

const canWork = (user, o) => ["admin", "ventas"].includes(user?.role) || o.asignado_a === user?.id || o.stage === user?.departamento;

export default function Tablero() {
  const { user } = useAuth();
  const { notifyFinished } = useFinishOrder();
  const { users } = useUsers();
  const staff = ["admin", "ventas"].includes(user?.role);
  
  const [searchParams] = useSearchParams(); // <-- LEEMOS LA URL
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [filterMode, setFilterMode] = useState("all");
  const [activeStage, setActiveStage] = useState("Ventas");

  const kanbanRef = useRef(null);

  const load = () => api.get("/orders").then((r) => setOrders(r.data)).catch(() => toast.error("Error al cargar pedidos"));

  // <-- ESTO DETECTA SI VIENES DEL DASHBOARD Y APLICA EL FILTRO
  useEffect(() => {
    const filterParam = searchParams.get("filter");
    const stageParam = searchParams.get("stage");

    if (filterParam === "atrasados") setFilterMode("late");
    else if (filterParam === "por_vencer") setFilterMode("soon");
    
    if (stageParam) {
      setActiveStage(stageParam);
      // Hacemos un pequeño delay para que la pantalla cargue y luego hacemos scroll a la columna
      setTimeout(() => {
        const el = document.getElementById(`kanban-col-${stageParam.replace(/\s+/g, '-')}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      }, 500);
    }
  }, [searchParams]);

  useEffect(() => {
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, []);

  const moveTo = async (id, stage) => {
    try {
      const { data } = await api.patch(`/orders/${id}`, { stage });
      toast.success(`Movido a ${stage}`);
      if (stage === "Terminado") notifyFinished(data);
      load();
    } catch (e) { toast.error(apiError(e, "Error al mover")); }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Eliminar este pedido?")) return;
    try {
      await api.delete(`/orders/${id}`);
      toast.success("Pedido archivado en el historial");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const lateOrders = orders.filter((o) => o.estado_entrega === "atrasado");
  const soonOrders = orders.filter((o) => o.estado_entrega === "por_vencer");
  
  const displayOrders = orders.filter((o) => {
    if (filterMode === "late") return o.estado_entrega === "atrasado";
    if (filterMode === "soon") return o.estado_entrega === "por_vencer";
    if (filterMode === "mine") return canWork(user, o);
    return true;
  });

  const scrollToStage = (stageName) => {
    setActiveStage(stageName);
    const el = document.getElementById(`kanban-col-${stageName.replace(/\s+/g, '-')}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b] overflow-hidden">
      
      {/* ENCABEZADO CON FILTROS Y PESTAÑAS DE NAVEGACIÓN */}
      <header className="px-4 md:px-8 pt-4 pb-0 flex flex-col gap-2 bg-[#09090b] z-30 shrink-0 border-b border-white/5">
        <div className="flex flex-wrap gap-4 items-end justify-between">
          <div>
            <div className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-zinc-500 mb-1 md:mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Tablero en vivo
            </div>
            <h1 className="font-display text-2xl md:text-4xl font-light">Pedidos</h1>
          </div>
          {staff && <NewOrderDialog users={users} onCreated={load} />}
        </div>

        {/* FILTROS RÁPIDOS */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button onClick={() => setFilterMode("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${filterMode === "all" ? "bg-amber-500/20 text-amber-500 border-amber-500/50" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
            Todos
          </button>
          <button onClick={() => setFilterMode("mine")} className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap flex items-center gap-1.5 transition-colors ${filterMode === "mine" ? "bg-blue-500/20 text-blue-400 border-blue-500/50" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
            <User className="w-3 h-3" /> Mis pedidos
          </button>
          <button onClick={() => setFilterMode("late")} className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap flex items-center gap-1.5 transition-colors ${filterMode === "late" ? "bg-red-500/20 text-red-400 border-red-500/50" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
            <AlertTriangle className="w-3 h-3" /> {lateOrders.length} Atrasados
          </button>
          <button onClick={() => setFilterMode("soon")} className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap flex items-center gap-1.5 transition-colors ${filterMode === "soon" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
            <Clock className="w-3 h-3" /> {soonOrders.length} Por vencer
          </button>
        </div>

        {/* PESTAÑAS DE NAVEGACIÓN DE ETAPAS (DOT-STRIP) */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar pt-1">
          {STAGES.map((stage) => {
            const count = displayOrders.filter((o) => o.stage === stage).length;
            const isActive = activeStage === stage;
            const stageStyle = STAGE_STYLES[stage];
            return (
              <button
                key={stage}
                onClick={() => scrollToStage(stage)}
                className={`px-3 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive 
                    ? `${stageStyle.chip} shadow-sm scale-105` 
                    : "text-zinc-500 hover:text-zinc-300 bg-zinc-900/50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? stageStyle.bar : "bg-zinc-600"}`} />
                {stage}
                {count > 0 && (
                  <span className={`ml-1 px-1 rounded-full text-[9px] ${isActive ? "bg-white/20" : "bg-white/10"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* CONTENEDOR DEL KANBAN CON SNAP-SCROLL */}
      <div ref={kanbanRef} className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth pb-20 md:pb-0">
        <div className="flex gap-4 md:gap-5 px-4 md:px-8 pb-8 pt-2 h-full min-w-max">
          {STAGES.map((stage) => {
            const list = displayOrders.filter((o) => o.stage === stage);
            const a = STAGE_STYLES[stage];
            return (
              <div 
                key={stage} 
                id={`kanban-col-${stage.replace(/\s+/g, '-')}`}
                className="w-[88vw] md:w-[300px] flex flex-col flex-shrink-0 snap-center md:snap-align-none h-full" 
                data-testid={`kanban-col-${stage}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragging) { moveTo(dragging, stage); setDragging(null); } }}
              >
                {/* TÍTULO DE LA COLUMNA (Oculto en móvil, visible en PC) */}
                <div className={`hidden md:flex items-center justify-between pb-2 pt-1 border-b-2 ${a.border} shrink-0`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${a.bar}`} />
                    <span className={`font-display text-sm uppercase tracking-widest ${a.text}`}>{stage}</span>
                  </div>
                  <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full text-zinc-400 font-mono">{list.length}</span>
                </div>
                
                {/* Lista de tarjetas */}
                <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1 pb-10 no-scrollbar">
                  {list.map((o) => (
                    <OrderCard key={o.id} order={o} canEdit={canWork(user, o)} canDelete={staff}
                      onOpen={() => setSelectedId(o.id)} onMove={(v) => moveTo(o.id, v)}
                      onDelete={() => remove(o.id)} onDragStart={() => setDragging(o.id)} />
                  ))}
                  {list.length === 0 && (
                    <div className="text-xs text-zinc-600 py-6 text-center border border-dashed border-white/5 rounded-xl bg-zinc-900/20">
                      Sin pedidos en esta etapa
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <OrderDetail order={orders.find((o) => o.id === selectedId)} users={users} onClose={() => setSelectedId(null)} onChange={load} />
    </div>
  );
}