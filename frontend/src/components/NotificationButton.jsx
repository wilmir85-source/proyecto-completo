import { useState, useEffect } from "react";
import { Bell, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const NotificationButton = () => {
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // NUEVA LLAVE PÚBLICA GENERADA
  const VAPID_PUBLIC_KEY = "BBpVRfkvCX4Nq-Hzj84NvvIB1i08Tys9T2NPIpsWXioKzwPCIpcFF7QSCkpCzi8dIsobn6gHVDuq7UvV2g7yDAM";

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer.slice(0);
  };

  useEffect(() => {
    // Verificamos si el navegador soporta TODO lo necesario (incluyendo la variable Notification)
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus("unsupported");
      setErrorMsg("Tu dispositivo no soporta notificaciones, o no has instalado la app en la pantalla de inicio.");
      return;
    }

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setStatus("subscribed");
        else setStatus("ready");
      }).catch(() => setStatus("ready"));
    }).catch((err) => {
      console.error("Error SW:", err);
      setStatus("ready");
    });
  }, []);

  const subscribe = async () => {
    setStatus("loading");
    setErrorMsg("");
    
    // Doble verificación antes de pedir permiso (para evitar el error de iOS)
    if (!('Notification' in window)) {
      setStatus("unsupported");
      setErrorMsg("Debes instalar la app en tu pantalla de inicio para activar las notificaciones.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus("error");
        setErrorMsg("Permiso denegado. Ve a los ajustes de tu iPhone > Notificaciones > Jarvis y permite las notificaciones.");
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      await api.post('/notifications/subscribe', subscription.toJSON());
      setStatus("subscribed");
      toast.success("¡Notificaciones activadas!");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMsg(`Error: ${error.name} - ${error.message}`);
    }
  };

  const sendTest = async () => {
    try {
      await api.post('/notifications/test');
      toast.success("Notificación enviada. Revisa tu pantalla.");
    } catch (error) {
      toast.error("Error enviando la prueba. Revisa los logs de Render.");
    }
  };

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-amber-500" />
        <h3 className="font-medium text-white">Notificaciones Push</h3>
      </div>
      
      {status === "loading" && (
        <div className="text-zinc-400 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin"/> Verificando...
        </div>
      )}

      {(status === "error" || status === "unsupported") && (
        <div className="text-red-400 text-xs flex flex-col gap-1 bg-red-950/30 p-3 rounded-lg border border-red-500/20">
          <div className="flex items-center gap-1 font-medium"><AlertTriangle className="w-3 h-3"/> Aviso</div>
          <div>{errorMsg}</div>
          <button onClick={() => setStatus("ready")} className="text-white underline mt-2 text-left font-medium">Reintentar</button>
        </div>
      )}

      {status === "ready" && (
        <>
          <p className="text-xs text-zinc-400">Activa las notificaciones para que Jarvis te recuerde los pedidos.</p>
          <button onClick={subscribe} className="bg-amber-600 hover:bg-amber-500 text-black font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
            <Bell className="w-4 h-4" /> Activar Notificaciones
          </button>
        </>
      )}

      {status === "subscribed" && (
        <>
          <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Notificaciones activadas correctamente.</p>
          <button onClick={sendTest} className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs py-2 rounded-lg transition-colors">
            Enviar notificación de prueba
          </button>
        </>
      )}
    </div>
  );
};