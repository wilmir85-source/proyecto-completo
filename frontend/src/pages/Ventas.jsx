import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useUsers } from "@/hooks/useUsers";
import { money, fmtDate } from "@/lib/stages";
import { OrderDetail } from "@/components/OrderDetail";
import { PayBadge, StageBadge, DueBadge } from "@/components/Badges";

const FILTERS = [["debe", "Deben"], ["pagado", "Pagados"], ["todos", "Todos"]];

const Stat = ({ label, value, tone = "text-zinc-100", testid }) => (
  <div className="card-glass rounded-2xl p-5" data-testid={testid}>
    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">{label}</div>
    <div className={`font-display text-3xl font-light ${tone}`}>{value}</div>
  </div>
);

export default function Ventas() {
  const { users } = useUsers();
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("debe");
  const [selectedId, setSelectedId] = useState(null);

  const load = () => {
    api.get("/sales/summary").then((r) => setSummary(r.data));
    api.get("/orders").then((r) => setOrders(r.data));
  };
  useEffect(() => { load(); }, []);

  const list = orders.filter((o) => filter === "todos" || o.estado_pago === filter);

  return (
    <div className="p-5 md:p-12 max-w-[1400px]">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">Caja</div>
        <h1 className="font-display text-4xl font-light">Ventas y abonos</h1>
      </header>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Total vendido" value={money(summary?.total_vendido)} testid="sales-total" />
        <Stat label="Abonado" value={money(summary?.total_abonado)} tone="text-emerald-400" testid="sales-paid" />
        <Stat label="Por cobrar" value={money(summary?.saldo_pendiente)} tone="text-red-400" testid="sales-pending" />
        <Stat label="Clientes que deben" value={summary?.pedidos_con_deuda ?? 0} tone="text-amber-400" testid="sales-debtors" />
      </div>
      <div className="flex gap-2 mb-4">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} data-testid={`sales-filter-${k}`}
            className={`text-xs px-4 py-1.5 rounded-full border transition-colors ${filter === k ? "bg-amber-600 text-black border-amber-600" : "border-white/10 text-zinc-400 hover:text-zinc-100"}`}>{l}</button>
        ))}
      </div>
      <div className="card-glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]" data-testid="sales-table">
          <thead className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/10">
            <tr>{["Cliente", "Pedido", "Etapa", "Entrega", "Total", "Abonado", "Saldo", "Estado"].map((h) => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} onClick={() => setSelectedId(o.id)} className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors" data-testid={`sales-row-${o.id}`}>
                <td className="px-4 py-3"><div>{o.cliente}</div><div className="text-[10px] text-zinc-500">{o.telefono_cliente}</div></td>
                <td className="px-4 py-3 text-zinc-400 max-w-[220px] truncate">{o.descripcion}</td>
                <td className="px-4 py-3"><StageBadge stage={o.stage} /></td>
                <td className="px-4 py-3 text-xs">{["atrasado", "por_vencer"].includes(o.estado_entrega) ? <DueBadge status={o.estado_entrega} /> : fmtDate(o.fecha_entrega, { day: "numeric", month: "short" })}</td>
                <td className="px-4 py-3 font-mono">{money(o.precio)}</td>
                <td className="px-4 py-3 font-mono text-emerald-400">{money(o.abonado)}</td>
                <td className={`px-4 py-3 font-mono ${o.saldo > 0 ? "text-red-400" : "text-zinc-500"}`}>{money(o.saldo)}</td>
                <td className="px-4 py-3"><PayBadge status={o.estado_pago} /></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-zinc-500">Sin pedidos en este filtro</td></tr>}
          </tbody>
        </table>
      </div>
      <OrderDetail order={orders.find((o) => o.id === selectedId)} users={users} onClose={() => setSelectedId(null)} onChange={load} />
    </div>
  );
}
