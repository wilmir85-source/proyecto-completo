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

const canWork = (user, o) => ["admin", "ventas"].includes(user?.role) || o.asignado_a === user?.id || o.stage === user?.departamento;

export default function Tablero() {
  const { user } = useAuth();
  const { notifyFinished } = useFinishOrder();
  const { users } = useUsers();
  const staff = ["admin", "ventas"].includes(user?.role);
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dragging, setDragging] = useState(null);

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

  const late = orders.filter((o) => o.estado_entrega === "atrasado").length;
  const soon = orders.filter((o) => o.estado_entrega === "por_vencer").length;

  return (
    <div className="h-screen flex flex-col">
      <header className="px-5 md:px-8 pt-8 pb-4 flex flex-wrap gap-4 items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Tablero en vivo
          </div>
          <h1 className="font-display text-4xl font-light">Pedidos</h1>
          <div className="flex gap-3 mt-3 text-xs">
            <span className="text-red-400" data-testid="board-late-count">{late} atrasados</span>
            <span className="text-yellow-400" data-testid="board-soon-count">{soon} por vencer (48h)</span>
          </div>
        </div>
        {staff && <NewOrderDialog users={users} onCreated={load} />}
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-5 px-5 md:px-8 pb-8 pt-2 h-full min-w-max">
          {STAGES.map((stage) => {
            const list = orders.filter((o) => o.stage === stage);
            const a = STAGE_STYLES[stage];
            return (
              <div key={stage} className="w-[280px] flex flex-col flex-shrink-0" data-testid={`kanban-col-${stage}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragging) { moveTo(dragging, stage); setDragging(null); } }}>
                <div className={`flex items-center justify-between pb-3 border-b-2 ${a.border}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${a.bar}`} />
                    <span className={`font-display text-sm uppercase tracking-widest ${a.text}`}>{stage}</span>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">{list.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pt-4 pr-1">
                  {list.map((o) => (
                    <OrderCard key={o.id} order={o} canEdit={canWork(user, o)} canDelete={staff}
                      onOpen={() => setSelectedId(o.id)} onMove={(v) => moveTo(o.id, v)}
                      onDelete={() => remove(o.id)} onDragStart={() => setDragging(o.id)} />
                  ))}
                  {list.length === 0 && <div className="text-xs text-zinc-600 py-6 text-center border border-dashed border-white/5 rounded-xl">Vacío</div>}
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
