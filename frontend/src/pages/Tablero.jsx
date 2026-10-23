import { useEffect, useState } from "react";
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
  
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [filterMode, setFilterMode] = useState("all"); // all, mine, late, soon

  const load = () => api.get("/orders").then((r) => setOrders(r.data)).catch(() => toast.error("Error al cargar pedidos"));

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
      toast.success("Pedido eliminado");
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
    const el = document.getElementById(`kanban-col-${stageName.replace(/\s+/g, '-')}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b] overflow-hidden">
      
      {/* ENCABEZADO CON FILTROS (Fondo 100% sólido para que no se transparente) */}
      <header className="px-5 md:px-8 pt-4 pb-3 flex flex-col gap-3 bg-[#09090b] z-30 border-b border-white/5 shrink-0">
        <div className="flex flex-wrap gap-4 items-end justify-between">
          <div>
            <div className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-zinc-500 mb-1 md:mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Tablero en vivo
            </div>
            <h1 className="font-display text-2xl md:text-4xl font-light">Pedidos</h1>
          </div>
          {staff && <NewOrderDialog users={users} onCreated={load} />}
        </div>

        {/* BOTONES DE FILTRO */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
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

        {/* SELECTOR DE COLUMNA PARA CELULAR */}
        <div className="md:hidden mt-1">
          <select 
            onChange={(e) => scrollToStage(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 rounded-lg p-2 focus:outline-none focus:border-amber-500/50 appearance-none"
            defaultValue=""
          >
            <option value="" disabled>Saltar a departamento...</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </header>

      {/* CONTENEDOR DEL KANBAN */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory md:snap-none scroll-smooth">
        <div className="flex gap-4 md:gap-5 px-4 md:px-8 pb-8 pt-4 h-full min-w-max">
          {STAGES.map((stage) => {
            const list = displayOrders.filter((o) => o.stage === stage);
            const a = STAGE_STYLES[stage];
            return (
              <div 
                key={stage} 
                id={`kanban-col-${stage.replace(/\s+/g, '-')}`}
                className="w-[85vw] md:w-[300px] flex flex-col flex-shrink-0 snap-center md:snap-align-none h-full" 
                data-testid={`kanban-col-${stage}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragging) { moveTo(dragging, stage); setDragging(null); } }}
              >
                {/* TÍTULO DE LA COLUMNA (Fondo sólido) */}
                <div className={`flex items-center justify-between pb-3 pt-1 border-b-2 ${a.border} bg-[#09090b] shrink-0`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${a.bar}`} />
                    <span className={`font-display text-sm uppercase tracking-widest ${a.text}`}>{stage}</span>
                  </div>
                  <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full text-zinc-400 font-mono">{list.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pt-4 pr-1 pb-24 no-scrollbar">
                  {list.map((o) => (
                    <OrderCard key={o.id} order={o} canEdit={canWork(user, o)} canDelete={staff}
                      onOpen={() => setSelectedId(o.id)} onMove={(v) => moveTo(o.id, v)}
                      onDelete={() => remove(o.id)} onDragStart={() => setDragging(o.id)} />
                  ))}
                  {list.length === 0 && <div className="text-xs text-zinc-600 py-8 text-center border border-dashed border-white/5 rounded-xl bg-zinc-900/20">Sin pedidos aquí</div>}
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