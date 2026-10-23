import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const NotificationButton = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Función para convertir la llave pública de VAPID a un formato que entienda el navegador
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const VAPID_PUBLIC_KEY = "3mjEFGmUlG-aDoQRi0Uqh4Xn73nJ60cPF7eE84deKcY"; // Tu llave pública

  useEffect(() => {
    // Verificamos si ya está suscrito
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(!!subscription);
          setLoading(false);
        });
      });
    } else {
      setLoading(false);
    }
  }, []);

  const subscribe = async () => {
    setLoading(true);
    try {
      // 1. Pedir permiso
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error("Permiso de notificaciones denegado. Ve a ajustes de tu iPhone y actívalas.");
        setLoading(false);
        return;
      }

      // 2. Registrar el Service Worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      // 3. Suscribirse
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // 4. Enviar al backend
      await api.post('/notifications/subscribe', subscription.toJSON());
      
      setIsSubscribed(true);
      toast.success("¡Notificaciones activadas! Jarvis ya puede llamarte.");
    } catch (error) {
      console.error(error);
      toast.error("Error al activar notificaciones. Asegúrate de estar en HTTPS y usar Safari.");
    } finally {
      setLoading(false);
    }
  };

  const sendTest = async () => {
    setLoading(true);
    try {
      await api.post('/notifications/test');
      toast.success("Notificación enviada. Revisa tu pantalla.");
    } catch (error) {
      toast.error("Error enviando la prueba.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-zinc-500 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Cargando...</div>;

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      <h3 className="font-medium text-white">Notificaciones Push</h3>
      <p className="text-xs text-zinc-400">
        {isSubscribed 
          ? "Jarvis puede enviarte alertas a este dispositivo." 
          : "Activa las notificaciones para que Jarvis te recuerde los pedidos."}
      </p>
      
      {!isSubscribed ? (
        <button onClick={subscribe} className="bg-amber-600 hover:bg-amber-500 text-black font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
          <Bell className="w-4 h-4" /> Activar Notificaciones
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium justify-center">
            <Bell className="w-4 h-4" /> Activadas
          </div>
          <button onClick={sendTest} className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs py-2 rounded-lg transition-colors">
            Enviar notificación de prueba
          </button>
        </div>
      )}
    </div>
  );
};