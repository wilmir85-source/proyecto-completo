import { Outlet, useNavigate, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogOut } from "lucide-react";
import { ROLE_LABELS } from "@/lib/stages";
import { useNavItems } from "@/lib/nav";
import { BottomNav } from "@/components/BottomNav";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { FinishOrderProvider } from "@/components/FinishOrderDialog";
import { BrandMark } from "@/components/BrandMark";
import { AppHeader } from "@/components/AppHeader";

export { NAV_ITEMS } from "@/lib/nav";

const navCls = ({ isActive }) =>
  `flex items-center gap-3 px-4 min-h-[48px] rounded-xl text-sm transition-colors duration-200 ${
    isActive
      ? "bg-[#c5a572]/15 text-[#e3c993] border border-[#c5a572]/40 font-medium"
      : "text-zinc-300 hover:text-[#e3c993] hover:bg-white/5 border border-transparent"
  }`;

const UserBox = ({ user, logout }) => (
  <div className="border-t border-white/10 pt-5 mt-5">
    <div className="text-sm text-zinc-100 font-medium mb-2 truncate">{user?.name}</div>
    <div className="flex flex-wrap gap-2 mb-4">
      <span className="text-xs px-2.5 py-1 rounded-full border border-[#c5a572]/50 text-[#e3c993] bg-[#c5a572]/10">
        {ROLE_LABELS[user?.role] || user?.role}
      </span>
      {user?.departamento && (
        <span className="text-xs px-2.5 py-1 rounded-full border border-white/10 text-zinc-300 bg-white/5">
          {Array.isArray(user.departamento) ? user.departamento.join(", ") : user.departamento}
        </span>
      )}
    </div>
    <button onClick={logout} data-testid="btn-logout" className="w-full flex items-center gap-3 min-h-[48px] px-4 rounded-xl text-sm text-zinc-300 hover:text-red-300 hover:bg-red-500/10 transition-colors">
      <LogOut className="w-5 h-5" /> Cerrar sesión
    </button>
  </div>
);

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const items = useNavItems();
  const isJarvisPage = location.pathname === "/jarvis";

  return (
    <div className="h-[100dvh] flex overflow-hidden bg-[#09090b]">
      <aside className="w-72 border-r border-white/5 bg-black/40 backdrop-blur-2xl fixed left-0 top-0 h-screen hidden md:flex flex-col p-6 z-20 overflow-y-auto scrollbar-thin">
        <button onClick={() => nav("/")} className="mb-10 text-left" data-testid="brand-home">
          <BrandMark />
        </button>
        <nav className="flex flex-col gap-2 flex-1">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} data-testid={it.testid} className={navCls}>
              <it.icon className="w-5 h-5 shrink-0" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <UserBox user={user} logout={logout} />
      </aside>

      <main className="flex-1 min-w-0 md:ml-72 h-full flex flex-col pt-[env(safe-area-inset-top)] md:pt-0 overflow-hidden pb-[76px] md:pb-0">
        {!isJarvisPage && <AppHeader />}
        <div className="flex-1 min-h-0 overflow-y-auto w-full scrollbar-thin">
          <FinishOrderProvider><Outlet /></FinishOrderProvider>
        </div>
      </main>

      <BottomNav />
      {!isJarvisPage && ["admin", "ventas"].includes(user?.role) && <FloatingActionButton />}
    </div>
  );
}
