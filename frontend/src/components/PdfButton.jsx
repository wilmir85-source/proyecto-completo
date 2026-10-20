import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const PdfButton = ({ order }) => {
  const [loading, setLoading] = useState(false);
  const download = async () => {
    setLoading(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/orders/${order.id}/pdf?tz=${encodeURIComponent(tz)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("jarvis_token")}` },
      });
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `orden_${order.cliente.replace(/\s+/g, "_")}_${order.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Orden de trabajo descargada");
    } catch { toast.error("No se pudo generar el PDF"); }
    setLoading(false);
  };
  return (
    <Button onClick={download} disabled={loading} variant="outline" className="w-full border-amber-500/40 text-amber-300 hover:bg-amber-500/10" data-testid="btn-download-pdf">
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
      {loading ? "Generando PDF..." : "Descargar Orden de Trabajo (PDF)"}
    </Button>
  );
};
