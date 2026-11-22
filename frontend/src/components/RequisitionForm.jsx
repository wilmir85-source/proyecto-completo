import { useState } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { apiError } from "@/lib/stages";
import { CATEGORIAS, UNIDADES } from "@/lib/requisitions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const EMPTY = { categoria: "Piedras", item: "", cantidad: "1", unidad: "pz", urgente: false, nota: "" };
const field = "bg-zinc-950 border-zinc-700 text-base";

const CategoryPicker = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de material">
    {CATEGORIAS.map(({ value: v, icon: Icon }) => (
      <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} data-testid={`req-cat-${v}`}
        className={`min-h-[52px] px-3 rounded-xl border flex items-center gap-2 text-sm text-left leading-tight transition-colors ${value === v ? "bg-[#c5a572]/15 border-[#c5a572]/60 text-[#e3c993] font-semibold" : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-600"}`}>
        <Icon className="w-5 h-5 shrink-0" /> {v}
      </button>
    ))}
  </div>
);

export const RequisitionForm = ({ onCreated }) => {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.item.trim()) return toast.error("Escribe qué material necesitas");
    const cantidad = parseFloat(form.cantidad);
    if (!(cantidad > 0)) return toast.error("La cantidad debe ser mayor a cero");
    setSaving(true);
    try {
      await api.post("/requisitions", { ...form, item: form.item.trim(), cantidad });
      toast.success("Listo. Tu pedido de material fue enviado a ventas y administración.");
      setForm(EMPTY);
      onCreated?.();
    } catch (err) { toast.error(apiError(err, "No se pudo enviar")); }
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="card-glass p-6 md:p-8 space-y-6" data-testid="requisition-form">
      <div>
        <h2 className="font-display text-2xl text-white">¿Qué material necesitas?</h2>
        <p className="text-sm text-zinc-400 mt-1">Llena estos datos y avisaremos a ventas y administración.</p>
      </div>
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-200">1. Tipo de material</label>
        <CategoryPicker value={form.categoria} onChange={set("categoria")} />
      </div>
      <div className="space-y-3">
        <label htmlFor="req-item" className="text-sm font-medium text-zinc-200">2. ¿Qué es exactamente?</label>
        <Input id="req-item" value={form.item} onChange={set("item")} placeholder="Ej. Zirconias blancas de 3 mm" className={field} data-testid="req-item-input" />
      </div>
      <div className="space-y-3">
        <label htmlFor="req-qty" className="text-sm font-medium text-zinc-200">3. ¿Cuánto necesitas?</label>
        <div className="flex gap-3">
          <Input id="req-qty" type="number" inputMode="decimal" min="0" step="any" value={form.cantidad} onChange={set("cantidad")} className={`${field} w-32`} data-testid="req-qty-input" />
          <select value={form.unidad} onChange={set("unidad")} aria-label="Unidad" data-testid="req-unit-select"
            className="flex-1 h-12 rounded-xl px-4 bg-zinc-950 border border-zinc-700 text-base text-zinc-100">
            {UNIDADES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-3">
        <label htmlFor="req-note" className="text-sm font-medium text-zinc-200">4. Nota (opcional)</label>
        <Textarea id="req-note" value={form.nota} onChange={set("nota")} rows={3} placeholder="Para qué pedido es, color, medida…" className={field} data-testid="req-note-input" />
      </div>
      <label className="flex items-center justify-between gap-4 min-h-[56px] px-4 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
        <span>
          <span className="block text-sm font-medium text-zinc-100">Lo necesito urgente</span>
          <span className="block text-xs text-zinc-400">Se marcará en rojo para que lo vean primero</span>
        </span>
        <Switch checked={form.urgente} onCheckedChange={set("urgente")} data-testid="req-urgent-switch" />
      </label>
      <button type="submit" disabled={saving} data-testid="req-submit"
        className="w-full min-h-[56px] rounded-2xl bg-[#c5a572] hover:bg-[#d4b88a] text-black text-base font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} Enviar pedido de material
      </button>
    </form>
  );
};
