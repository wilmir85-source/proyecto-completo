import { useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate, apiError } from "@/lib/stages";
import { PayBadge } from "@/components/Badges";

export const OrderPayments = ({ order, onChange }) => {
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");

  const add = async () => {
    const m = parseFloat(monto);
    if (!m || m <= 0) return toast.error("Monto inválido");
    try {
      await api.post(`/orders/${order.id}/abonos`, { monto: m, nota });
      setMonto(""); setNota("");
      toast.success(`Abono de ${money(m)} registrado`);
      onChange();
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async (id) => {
    try { await api.delete(`/orders/${order.id}/abonos/${id}`); onChange(); } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="order-payments">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-widest text-zinc-500">Pagos</div>
        <PayBadge status={order.estado_pago} testid="detail-pay-status" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        {[["Total", order.precio], ["Abonado", order.abonado], ["Saldo", order.saldo]].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-zinc-900 border border-white/5 py-2">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">{l}</div>
            <div className={`font-display text-lg ${l === "Saldo" && v > 0 ? "text-red-400" : "text-zinc-100"}`} data-testid={`detail-${l.toLowerCase()}`}>{money(v)}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5 mb-3">
        {order.abonos.map((a) => (
          <div key={a.id} className="flex items-center justify-between text-xs bg-zinc-900/60 rounded-md px-3 py-2 group">
            <span className="text-emerald-400 font-mono">{money(a.monto)}</span>
            <span className="text-zinc-500 truncate mx-2 flex-1">{a.nota || "—"} · {a.registrado_por} · {fmtDate(a.fecha)}</span>
            <button onClick={() => remove(a.id)} className="text-zinc-600 hover:text-red-400" data-testid={`btn-del-abono-${a.id}`}><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input type="number" placeholder="Monto" value={monto} onChange={(e) => setMonto(e.target.value)} className="bg-zinc-900 border-zinc-800 w-28" data-testid="input-abono-monto" />
        <Input placeholder="Nota (efectivo, transferencia...)" value={nota} onChange={(e) => setNota(e.target.value)} className="bg-zinc-900 border-zinc-800" data-testid="input-abono-nota" />
        <Button onClick={add} className="bg-emerald-600 hover:bg-emerald-500 text-black" data-testid="btn-add-abono">Abonar</Button>
      </div>
    </div>
  );
};
