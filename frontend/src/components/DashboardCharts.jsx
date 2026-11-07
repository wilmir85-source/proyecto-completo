import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import { STAGE_HEX, money } from "@/lib/stages";

// --- COLORES DE GEMAS PARA EL GRÁFICO CIRCULAR ---
const JEWEL_COLORS = {
  "Ventas": "#1e3a8a", // Zafiro Azul Oscuro
  "Diseño 3D": "#6b21a8", // Amatista
  "Ceras": "#ca8a04", // Topacio Amarillo
  "Inyección": "#15803d", // Esmeralda
  "Vulcanizado": "#991b1b", // Rubí
  "Casting": "#c2410c", // Ópalo Naranja
  "Fabricación": "#e11d48", // Rubí Rosa
  "Grabado Láser": "#db2777", // Diamante Rosa
  "Reparaciones": "#f43f5e",
  "Importación de máquinas": "#65a30d", // Peridoto
  "Terminado": "#0f766e", // Aguamarina
  "Entregado": "#52525b", // Platino
};

const monthLabel = (k) => new Date(`${k}-15T12:00:00`).toLocaleDateString("es", { month: "short", year: "2-digit" });
const LINE_MARGIN = { left: 0, right: 10, top: 5 };
const LABEL_STYLE = { color: "#a1a1aa" };
const ITEM_STYLE = { color: "#e4e4e7" };
const LEGEND_STYLE = { fontSize: 12 };
const DOT = { r: 3, strokeWidth: 0 };
const ACTIVE_DOT = { r: 6, strokeWidth: 0 };

// Eje Y con la "Q" de Quetzales
const yTick = (v) => `Q${v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : v}`;

// Estilo del Tooltip (Cristal con borde dorado)
const tooltipStyle = { 
  background: "rgba(18, 18, 20, 0.85)", 
  border: "1px solid rgba(197, 165, 114, 0.4)", 
  borderRadius: 12, 
  fontSize: 12,
  backdropFilter: "blur(10px)",
  boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
};

const RevenueChart = ({ data }) => (
  <div className="lg:col-span-2 card-glass rounded-2xl p-6" data-testid="chart-revenue">
    <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Últimos 12 meses</div>
    <h2 className="font-display text-xl mb-5">Ingresos por mes</h2>
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.map((d) => ({ ...d, label: monthLabel(d.mes) }))} margin={LINE_MARGIN}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={yTick} width={48} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(v)} labelStyle={LABEL_STYLE} itemStyle={ITEM_STYLE} />
          <Legend wrapperStyle={LEGEND_STYLE} />
          
          {/* Línea Vendido: ORO */}
          <Line type="monotone" dataKey="ventas" name="Vendido" stroke="#c5a572" strokeWidth={3} dot={DOT} activeDot={ACTIVE_DOT} />
          
          {/* Línea Cobrado: PLATA */}
          <Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="#e4e4e7" strokeWidth={3} dot={DOT} activeDot={ACTIVE_DOT} />
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
            {/* El borde dorado (stroke) simula la montura de la joya */}
            <Pie 
              data={data} 
              dataKey="total" 
              nameKey="stage" 
              innerRadius="62%" 
              outerRadius="92%" 
              paddingAngle={3} 
              stroke="#c5a572" 
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.stage} fill={JEWEL_COLORS[d.stage] || STAGE_HEX[d.stage]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} itemStyle={ITEM_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Texto central con degradado dorado */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-display text-4xl text-gold-gradient">{total}</span>
          <span className="text-[10px] uppercase tracking-widest text-[#c5a572] mt-1">pedidos</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-2 mt-4">
        {data.map((d) => (
          <span key={d.stage} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-full border border-[#c5a572]/50" style={{ background: JEWEL_COLORS[d.stage] || STAGE_HEX[d.stage] }} />
            {d.stage} <span className="text-zinc-200 font-medium">{d.total}</span>
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