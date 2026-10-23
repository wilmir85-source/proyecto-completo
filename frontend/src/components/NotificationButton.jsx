import { useState, useEffect } from "react";
import { Bell, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const NotificationButton = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reg, setReg] = useState(null);

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

  // 1. Registrar el Service Worker AL CARGAR (sin gesto, no pasa nada)
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        setReg(registration);
        return registration.pushManager.getSubscription();
      }).then((subscription) => {
        setIsSubscribed(!!subscription);
      }).catch((err) => {
        console.error("Error SW:", err);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // 2. Suscribir EN EL CLIC, sin await intermedios
  const subscribe = async () => {
    if (!reg) {
      toast.error("El servicio de notificaciones aún no está listo. Espera un momento.");
      return;
    }

    setLoading(true);
    try {
      // Pedir permiso (primer await, pero es el paso 1 del gesto)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error("Permiso denegado. Ve a Ajustes > Safari > Notificaciones y actívalo.");
        setLoading(false);
        return;
      }

      // Suscribir INMEDIATAMENTE (segundo paso, mismo gesto)
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      await api.post('/notifications/subscribe', subscription.toJSON());
      
      setIsSubscribed(true);
      toast.success("¡Notificaciones activadas! Jarvis ya puede llamarte.");
    } catch (error) {
      console.error("Error suscripción:", error);
      toast.error(`Error al activar: ${error.name}. ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendTest = async () => {
    setLoading(true);
    try {
      await api.post('/notifications/test');
      toast.success("Notificación enviada.");
    } catch (error) {
      toast.error("Error enviando la prueba.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !isSubscribed) return <div className="text-zinc-500 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Preparando...</div>;

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      <h3 className="font-medium text-white">Notificaciones Push</h3>
      <p className="text-xs text-zinc-400">
        {isSubscribed 
          ? "Jarvis puede enviarte alertas a este dispositivo." 
          : "Activa las notificaciones para que Jarvis te recuerde los pedidos."}
      </p>
      
      {!isSubscribed ? (
        <button onClick={subscribe} disabled={loading} className="bg-amber-600 hover:bg-amber-500 text-black font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />} 
          {loading ? "Activando..." : "Activar Notificaciones"}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium justify-center">
            <Bell className="w-4 h-4" /> Activadas
          </div>
          <button onClick={sendTest} disabled={loading} className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs py-2 rounded-lg transition-colors disabled:opacity-50">
            Enviar notificación de prueba
          </button>
        </div>
      )}
    </div>
  );
};