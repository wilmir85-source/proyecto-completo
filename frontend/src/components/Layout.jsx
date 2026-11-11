import { useEffect, useState } from "react";
import { Outlet, useNavigate, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, GanttChartSquare, ListTodo, Users, LogOut, MessageSquareText, Factory, Hammer, Wallet, ShieldCheck, Smartphone, Boxes, Store, Gem, Bell } from "lucide-react";
import { ROLE_LABELS } from "@/lib/stages";
import { BottomNav } from "@/components/BottomNav";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { FinishOrderProvider } from "@/components/FinishOrderDialog";
import { BrandMark } from "@/components/BrandMark";
import { api } from "@/lib/api";
import { toast } from "sonner"; // Para avisarle al usuario

const STAFF = ["admin", "ventas"];

export const NAV_ITEMS = [
  { to: "/", label: "Panel", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/jarvis", label: "Jarvis", icon: MessageSquareText, testid: "nav-jarvis" },
  { to: "/pedidos", label: "Pedidos", icon: GanttChartSquare, testid: "nav-orders" },
  { to: "/produccion", label: "Producción", icon: Factory, testid: "nav-production" },
  { to: "/mis-trabajos", label: "Mis trabajos", icon: Hammer, testid: "nav-my-work" },
  { to: "/moldes", label: "Moldes", icon: Gem, testid: "nav-molds" },
  { to: "/ventas", label: "Ventas y abonos", icon: Wallet, testid: "nav-sales", roles: STAFF },
  { to: "/inventario", label: "Inventario", icon: Boxes, testid: "nav-inventory" },
  { to: "/tareas", label: "Tareas", icon: ListTodo, testid: "nav-tasks" },
  { to: "/clientes", label: "Clientes", icon: Users, testid: "nav-clients", roles: STAFF },
  { to: "/equipo", label: "Equipo", icon: ShieldCheck, testid: "nav-team", roles: ["admin"] },
  { to: "/mi-joyeria", label: "Mi joyería", icon: Store, testid: "nav-business", roles: ["admin"] },
  { to: "/iphone", label: "Siri y app", icon: Smartphone, testid: "nav-iphone" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [notifActive, setNotifActive] = useState(false);
  
  const isJarvisPage = location.pathname === "/jarvis";

  // Revisar si ya están activas al cargar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotifActive(true);
    }
  }, []);

  // --- FUNCIÓN PARA ACTIVAR NOTIFICACIONES MANUALMENTE ---
  const activarNotificaciones = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error("Tu navegador no soporta notificaciones");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error("Permiso denegado. Ve a ajustes de tu celular para permitirlas.");
        return;
      }

      const register = await navigator.serviceWorker.register('/service-worker.js');
      const subscription = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
      });

      await api.post('/notifications/subscribe', subscription);
      setNotifActive(true);
      toast.success("¡Notificaciones activadas con éxito!");
      
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al activar notificaciones. Revisa la consola.");
    }
  };

  const items = NAV_ITEMS.filter((i) => {
    if (i.roles && !i.roles.includes(user?.role)) return false;
    if (i.to === "/moldes") {
      const canSeeMolds = ["admin", "ventas"].includes(user?.role) || user?.departamento === "Ceras" || user?.departamento === "Inyección";
      if (!canSeeMolds) return false;
    }
    return true;
  });

  return (
    <div className="h-[100dvh] flex overflow-hidden bg-[#09090b]">
      <aside className="w-64 border-r border-[#c5a572]/20 bg-black/40 backdrop-blur-2xl fixed left-0 top-0 h-screen hidden md:flex flex-col p-5 z-20 overflow-y-auto shadow-[4px_0_24px_rgba(0,0,0,0.6)]">
        <button onClick={() => nav("/")} className="mb-10 group transition-transform hover:scale-105" data-testid="brand-home">
          <BrandMark />
        </button>

        <nav className="flex flex-col gap-1 flex-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              data-testid={it.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-300 ${
                  isActive
                    ? "bg-[#c5a572]/15 text-[#c5a572] border border-[#c5a572]/40 shadow-[0_0_15px_rgba(197,165,114,0.15)] font-medium"
                    : "text-zinc-400 hover:text-[#c5a572] hover:bg-[#c5a572]/5 border border-transparent"
                }`
              }
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[#c5a572]/20 pt-4 mt-4">
          <div className="text-sm text-zinc-100 font-medium mb-1 truncate" data-testid="current-user-name">{user?.name}</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-[#c5a572]/50 text-[#c5a572] bg-[#c5a572]/10 shadow-sm" data-testid="current-user-role">
              {ROLE_LABELS[user?.role]}
            </span>
            {user?.departamento && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-white/10 text-zinc-400 bg-white/5">{user.departamento}</span>}
          </div>
          
          {/* BOTÓN DE NOTIFICACIONES EN PC */}
          {!notifActive && (
             <button onClick={activarNotificaciones} className="w-full mb-3 flex items-center justify-center gap-2 bg-amber-600/20 text-amber-500 border border-amber-600/50 hover:bg-amber-600/30 px-3 py-2 rounded-lg text-xs font-bold transition-all">
               <Bell className="w-4 h-4 animate-bounce" /> Activar Notificaciones
             </button>
          )}

          <button onClick={logout} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-red-400 transition-colors" data-testid="btn-logout">
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className={`flex-1 min-w-0 md:ml-64 h-full flex flex-col pt-[env(safe-area-inset-top)] md:pt-0 overflow-hidden pb-16 md:pb-0`}>
        {/* BOTÓN DE NOTIFICACIONES EN CELULAR (Flotando arriba) */}
        {!notifActive && (
          <div className="md:hidden p-2 bg-zinc-900 border-b border-white/5 flex justify-center">
            <button onClick={activarNotificaciones} className="flex items-center gap-2 bg-amber-600 text-black px-4 py-1.5 rounded-full text-xs font-bold animate-pulse shadow-lg shadow-amber-900/50">
               <Bell className="w-4 h-4" /> Toca aquí para activar notificaciones
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto md:overflow-visible">
          <FinishOrderProvider><Outlet /></FinishOrderProvider>
        </div>
      </main>
      
      <BottomNav />
      {!isJarvisPage && ["admin", "ventas"].includes(user?.role) && <FloatingActionButton />}
    </div>
  );
}