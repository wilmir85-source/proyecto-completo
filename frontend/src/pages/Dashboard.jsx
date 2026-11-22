import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ShoppingBag, AlertTriangle, Clock, Hammer, ListChecks, ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { STAGES, STAGE_STYLES } from "@/lib/stages";
import { AttentionList } from "@/components/AttentionList";
import { DashboardCharts } from "@/components/DashboardCharts";

const stageColors = Object.fromEntries(STAGES.map((s) => [s, STAGE_STYLES[s].chip]));
const eyebrow = "text-xs uppercase tracking-[0.2em] text-stone-500 dark:text-zinc-400 mb-1";
const rowCls = "flex items-center gap-4 p-3 -mx-3 rounded-2xl min-h-[60px] hover:bg-amber-900/5 dark:hover:bg-white/5 active:scale-[0.99] transition-all";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
};

const SectionHead = ({ kicker, title, to, linkLabel, testid }) => (
  <div className="flex items-center justify-between mb-5 gap-3">
    <div><div className={eyebrow}>{kicker}</div><h2 className="font-display text-2xl text-stone-900 dark:text-white">{title}</h2></div>
    {to && (
      <Link to={to} data-testid={testid} className="btn-soft inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl text-sm font-semibold">
        {linkLabel} <ArrowRight className="w-4 h-4" />
      </Link>
    )}
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [allOrders, setAllOrders] = useState([]);
  const [tasks, setTasks] = useState([]);
  const recentOrders = allOrders.slice(0, 6);

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/orders").then((r) => setAllOrders(r.data)).catch(() => {});
    api.get("/tasks").then((r) => setTasks(r.data.filter((t) => !t.completada).slice(0, 5))).catch(() => {});
  }, []);

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-[1500px] space-y-8 md:space-y-10">
      <header className="pt-2">
        <div className={eyebrow}>{new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1 className="font-display text-4xl lg:text-6xl text-stone-900 dark:text-white leading-tight">
          {greeting()}, <span className="text-gold-gradient">{user?.name?.split(" ")[0]}</span>
        </h1>
        <p className="text-stone-600 dark:text-zinc-400 mt-3 text-base max-w-xl">Toca cualquier tarjeta para ir directo a lo que necesitas.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-5" data-testid="stats-grid">
        <StatCard to="/pedidos" icon={ShoppingBag} label="Pedidos activos" value={stats?.pedidos_activos ?? 0} testid="stat-total" />
        <StatCard to="/pedidos?filter=atrasados" icon={AlertTriangle} label="Atrasados" value={stats?.pedidos_atrasados ?? 0} tone="danger" testid="stat-overdue" />
        <StatCard to="/pedidos?filter=por_vencer" icon={Clock} label="Vencen en 48 h" value={stats?.pedidos_por_vencer ?? 0} tone="warning" testid="stat-soon" />
        <StatCard to="/mis-trabajos" icon={Hammer} label="Mis trabajos" value={stats?.mis_trabajos ?? 0} tone="success" testid="stat-mine" />
        <StatCard to="/tareas" icon={ListChecks} label="Tareas pendientes" value={stats?.tareas_pendientes ?? 0} tone="accent" testid="stat-tasks" />
      </div>

      <AttentionList orders={allOrders} />
      <DashboardCharts />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        <section className="lg:col-span-2 card-glass p-5 md:p-7">
          <SectionHead kicker="Así va el taller" title="Pedidos por etapa" to="/pedidos" linkLabel="Ver tablero" testid="link-kanban" />
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {STAGES.map((s) => (
              <Link key={s} to={`/pedidos?stage=${s}`} className={`rounded-2xl border p-4 min-h-[96px] hover:-translate-y-0.5 hover:shadow-lg transition-all ${stageColors[s]}`} data-testid={`stage-count-${s}`}>
                <div className="text-xs uppercase tracking-wider font-semibold opacity-90 leading-tight">{s}</div>
                <div className="font-display text-4xl mt-2">{stats?.pedidos_por_etapa?.[s] ?? 0}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="card-glass p-5 md:p-7">
          <SectionHead kicker="Agenda" title="Próximas tareas" to="/tareas" linkLabel="Ver todas" testid="link-tasks" />
          <div className="space-y-1">
            {tasks.length === 0 && <div className="text-sm text-stone-600 dark:text-zinc-400 py-4">No hay tareas pendientes.</div>}
            {tasks.map((t) => (
              <Link to="/tareas" key={t.id} className={rowCls} data-testid={`task-item-${t.id}`}>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.prioridad === "alta" ? "bg-red-500" : t.prioridad === "media" ? "bg-amber-500" : "bg-stone-400"}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate text-stone-900 dark:text-zinc-100">{t.titulo}</span>
                  {t.fecha && <span className="block text-xs text-stone-500 dark:text-zinc-400 mt-0.5">{new Date(t.fecha).toLocaleString("es")}</span>}
                </span>
                <ChevronRight className="w-5 h-5 text-stone-400 dark:text-zinc-500" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="card-glass p-5 md:p-7">
        <SectionHead kicker="Lo último" title="Pedidos recientes" to="/pedidos" linkLabel="Ver todos" testid="link-recent" />
        <div className="space-y-1">
          {recentOrders.length === 0 && <div className="text-sm text-stone-600 dark:text-zinc-400 py-6">Aún no hay pedidos. Toca el botón + para crear el primero.</div>}
          {recentOrders.map((o) => (
            <Link to={`/pedidos?pedido=${o.id}`} key={o.id} className={rowCls} data-testid={`order-row-${o.id}`}>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold shrink-0 ${stageColors[o.stage]}`}>{o.stage}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold truncate text-stone-900 dark:text-zinc-100">{o.cliente}</span>
                <span className="block text-xs text-stone-500 dark:text-zinc-400 truncate">{o.descripcion}</span>
              </span>
              <span className="hidden sm:block text-xs text-stone-500 dark:text-zinc-400">{o.fecha_entrega ? new Date(o.fecha_entrega).toLocaleDateString("es") : "—"}</span>
              <ChevronRight className="w-5 h-5 text-stone-400 dark:text-zinc-500 shrink-0" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

const TONES = {
  default: "from-[#f3dca4] to-[#c9a058] text-[#3b2a0c]",
  danger: "from-red-100 to-red-200 text-red-700 dark:from-red-500/20 dark:to-red-500/5 dark:text-red-300",
  warning: "from-amber-100 to-amber-200 text-amber-800 dark:from-amber-500/20 dark:to-amber-500/5 dark:text-amber-300",
  success: "from-emerald-100 to-emerald-200 text-emerald-800 dark:from-emerald-500/20 dark:to-emerald-500/5 dark:text-emerald-300",
  accent: "from-cyan-100 to-cyan-200 text-cyan-800 dark:from-cyan-500/20 dark:to-cyan-500/5 dark:text-cyan-300",
};

function StatCard({ to, icon: Icon, label, value, tone = "default", testid }) {
  return (
    <Link to={to} className="card-glass p-4 md:p-5 block group hover:-translate-y-1 active:scale-[0.98] transition-transform" data-testid={testid}>
      <div className="flex items-start justify-between mb-4">
        <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-sm ${TONES[tone]}`}>
          <Icon className="w-5 h-5" strokeWidth={1.5} />
        </span>
        <ArrowRight className="w-4 h-4 text-stone-400 dark:text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
      </div>
      <div className="font-display text-5xl text-gold-gradient leading-none">{value}</div>
      <div className="text-sm text-stone-600 dark:text-zinc-300 mt-2 font-medium">{label}</div>
    </Link>
  );
}
