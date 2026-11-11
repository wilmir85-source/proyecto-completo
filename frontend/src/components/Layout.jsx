import { Outlet, useNavigate, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, GanttChartSquare, ListTodo, Users, LogOut, MessageSquareText, Factory, Hammer, Wallet, ShieldCheck, Smartphone, Boxes, Store, Gem } from "lucide-react";
import { ROLE_LABELS } from "@/lib/stages";
import { BottomNav } from "@/components/BottomNav";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { FinishOrderProvider } from "@/components/FinishOrderDialog";
import { BrandMark } from "@/components/BrandMark";

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
  
  const isJarvisPage = location.pathname === "/jarvis";
  
  // FUNCIÓN A PRUEBA DE FALLOS (Acepta listas y textos)
  const userHasDepto = (searchTerms) => {
    const d = user?.departamento;
    if (!d) return false;
    const dStr = Array.isArray(d) ? d.join(" ") : String(d);
    return searchTerms.some(term => dStr.toLowerCase().includes(term));
  };

  const items = NAV_ITEMS.filter((i) => {
    if (i.roles && !i.roles.includes(user?.role)) return false;
    
    if (i.to === "/moldes") {
      const canSeeMolds = ["admin", "ventas"].includes(user?.role) || 
                          userHasDepto(["cera", "inyec"]);
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
          <div className="text-sm text-zinc-100 font-medium mb-1 truncate">{user?.name}</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-[#c5a572]/50 text-[#c5a572] bg-[#c5a572]/10 shadow-sm">
              {ROLE_LABELS[user?.role] || user?.role}
            </span>
            {user?.departamento && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-white/10 text-zinc-400 bg-white/5">
                {Array.isArray(user.departamento) ? user.departamento.join(", ") : user.departamento}
              </span>
            )}
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className={`flex-1 min-w-0 md:ml-64 h-full flex flex-col pt-[env(safe-area-inset-top)] md:pt-0 overflow-hidden pb-16 md:pb-0`}>
        <div className="flex-1 overflow-y-auto md:overflow-visible">
          <FinishOrderProvider><Outlet /></FinishOrderProvider>
        </div>
      </main>
      
      <BottomNav />
      {!isJarvisPage && ["admin", "ventas"].includes(user?.role) && <FloatingActionButton />}
    </div>
  );
}