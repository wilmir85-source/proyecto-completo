import { useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, apiError } from "@/lib/stages";
import { Avatar } from "@/components/Badges";

export const OrderHistory = ({ order, onChange, readOnly }) => {
  const [texto, setTexto] = useState("");

  const add = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    try {
      await api.post(`/orders/${order.id}/notas`, { texto });
      setTexto("");
      onChange();
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div data-testid="order-history">
      <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Bitácora de trabajo</div>
      {!readOnly && <form onSubmit={add} className="flex gap-2 mb-3">
        <Input placeholder="Agregar actualización (ej. pieza pulida, falta engaste)" value={texto} onChange={(e) => setTexto(e.target.value)} className="bg-zinc-900 border-zinc-800" data-testid="input-order-note" />
        <Button type="submit" size="icon" className="bg-cyan-600 hover:bg-cyan-500 text-black shrink-0" data-testid="btn-add-note"><Send className="w-4 h-4" /></Button>
      </form>}
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {[...order.historial].reverse().map((h) => (
          <div key={h.id} className="flex items-start gap-2 text-xs">
            <Avatar name={h.usuario} className="shrink-0" />
            <div className="min-w-0">
              <span className="text-zinc-300">{h.accion}</span>
              <div className="text-zinc-600">{h.usuario} · {fmtDate(h.fecha)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
