import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, GanttChartSquare, ListTodo, Users, LogOut, MessageSquareText, Factory, Hammer, Wallet, ShieldCheck, Smartphone, Boxes, Store } from "lucide-react";
import { ROLE_LABELS } from "@/lib/stages";
import { BottomNav } from "@/components/BottomNav";
import { FinishOrderProvider } from "@/components/FinishOrderDialog";
import { BrandMark } from "@/components/BrandMark";

const STAFF = ["admin", "ventas"];
export const NAV_ITEMS = [
  { to: "/", label: "Panel", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/jarvis", label: "Jarvis", icon: MessageSquareText, testid: "nav-jarvis" },
  { to: "/pedidos", label: "Pedidos", icon: GanttChartSquare, testid: "nav-orders" },
  { to: "/produccion", label: "Producción", icon: Factory, testid: "nav-production" },
  { to: "/mis-trabajos", label: "Mis trabajos", icon: Hammer, testid: "nav-my-work" },
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
  const items = NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex">
      {/* Menú Lateral (Solo para PC) */}
      <aside className="w-64 border-r border-white/5 bg-zinc-950/70 backdrop-blur-xl fixed left-0 top-0 h-screen hidden md:flex flex-col p-5 z-20 overflow-y-auto">
        <button onClick={() => nav("/")} className="mb-10 group" data-testid="brand-home">
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
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-amber-600/15 text-amber-400 border border-amber-500/20"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border border-transparent"
                }`
              }
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/5 pt-4 mt-4">
          <div className="text-sm text-zinc-200 mb-1 truncate" data-testid="current-user-name">{user?.name}</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-amber-500/30 text-amber-400 bg-amber-500/10" data-testid="current-user-role">{ROLE_LABELS[user?.role]}</span>
            {user?.departamento && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-white/10 text-zinc-400">{user.departamento}</span>}
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-red-400 transition-colors" data-testid="btn-logout">
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 min-w-0 md:ml-64 min-h-screen pb-24 md:pb-0">
        <FinishOrderProvider><Outlet /></FinishOrderProvider>
      </main>
      
      {/* Menú inferior (Solo celular) */}
      <BottomNav />
    </div>
  );
}