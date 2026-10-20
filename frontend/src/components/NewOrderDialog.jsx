import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { STAGES, ORDER_TYPES, toISO, apiError } from "@/lib/stages";
import { SimpleSelect, UserSelect } from "@/components/Selects";

const EMPTY = { cliente: "", telefono_cliente: "", descripcion: "", stage: "Ventas", precio: "", anticipo: "", fecha_entrega: "", notas: "", asignado_a: "", metal: "", peso_metal: "", piedra: "", tipo: "Fabricación" };
const inp = "bg-zinc-900 border-zinc-800";

export const NewOrderDialog = ({ users, onCreated }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [photos, setPhotos] = useState([]);
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  useEffect(() => { if (open) api.get("/clients").then((r) => setClients(r.data)).catch(() => {}); }, [open]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));
  const pickClient = (e) => {
    const name = e.target.value;
    const c = clients.find((x) => x.nombre.toLowerCase() === name.toLowerCase());
    setForm((f) => ({ ...f, cliente: name, telefono_cliente: c?.telefono || f.telefono_cliente }));
  };

  const create = async () => {
    if (!form.cliente || !form.descripcion) return toast.error("Completa cliente y descripción");
    const anticipo = parseFloat(form.anticipo) || 0;
    const precio = parseFloat(form.precio) || 0;
    if (anticipo > 0 && precio <= 0) return toast.error("Pon el precio total para registrar un anticipo");
    if (anticipo > precio) return toast.error("El anticipo no puede ser mayor al precio");
    setSaving(true);
    try {
      const match = clients.find((x) => x.nombre.toLowerCase() === form.cliente.trim().toLowerCase());
      const { anticipo: _a, ...rest } = form;
      const { data } = await api.post("/orders", {
        ...rest, precio, peso_metal: parseFloat(form.peso_metal) || null, fecha_entrega: toISO(form.fecha_entrega), asignado_a: form.asignado_a || null, cliente_id: match?.id || null,
      });
      if (anticipo > 0) await api.post(`/orders/${data.id}/abonos`, { monto: anticipo, nota: "Anticipo" });
      for (const f of photos) {
        const fd = new FormData();
        fd.append("file", f);
        await api.post(`/orders/${data.id}/photos`, fd).catch(() => toast.error(`Error subiendo ${f.name}`));
      }
      toast.success("Pedido creado");
      setOpen(false); setForm(EMPTY); setPhotos([]);
      onCreated();
    } catch (e) { toast.error(apiError(e, "Error al crear")); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-amber-600 hover:bg-amber-500 text-black font-medium" data-testid="btn-new-order"><Plus className="w-4 h-4 mr-1" /> Nuevo pedido</Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Nuevo pedido</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Cliente" list="clients-datalist" value={form.cliente} onChange={pickClient} className={inp} data-testid="input-order-cliente" />
            <datalist id="clients-datalist">{clients.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
            <Input placeholder="Teléfono cliente" value={form.telefono_cliente} onChange={set("telefono_cliente")} className={inp} data-testid="input-order-telefono" />
          </div>
          <Input placeholder="Descripción (anillo oro 18k, grabado, etc.)" value={form.descripcion} onChange={set("descripcion")} className={inp} data-testid="input-order-descripcion" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SimpleSelect value={form.stage} onChange={set("stage")} options={STAGES} testid="select-order-stage" />
            <SimpleSelect value={form.tipo} onChange={set("tipo")} options={ORDER_TYPES} testid="select-order-tipo" />
            <Input type="number" placeholder="Precio total" value={form.precio} onChange={set("precio")} className={inp} data-testid="input-order-precio" />
            <Input type="number" placeholder="Anticipo" value={form.anticipo} onChange={set("anticipo")} className={inp} data-testid="input-order-anticipo" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input placeholder="Metal (oro 18k...)" value={form.metal} onChange={set("metal")} className={inp} data-testid="input-order-metal" />
            <Input type="number" step="0.01" placeholder="Peso metal (g)" value={form.peso_metal} onChange={set("peso_metal")} className={inp} data-testid="input-order-peso" />
            <Input placeholder="Tipo de piedra" value={form.piedra} onChange={set("piedra")} className={inp} data-testid="input-order-piedra" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[10px] uppercase tracking-widest text-zinc-500">Fecha de entrega estimada
              <Input type="datetime-local" value={form.fecha_entrega} onChange={set("fecha_entrega")} className={`${inp} mt-1`} data-testid="input-order-fecha" />
            </label>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500">Asignar joyero / trabajador
              <UserSelect users={users} value={form.asignado_a} onChange={set("asignado_a")} testid="select-order-asignado" className="mt-1" />
            </label>
          </div>
          <Input placeholder="Notas (opcional)" value={form.notas} onChange={set("notas")} className={inp} data-testid="input-order-notas" />
          <label className="flex items-center gap-2 text-sm text-zinc-400 border border-dashed border-white/15 rounded-md px-3 py-2.5 cursor-pointer hover:border-amber-500/50 hover:text-amber-400 transition-colors">
            <ImageIcon className="w-4 h-4" />
            {photos.length ? `${photos.length} foto(s) seleccionada(s)` : "Subir fotos de referencia (JPG, PNG)"}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => setPhotos([...(e.target.files || [])])} data-testid="input-new-order-photos" />
          </label>
          {photos.length > 0 && (
            <div className="grid grid-cols-5 gap-2" data-testid="new-order-photo-previews">
              {previews.map((u) => <img key={u} src={u} alt="" className="aspect-square w-full object-cover rounded-md border border-white/10" />)}
            </div>
          )}
          <Button onClick={create} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-500 text-black" data-testid="btn-create-order">{saving ? "Guardando..." : "Crear pedido"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
