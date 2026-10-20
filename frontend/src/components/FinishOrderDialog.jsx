import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Plus, Trash2, PackageMinus } from "lucide-react";
import { toast } from "sonner";
import { money, apiError } from "@/lib/stages";
import { SimpleSelect } from "@/components/Selects";

const newRow = () => ({ key: crypto.randomUUID(), material_id: "", cantidad: "" });

const Ctx = createContext({ notifyFinished: () => {} });
export const useFinishOrder = () => useContext(Ctx);

const SaldoAlert = ({ order }) => (
  <div className="rounded-xl border border-red-500/50 bg-red-950/40 p-4 flex gap-3" data-testid="finish-saldo-alert">
    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
    <div>
      <div className="font-medium text-red-300">Saldo pendiente: {money(order.saldo)}</div>
      <div className="text-xs text-red-200/70 mt-1">{order.cliente} pagó {money(order.abonado)} de {money(order.precio)}. Cobra antes de entregar.</div>
    </div>
  </div>
);

const ConsumeForm = ({ order, onDone }) => {
  const [materials, setMaterials] = useState(null);
  const [rows, setRows] = useState(() => [newRow()]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/inventory").then((r) => setMaterials(r.data)).catch(() => setMaterials([])); }, []);
  const setRow = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const opts = (materials || []).map((m) => ({ value: m.id, label: `${m.nombre} (${m.cantidad} ${m.unidad})` }));

  const submit = async () => {
    const items = rows.filter((r) => r.material_id && parseFloat(r.cantidad) > 0).map((r) => ({ material_id: r.material_id, cantidad: parseFloat(r.cantidad) }));
    if (!items.length) return toast.error("Agrega al menos un material con cantidad");
    setSaving(true);
    try {
      const { data } = await api.post("/inventory/consume", { order_id: order.id, items });
      toast.success("Inventario actualizado");
      data.materiales.filter((m) => m.bajo).forEach((m) => toast.warning(`${m.nombre} quedó bajo el mínimo (${m.cantidad} ${m.unidad})`));
      onDone();
    } catch (e) { toast.error(apiError(e)); }
    setSaving(false);
  };

  if (materials && !materials.length) return <div className="text-xs text-zinc-500">No hay materiales en inventario.</div>;
  return (
    <div className="space-y-2" data-testid="finish-consume-form">
      <div className="text-xs uppercase tracking-widest text-zinc-500 flex items-center gap-2"><PackageMinus className="w-4 h-4" />¿Descontar material usado?</div>
      {rows.map((r, i) => (
        <div key={r.key} className="flex gap-2">
          <SimpleSelect value={r.material_id} onChange={(v) => setRow(i, "material_id", v)} options={opts} placeholder="Material" className="flex-1" testid={`consume-material-${i}`} />
          <Input type="number" step="0.01" placeholder="Cant." value={r.cantidad} onChange={(e) => setRow(i, "cantidad", e.target.value)} className="w-24 bg-zinc-900 border-zinc-800" data-testid={`consume-qty-${i}`} />
          {rows.length > 1 && <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
        </div>
      ))}
      <button onClick={() => setRows([...rows, newRow()])} className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1" data-testid="consume-add-row"><Plus className="w-3 h-3" />Otro material</button>
      <div className="flex gap-2 pt-2">
        <Button onClick={submit} disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-500 text-black" data-testid="consume-submit">Descontar del inventario</Button>
        <Button variant="outline" onClick={onDone} className="border-zinc-700" data-testid="consume-skip">Omitir</Button>
      </div>
    </div>
  );
};

export const FinishOrderProvider = ({ children }) => {
  const [order, setOrder] = useState(null);
  return (
    <Ctx.Provider value={{ notifyFinished: setOrder }}>
      {children}
      <Dialog open={!!order} onOpenChange={(o) => !o && setOrder(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md" data-testid="finish-order-dialog">
          <DialogHeader><DialogTitle className="font-display">Pedido terminado · {order?.cliente}</DialogTitle></DialogHeader>
          {order && (
            <div className="space-y-5">
              {order.saldo > 0 && <SaldoAlert order={order} />}
              <ConsumeForm order={order} onDone={() => setOrder(null)} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
};
