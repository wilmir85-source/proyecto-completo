import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Copy, Smartphone, Share, PlusSquare } from "lucide-react";
import { toast } from "sonner";
import { SiriSetup } from "@/components/SiriSetup";
import { NotificationButton } from "@/components/NotificationButton"; // <-- IMPORTAMOS EL BOTÓN

const Step = ({ n, children }) => (
  <li className="flex gap-3 text-sm text-zinc-300">
    <span className="w-6 h-6 rounded-full bg-amber-600/20 border border-amber-500/30 text-amber-400 text-xs flex items-center justify-center shrink-0">{n}</span>
    <span>{children}</span>
  </li>
);

export default function IPhone() {
  const [path, setPath] = useState("");
  useEffect(() => { api.get("/me/calendar").then((r) => setPath(r.data.path)); }, []);
  const httpsUrl = `${process.env.REACT_APP_BACKEND_URL}${path}`;
  const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:");

  const copy = async () => {
    await navigator.clipboard.writeText(httpsUrl);
    toast.success("Enlace copiado");
  };

  return (
    <div className="p-5 md:p-12 max-w-3xl">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">Recordatorios</div>
        <h1 className="font-display text-4xl font-light">Jarvis en tu iPhone, Android y PC</h1>
      </header>

      {/* BOTÓN DE NOTIFICACIONES PUSH */}
      <div className="mb-6">
        <NotificationButton />
      </div>

      <SiriSetup />
      
      <div className="card-glass rounded-2xl p-6 mb-6" data-testid="calendar-card">
        <div className="flex items-center gap-3 mb-4">
          <CalendarPlus className="w-6 h-6 text-cyan-400" />
          <h2 className="font-display text-xl">Calendario con alarmas</h2>
        </div>
        <p className="text-sm text-zinc-400 mb-5">
          Suscríbete una vez y tu iPhone recibirá automáticamente tus tareas (alarma 30 min antes) y las entregas de pedidos
          (alarma 1 día y 2 horas antes). Se actualiza solo cuando Jarvis o el equipo agregan algo.
        </p>
        <div className="flex flex-wrap gap-3 mb-4">
          <Button asChild={!!path} disabled={!path} className="bg-cyan-600 hover:bg-cyan-500 text-black" data-testid="btn-subscribe-calendar">
            {path ? <a href={webcalUrl}>Suscribir en iPhone</a> : <span>Cargando...</span>}
          </Button>
          <Button variant="outline" onClick={copy} disabled={!path} className="border-zinc-700" data-testid="btn-copy-calendar"><Copy className="w-4 h-4 mr-1" />Copiar enlace</Button>
        </div>
        <code className="block text-[11px] text-zinc-500 break-all bg-zinc-950 rounded-lg p-3 border border-white/5" data-testid="calendar-url">{path ? httpsUrl : "Cargando enlace..."}</code>
        <p className="text-xs text-zinc-600 mt-3">Si el botón no abre Calendario: Ajustes → Calendario → Cuentas → Añadir cuenta → Otra → Añadir calendario suscrito → pega el enlace.</p>
      </div>

      <div className="card-glass rounded-2xl p-6" data-testid="pwa-card">
        <div className="flex items-center gap-3 mb-4">
          <Smartphone className="w-6 h-6 text-amber-400" />
          <h2 className="font-display text-xl">Instalar Jarvis como app (iPhone, Android, PC)</h2>
        </div>
        <ol className="space-y-3">
          <Step n={1}>Abre esta página en <b>Safari</b> en tu iPhone.</Step>
          <Step n={2}>Toca el botón Compartir <Share className="inline w-4 h-4" />.</Step>
          <Step n={3}>Elige <b>Agregar a pantalla de inicio</b> <PlusSquare className="inline w-4 h-4" />.</Step>
          <Step n={4}>Abre Jarvis desde el ícono y habla con él tocando el micrófono.</Step>
        </ol>
        <div className="grid md:grid-cols-2 gap-6 mt-8 pt-6 border-t border-white/5">
          <div data-testid="android-steps">
            <div className="font-display text-base mb-3 text-emerald-400">Android</div>
            <ol className="space-y-3">
              <Step n={1}>Abre la página en <b>Chrome</b>.</Step>
              <Step n={2}>Menú ⋮ → <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.</Step>
              <Step n={3}>Para recordatorios: copia el enlace del calendario y agrégalo en Google Calendar (web) → Otros calendarios → <b>Desde URL</b>.</Step>
            </ol>
          </div>
          <div data-testid="pc-steps">
            <div className="font-display text-base mb-3 text-sky-400">PC / Mac</div>
            <ol className="space-y-3">
              <Step n={1}>Abre la página en <b>Chrome</b> o <b>Edge</b>.</Step>
              <Step n={2}>Haz clic en el ícono de instalar en la barra de direcciones.</Step>
              <Step n={3}>Ideal para una pantalla en el taller con el tablero de <b>Pedidos</b> en vivo.</Step>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}