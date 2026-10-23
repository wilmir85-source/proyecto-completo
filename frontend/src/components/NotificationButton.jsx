import { useState, useEffect } from "react";
import { Bell, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const NotificationButton = () => {
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");

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
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus("unsupported");
      setErrorMsg("Tu dispositivo no soporta notificaciones, o no has instalado la app en la pantalla de inicio.");
      return;
    }

    const timer = setTimeout(() => {
      setStatus((prev) => (prev === "loading" ? "ready" : prev));
    }, 3000);

    const checkSW = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) setStatus("subscribed");
        else setStatus("ready");
      } catch (err) {
        console.error("Error SW:", err);
        setStatus("ready");
      } finally {
        clearTimeout(timer);
      }
    };

    checkSW();
    return () => clearTimeout(timer);
  }, []);

  const subscribe = async () => {
    setStatus("loading");
    setErrorMsg("");
    
    if (!('Notification' in window)) {
      setStatus("unsupported");
      setErrorMsg("Debes instalar la app en tu pantalla de inicio para activar las notificaciones.");
      return;
    }

    // 🚨 FRENO DE EMERGENCIA: Si en 15 segundos no pasa nada, mostramos error
    const timeoutId = setTimeout(() => {
      setStatus("error");
      setErrorMsg("El servidor está tardando mucho en responder. Revisa tu conexión a internet o intenta de nuevo.");
    }, 15000);

    try {
      // 1. Pedir permiso (esto debe ser lo primero en iOS)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        clearTimeout(timeoutId);
        setStatus("error");
        setErrorMsg("Permiso denegado. Ve a Ajustes de tu iPhone > Notificaciones > Jarvis y actívalas.");
        return;
      }

      // 2. Registrar Service Worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      // 3. Suscribir al Push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // 4. Enviar a Render
      await api.post('/notifications/subscribe', subscription.toJSON());
      
      clearTimeout(timeoutId);
      setStatus("subscribed");
      toast.success("¡Notificaciones activadas!");
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(error);
      setStatus("error");
      // Si el error es por el Service Worker, mostramos el mensaje real
      setErrorMsg(`Error: ${error.name || 'Desconocido'} - ${error.message || 'Fallo al conectar'}`);
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
          <Loader2 className="w-4 h-4 animate-spin"/> Procesando...
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