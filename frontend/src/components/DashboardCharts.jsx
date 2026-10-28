import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import { STAGE_HEX, money } from "@/lib/stages";

const monthLabel = (k) => new Date(`${k}-15T12:00:00`).toLocaleDateString("es", { month: "short", year: "2-digit" });
const LINE_MARGIN = { left: 0, right: 10, top: 5 };
const LABEL_STYLE = { color: "#a1a1aa" };
const ITEM_STYLE = { color: "#e4e4e7" };
const LEGEND_STYLE = { fontSize: 12 };
const DOT = { r: 3 };
const ACTIVE_DOT = { r: 6 };
// CAMBIO QUIRÚRGICO: Cambiamos el $ por Q
const yTick = (v) => `Q${v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : v}`;
const tooltipStyle = { background: "#09090b", border: "1px solid #27272a", borderRadius: 12, fontSize: 12 };

const RevenueChart = ({ data }) => (
  <div className="lg:col-span-2 card-glass rounded-2xl p-6" data-testid="chart-revenue">
    <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Últimos 12 meses</div>
    <h2 className="font-display text-xl mb-5">Ingresos por mes</h2>
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.map((d) => ({ ...d, label: monthLabel(d.mes) }))} margin={LINE_MARGIN}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={yTick} width={48} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(v)} labelStyle={LABEL_STYLE} />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Line type="monotone" dataKey="ventas" name="Vendido" stroke="#d97706" strokeWidth={2.5} dot={DOT} activeDot={ACTIVE_DOT} />
          <Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="#22d3ee" strokeWidth={2.5} dot={DOT} activeDot={ACTIVE_DOT} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const StagePie = ({ data }) => {
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <div className="card-glass rounded-2xl p-6" data-testid="chart-stages">
      <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Distribución</div>
      <h2 className="font-display text-xl mb-2">Pedidos por etapa</h2>
      <div className="h-56 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="stage" innerRadius="58%" outerRadius="90%" paddingAngle={2} stroke="none">
              {data.map((d) => <Cell key={d.stage} fill={STAGE_HEX[d.stage]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} itemStyle={ITEM_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-display text-3xl font-light">{total}</span>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">pedidos</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
        {data.map((d) => (
          <span key={d.stage} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span className="w-2 h-2 rounded-full" style={{ background: STAGE_HEX[d.stage] }} />{d.stage} {d.total}
          </span>
        ))}
      </div>
    </div>
  );
};

export const DashboardCharts = () => {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/stats/charts").then((r) => setData(r.data)).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
      {data.ingresos && <RevenueChart data={data.ingresos} />}
      <StagePie data={data.etapas} />
    </div>
  );
};