import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ArrowDownUp, AlertTriangle, Boxes } from "lucide-react";
import { toast } from "sonner";
import { apiError, fmtDate } from "@/lib/stages";
import { SimpleSelect } from "@/components/Selects";

const UNITS = ["g", "kg", "oz", "pz", "ml", "m"];
const EMPTY = { nombre: "", unidad: "g", cantidad: "", minimo: "", notas: "" };
const inp = "bg-zinc-900 border-zinc-800";

const MaterialDialog = ({ material, onClose, onSaved }) => {
  const [form, setForm] = useState(EMPTY);
  useEffect(() => { setForm(material?.id ? { ...material } : EMPTY); }, [material]);
  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });
  const save = async () => {
    if (!form.nombre) return toast.error("Pon un nombre");
    try {
      const body = { nombre: form.nombre, unidad: form.unidad, minimo: parseFloat(form.minimo) || 0, notas: form.notas };
      if (material.id) await api.patch(`/inventory/${material.id}`, body);
      else await api.post("/inventory", { ...body, cantidad: parseFloat(form.cantidad) || 0 });
      toast.success("Material guardado");
      onSaved();
    } catch (e) { toast.error(apiError(e)); }
  };
  return (
    <Dialog open={!!material} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-zinc-950 border-zinc-800" data-testid="material-dialog">
        <DialogHeader><DialogTitle className="font-display">{material?.id ? "Editar material" : "Nuevo material"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nombre (Oro 18k, Plata 925, Cera azul...)" value={form.nombre} onChange={set("nombre")} className={inp} data-testid="input-material-nombre" />
          <div className="grid grid-cols-3 gap-3">
            <SimpleSelect value={form.unidad} onChange={set("unidad")} options={UNITS} testid="select-material-unidad" />
            {!material?.id && <Input type="number" step="0.01" placeholder="Cantidad" value={form.cantidad} onChange={set("cantidad")} className={inp} data-testid="input-material-cantidad" />}
            <Input type="number" step="0.01" placeholder="Mínimo (alerta)" value={form.minimo} onChange={set("minimo")} className={inp} data-testid="input-material-minimo" />
          </div>
          <Input placeholder="Notas (proveedor, ubicación...)" value={form.notas} onChange={set("notas")} className={inp} data-testid="input-material-notas" />
          <Button onClick={save} className="w-full bg-amber-600 hover:bg-amber-500 text-black" data-testid="btn-save-material">Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AdjustDialog = ({ material, onClose, onSaved }) => {
  const [tipo, setTipo] = useState("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [moves, setMoves] = useState([]);
  useEffect(() => { if (material) api.get(`/inventory/${material.id}/movimientos`).then((r) => setMoves(r.data)); }, [material]);
  const save = async () => {
    const c = parseFloat(cantidad);
    if (!c || c <= 0) return toast.error("Cantidad inválida");
    try {
      await api.post(`/inventory/${material.id}/ajuste`, { cantidad: tipo === "entrada" ? c : -c, motivo });
      toast.success("Stock actualizado");
      setCantidad(""); setMotivo("");
      onSaved();
    } catch (e) { toast.error(apiError(e)); }
  };
  return (
    <Dialog open={!!material} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-h-[90vh] overflow-y-auto" data-testid="adjust-dialog">
        <DialogHeader><DialogTitle className="font-display">{material?.nombre} · {material?.cantidad} {material?.unidad}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {["entrada", "salida"].map((t) => (
              <button key={t} onClick={() => setTipo(t)} data-testid={`adjust-${t}`}
                className={`py-2 rounded-lg border text-sm capitalize transition-colors ${tipo === t ? (t === "entrada" ? "bg-emerald-600 text-black border-emerald-600" : "bg-red-600 text-white border-red-600") : "border-zinc-800 text-zinc-400"}`}>{t}</button>
            ))}
          </div>
          <Input type="number" step="0.01" placeholder={`Cantidad (${material?.unidad})`} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={inp} data-testid="input-adjust-cantidad" />
          <Input placeholder="Motivo (compra, merma, fundición...)" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inp} data-testid="input-adjust-motivo" />
          <Button onClick={save} className="w-full bg-amber-600 hover:bg-amber-500 text-black" data-testid="btn-save-adjust">Registrar</Button>
          <div className="text-xs uppercase tracking-widest text-zinc-500 pt-2">Movimientos</div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {moves.map((m) => (
              <div key={m.id} className="flex justify-between text-xs bg-zinc-900/60 rounded px-3 py-1.5">
                <span className={m.delta >= 0 ? "text-emerald-400 font-mono" : "text-red-400 font-mono"}>{m.delta >= 0 ? "+" : ""}{m.delta} {m.unidad}</span>
                <span className="text-zinc-500 truncate mx-2 flex-1 text-right">{m.motivo} · {m.usuario} · {fmtDate(m.fecha)}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MaterialCard = ({ m, staff, onEdit, onAdjust, onDelete }) => (
  <div className={`card-glass rounded-2xl p-5 border group ${m.bajo ? "border-red-500/60 bg-red-950/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]" : "border-white/5"}`} data-testid={`material-${m.id}`}>
    <div className="flex items-start justify-between mb-3">
      <div className="min-w-0">
        <div className="font-medium truncate">{m.nombre}</div>
        {m.notas && <div className="text-[11px] text-zinc-500 truncate">{m.notas}</div>}
      </div>
      {m.bajo && <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-red-500/40 text-red-400 bg-red-500/15 shrink-0" data-testid={`material-low-${m.id}`}><AlertTriangle className="w-3 h-3" />Bajo</span>}
    </div>
    <div className={`font-display text-4xl font-light ${m.bajo ? "text-red-400" : "text-zinc-100"}`} data-testid={`material-qty-${m.id}`}>
      {Number(m.cantidad).toLocaleString("es")}<span className="text-base text-zinc-500 ml-1">{m.unidad}</span>
    </div>
    <div className="text-xs text-zinc-500 mt-1">Mínimo: {m.minimo} {m.unidad}</div>
    {staff && (
      <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
        <Button size="sm" onClick={onAdjust} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-100" data-testid={`btn-adjust-${m.id}`}><ArrowDownUp className="w-3.5 h-3.5 mr-1" />Ajustar</Button>
        <Button size="sm" variant="ghost" onClick={onEdit} data-testid={`btn-edit-material-${m.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="hover:text-red-400" data-testid={`btn-delete-material-${m.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    )}
  </div>
);

export default function Inventario() {
  const { user } = useAuth();
  const staff = ["admin", "ventas"].includes(user?.role);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const load = () => api.get("/inventory").then((r) => { setItems(r.data); setAdjusting((a) => (a ? r.data.find((m) => m.id === a.id) : a)); });
  useEffect(() => { load(); }, []);

  const remove = async (m) => {
    if (!window.confirm(`¿Eliminar ${m.nombre}?`)) return;
    try { await api.delete(`/inventory/${m.id}`); toast.success("Eliminado"); load(); } catch (e) { toast.error(apiError(e)); }
  };
  const low = items.filter((m) => m.bajo);

  return (
    <div className="p-5 md:p-12 max-w-[1400px]">
      <header className="flex flex-wrap gap-4 items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">Materiales</div>
          <h1 className="font-display text-4xl font-light">Inventario</h1>
          {low.length > 0 && <div className="text-sm text-red-400 mt-2 flex items-center gap-1.5" data-testid="inventory-low-count"><AlertTriangle className="w-4 h-4" />{low.length} material(es) bajo el mínimo</div>}
        </div>
        {staff && <Button onClick={() => setEditing({})} className="bg-amber-600 hover:bg-amber-500 text-black" data-testid="btn-new-material"><Plus className="w-4 h-4 mr-1" />Nuevo material</Button>}
      </header>
      {items.length === 0 && (
        <div className="card-glass rounded-2xl p-10 text-center text-zinc-500"><Boxes className="w-8 h-8 mx-auto mb-3 text-zinc-600" />Registra tu oro, plata, ceras, piedras...</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="inventory-grid">
        {[...low, ...items.filter((m) => !m.bajo)].map((m) => (
          <MaterialCard key={m.id} m={m} staff={staff} onEdit={() => setEditing(m)} onAdjust={() => setAdjusting(m)} onDelete={() => remove(m)} />
        ))}
      </div>
      <MaterialDialog material={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      <AdjustDialog material={adjusting} onClose={() => setAdjusting(null)} onSaved={load} />
    </div>
  );
}
