import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { GanttChartSquare, AlertTriangle, Clock, Hammer, ListTodo, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { STAGES, STAGE_STYLES } from "@/lib/stages";
import { AttentionList } from "@/components/AttentionList";
import { DashboardCharts } from "@/components/DashboardCharts";

const stageColors = Object.fromEntries(STAGES.map((s) => [s, STAGE_STYLES[s].chip]));

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [allOrders, setAllOrders] = useState([]);
  const recentOrders = allOrders.slice(0, 6);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/orders").then((r) => setAllOrders(r.data)).catch(() => {});
    api.get("/tasks").then((r) => setTasks(r.data.filter((t) => !t.completada).slice(0, 5))).catch(() => {});
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="p-5 md:p-12 max-w-[1600px]">
      <header className="mb-10">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">Panel · {new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1 className="font-display text-4xl lg:text-5xl font-light tracking-tight">
          {greeting()}, <span className="text-amber-500">{user?.name?.split(" ")[0]}</span>
        </h1>
        <p className="text-zinc-400 mt-3 text-sm max-w-lg">Tu taller inteligente a tiempo real. Pedidos, tareas y asistente 24/7.</p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10" data-testid="stats-grid">
        <StatCard icon={GanttChartSquare} label="Pedidos activos" value={stats?.pedidos_activos ?? 0} testid="stat-total" />
        <StatCard icon={AlertTriangle} label="Atrasados" value={stats?.pedidos_atrasados ?? 0} tone="danger" testid="stat-overdue" />
        <StatCard icon={Clock} label="Vencen en 48h" value={stats?.pedidos_por_vencer ?? 0} tone="warning" testid="stat-soon" />
        <StatCard icon={Hammer} label="Mis trabajos" value={stats?.mis_trabajos ?? 0} tone="success" testid="stat-mine" />
        <StatCard icon={ListTodo} label="Tareas pendientes" value={stats?.tareas_pendientes ?? 0} tone="accent" testid="stat-tasks" />
      </div>

      <AttentionList orders={allOrders} />
      <DashboardCharts />

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2 card-glass rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Producción en vivo</div>
              <h2 className="font-display text-xl">Pedidos por etapa</h2>
            </div>
            <Link to="/pedidos" className="text-sm text-amber-500 hover:text-amber-400 flex items-center gap-1" data-testid="link-kanban">
              Tablero <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {STAGES.map((s) => (
              <div key={s} className={`rounded-xl border p-4 ${stageColors[s]}`} data-testid={`stage-count-${s}`}>
                <div className="text-xs uppercase tracking-widest opacity-80">{s}</div>
                <div className="font-display text-3xl font-light mt-2">{stats?.pedidos_por_etapa?.[s] ?? 0}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-glass rounded-2xl p-6">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Agenda</div>
          <h2 className="font-display text-xl mb-5">Próximas tareas</h2>
          <div className="space-y-3">
            {tasks.length === 0 && <div className="text-sm text-zinc-500">Sin tareas pendientes</div>}
            {tasks.map((t) => (
              <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/50 border border-white/5" data-testid={`task-item-${t.id}`}>
                <div className={`mt-1 w-2 h-2 rounded-full ${t.prioridad === "alta" ? "bg-red-500" : t.prioridad === "media" ? "bg-amber-500" : "bg-zinc-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.titulo}</div>
                  {t.fecha && <div className="text-xs text-zinc-500 mt-0.5">{new Date(t.fecha).toLocaleString("es")}</div>}
                </div>
              </div>
            ))}
          </div>
          <Link to="/tareas" className="text-xs text-amber-500 hover:text-amber-400 mt-4 inline-flex items-center gap-1">
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Recent orders */}
      <div className="card-glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Último movimiento</div>
            <h2 className="font-display text-xl">Pedidos recientes</h2>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {recentOrders.length === 0 && <div className="text-sm text-zinc-500 py-6">Aún no hay pedidos. Crea el primero desde el tablero.</div>}
          {recentOrders.map((o) => (
            <div key={o.id} className="py-3 flex items-center gap-4" data-testid={`order-row-${o.id}`}>
              <span className={`text-xs px-2 py-1 rounded border ${stageColors[o.stage]}`}>{o.stage}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{o.cliente}</div>
                <div className="text-xs text-zinc-500 truncate">{o.descripcion}</div>
              </div>
              <div className="text-xs text-zinc-500">{o.fecha_entrega ? new Date(o.fecha_entrega).toLocaleDateString("es") : "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone = "default", testid }) {
  const tones = {
    default: "text-zinc-100",
    danger: "text-red-400",
    warning: "text-yellow-400",
    success: "text-emerald-400",
    accent: "text-cyan-400",
  };
  return (
    <div className="card-glass rounded-2xl p-5 relative hover:border-white/10 transition-colors" data-testid={testid}>
      <Icon className={`w-5 h-5 ${tones[tone]} mb-4`} />
      <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">{label}</div>
      <div className={`font-display text-4xl font-light ${tones[tone]}`}>{value}</div>
    </div>
  );
}
