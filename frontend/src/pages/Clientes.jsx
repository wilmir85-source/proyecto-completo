import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, User, Cake, StickyNote, Crown } from "lucide-react";
import { toast } from "sonner";
import { ClientProfile } from "@/components/ClientProfile";
import { apiError } from "@/lib/stages";

const EMPTY = { nombre: "", telefono: "", email: "", notas: "", cumpleanos: "" };

export default function Clientes() {
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState("");

  const load = () => api.get("/clients").then((r) => setClients(r.data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.nombre) return toast.error("Pon un nombre");
    try {
      await api.post("/clients", { ...form, cumpleanos: form.cumpleanos || null });
      setOpen(false);
      setForm(EMPTY);
      load();
      toast.success("Cliente agregado");
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Eliminar este cliente?")) return;
    await api.delete(`/clients/${id}`); load(); toast.success("Eliminado");
  };
  const list = clients.filter((c) => c.nombre.toLowerCase().includes(q.toLowerCase()) || (c.telefono || "").includes(q));

  return (
    <div className="p-5 md:p-12">
      <header className="flex items-end justify-between mb-10">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">Directorio</div>
          <h1 className="font-display text-4xl font-light">Clientes</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-500 text-black" data-testid="btn-new-client"><Plus className="w-4 h-4 mr-1" />Nuevo cliente</Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-950 border-zinc-800">
            <DialogHeader><DialogTitle className="font-display">Nuevo cliente</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="bg-zinc-900 border-zinc-800" data-testid="input-client-nombre" />
              <Input placeholder="Teléfono con código de país (+52...)" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="bg-zinc-900 border-zinc-800" data-testid="input-client-telefono" />
              <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-zinc-900 border-zinc-800" data-testid="input-client-email" />
              <label className="block text-xs text-zinc-500">Cumpleaños
                <Input type="date" value={form.cumpleanos} onChange={(e) => setForm({ ...form, cumpleanos: e.target.value })} className="bg-zinc-900 border-zinc-800 mt-1" data-testid="input-client-cumpleanos" />
              </label>
              <Input placeholder="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="bg-zinc-900 border-zinc-800" data-testid="input-client-notas" />
              <Button onClick={create} className="w-full bg-amber-600 hover:bg-amber-500 text-black" data-testid="btn-create-client">Crear</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <Input placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} className="bg-zinc-950 border-zinc-800 max-w-sm mb-6" data-testid="client-search" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="clients-grid">
        {clients.length === 0 && <div className="text-sm text-zinc-500">Aún no hay clientes</div>}
        {list.map((c) => (
          <div key={c.id} onClick={() => setSelected(c.id)} className="card-glass rounded-2xl p-5 relative group cursor-pointer hover:border-amber-500/30 transition-colors" data-testid={`client-${c.id}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-600/15 border border-amber-500/30 flex items-center justify-center">
                <User className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-1.5">{c.nombre}{c.vip && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" data-testid={`client-vip-${c.id}`} />}</div>
                {c.telefono && <div className="text-xs text-zinc-500">{c.telefono}</div>}
              </div>
              <button onClick={(e) => { e.stopPropagation(); remove(c.id); }} className="text-zinc-600 hover:text-red-400 md:opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`del-client-${c.id}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
              {c.cumpleanos && <span className="flex items-center gap-1"><Cake className="w-3 h-3 text-pink-400" />{new Date(`${c.cumpleanos}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "long" })}</span>}
              {c.notas_importantes?.length > 0 && <span className="flex items-center gap-1 text-amber-300/80"><StickyNote className="w-3 h-3" />{c.notas_importantes[0].texto}{c.notas_importantes.length > 1 ? ` +${c.notas_importantes.length - 1}` : ""}</span>}
            </div>
            {c.notas && <div className="text-xs text-zinc-500 mt-2 line-clamp-2">{c.notas}</div>}
          </div>
        ))}
      </div>
      <ClientProfile clientId={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  );
}
