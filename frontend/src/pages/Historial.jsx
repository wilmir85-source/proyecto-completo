import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Search } from "lucide-react";
import { OrderDetail } from "@/components/OrderDetail";
import { fmtDate, money } from "@/lib/stages";

export default function Historial() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/orders/archived").then((r) => {
      setOrders(r.data);
      setLoading(false);
    }).catch((e) => {
      console.error(e);
      setLoading(false);
    });
  }, []);

  const filtered = orders.filter((o) => {
    const term = search.toLowerCase();
    return (
      (o.folio && o.folio.toLowerCase().includes(term)) ||
      (o.cliente && o.cliente.toLowerCase().includes(term)) ||
      (o.descripcion && o.descripcion.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-5 md:p-12 max-w-5xl mx-auto pb-32">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">Archivo Muerto</div>
        <h1 className="font-display text-4xl font-light">Historial de Pedidos</h1>
        <p className="text-sm text-zinc-400 mt-2">Pedidos eliminados que se guardan como evidencia para futuras consultas.</p>
      </header>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Buscar por Folio (MJ-0001), cliente o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {loading ? (
        <div className="text-zinc-500 text-center py-10">Buscando en los archivos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-zinc-500 text-center py-10 bg-zinc-900/50 rounded-xl border border-white/5">
          No se encontraron pedidos en el historial.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((o) => (
            <div 
              key={o.id} 
              onClick={() => setSelectedId(o.id)}
              className="bg-zinc-900/50 border border-white/5 hover:border-white/20 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer transition-colors"
            >
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-mono text-amber-500">{o.folio || "S/N"}</span>
                  <span className="text-sm font-medium text-white">{o.cliente}</span>
                </div>
                <div className="text-xs text-zinc-400">{o.descripcion}</div>
              </div>
              
              <div className="flex items-center gap-6 text-xs text-zinc-500">
                <div>
                  <div className="uppercase text-[10px] tracking-wider mb-1">Archivado</div>
                  <div>{fmtDate(o.archived_at)}</div>
                </div>
                <div>
                  <div className="uppercase text-[10px] tracking-wider mb-1">Total</div>
                  <div className="text-zinc-300">{money(o.precio)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <OrderDetail 
        order={orders.find(o => o.id === selectedId)} 
        users={[]} 
        onClose={() => setSelectedId(null)} 
        onChange={() => {}} 
      />
    </div>
  );
}