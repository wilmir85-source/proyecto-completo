import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiError } from "@/lib/stages";
import { ESTADOS } from "@/lib/requisitions";
import { canSeeMoney } from "@/lib/permissions";
import { useAuth } from "@/context/AuthContext";
import { RequisitionForm } from "@/components/RequisitionForm";
import { RequisitionCard } from "@/components/RequisitionCard";
import { RequisitionDialog } from "@/components/RequisitionDialog";

const FILTERS = [["todos", "Todos"], ...Object.entries(ESTADOS).map(([k, v]) => [k, v.label])];

const FilterChips = ({ value, onChange }) => (
  <div className="flex gap-2 overflow-x-auto touch-pan-x touch-pan-y scrollbar-thin pb-2">
    {FILTERS.map(([k, label]) => (
      <button key={k} onClick={() => onChange(k)} data-testid={`req-filter-${k}`}
        className={`shrink-0 min-h-[44px] px-4 rounded-full text-sm border transition-colors ${value === k ? "bg-[#c5a572]/15 border-[#c5a572]/60 text-[#e3c993] font-medium" : "border-white/10 text-zinc-300 hover:bg-white/5"}`}>
        {label}
      </button>
    ))}
  </div>
);

export default function Requisiciones() {
  const { user } = useAuth();
  const staff = canSeeMoney(user);
  const { id } = useParams();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("todos");
  const [opened, setOpened] = useState(null);

  const load = useCallback(() => api.get("/requisitions").then((r) => setItems(r.data)).catch((e) => toast.error(apiError(e))), []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!id) return setOpened(null);
    api.get(`/requisitions/${id}`).then((r) => setOpened(r.data)).catch((e) => { toast.error(apiError(e)); nav("/requisiciones", { replace: true }); });
  }, [id, nav]);

  const shown = items.filter((r) => filter === "todos" || r.estado === filter);
  const close = () => nav("/requisiciones");
  const saved = async () => { await load(); const { data } = await api.get(`/requisitions/${opened.id}`); setOpened(data); };

  return (
    <div className="p-5 md:p-10 max-w-6xl mx-auto space-y-8" data-testid="requisitions-page">
      <header>
        <div className="text-sm text-zinc-400 mb-2">Requisiciones</div>
        <h1 className="font-display text-3xl md:text-4xl text-white">Pedir material</h1>
        <p className="text-base text-zinc-300 mt-2 max-w-2xl">Pide piedras, oro, herramientas o lo que te falte. Ventas y administración reciben un aviso al instante.</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-2"><RequisitionForm onCreated={load} /></div>
        <section className="lg:col-span-3 space-y-4">
          <h2 className="font-display text-2xl text-white">{staff ? "Pedidos de material del taller" : "Mis pedidos de material"}</h2>
          <FilterChips value={filter} onChange={setFilter} />
          <div className="space-y-4" data-testid="req-list">
            {shown.length === 0 && <div className="card-glass p-8 text-center text-zinc-400" data-testid="req-empty">Todavía no hay pedidos aquí.</div>}
            {shown.map((r) => <RequisitionCard key={r.id} r={r} highlight={r.id === id} onOpen={() => nav(`/requisiciones/${r.id}`)} />)}
          </div>
        </section>
      </div>
      <RequisitionDialog r={opened} onClose={close} onSaved={saved} />
    </div>
  );
}
