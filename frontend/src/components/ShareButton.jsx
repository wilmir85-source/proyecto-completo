import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Share2, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { apiError, waPhone } from "@/lib/stages";
import { useBrand } from "@/hooks/useBrand";

export const ShareButton = ({ order }) => {
  const brand = useBrand();
  const [link, setLink] = useState("");
  const [phone, setPhone] = useState(order.telefono_cliente || "");

  const create = async () => {
    try {
      const { data } = await api.post(`/orders/${order.id}/share`);
      const url = `${window.location.origin}${data.path}`;
      setLink(url);
      if (data.telefono) setPhone(data.telefono);
      await navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Enlace copiado");
    } catch (e) { toast.error(apiError(e)); }
  };

  if (!link) {
    return (
      <Button onClick={create} variant="outline" className="w-full border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10" data-testid="btn-share-order">
        <Share2 className="w-4 h-4 mr-2" />Compartir seguimiento con el cliente
      </Button>
    );
  }
  const msg = `Hola ${order.cliente.split(" ")[0]}, aquí puedes ver el avance de tu pedido en ${brand.nombre}: ${link}`;
  return (
    <div className="flex gap-2" data-testid="share-actions">
      <Button variant="outline" className="flex-1 border-zinc-700" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Enlace copiado"))} data-testid="btn-copy-share">
        <Copy className="w-4 h-4 mr-2" />Copiar enlace
      </Button>
      <Button asChild className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-black" data-testid="btn-whatsapp-share">
        <a href={`https://wa.me/${waPhone(phone, brand.codigo_pais)}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle className="w-4 h-4 mr-2" />WhatsApp</a>
      </Button>
    </div>
  );
};
