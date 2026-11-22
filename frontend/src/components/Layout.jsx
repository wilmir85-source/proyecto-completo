import { useEffect } from "react";
import { Outlet, useNavigate, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
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
  `group flex items-center gap-3 px-3 min-h-[50px] rounded-2xl text-sm transition-all duration-200 ${
    isActive
      ? "nav-active font-semibold"
      : "text-stone-700 hover:text-stone-950 hover:bg-amber-900/5 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/5"
  }`;

const NavIcon = ({ icon: Icon }) => (
  <span className="nav-icon w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors">
    <Icon className="w-[20px] h-[20px]" strokeWidth={1.5} />
  </span>
);

const UserBox = ({ user, logout }) => (
  <div className="border-t border-amber-900/10 dark:border-white/10 pt-5 mt-5">
    <div className="text-sm text-stone-900 dark:text-zinc-100 font-semibold mb-2 truncate">{user?.name}</div>
    <div className="flex flex-wrap gap-2 mb-4">
      <span className="text-xs px-2.5 py-1 rounded-full border border-[#b8893b]/40 text-[#7a5717] bg-[#c5a572]/10 dark:text-[#e3c993]">
        {ROLE_LABELS[user?.role] || user?.role}
      </span>
    </div>
    <button onClick={logout} data-testid="btn-logout" className="w-full flex items-center gap-3 min-h-[48px] px-4 rounded-2xl text-sm text-stone-700 hover:text-red-700 hover:bg-red-500/10 dark:text-zinc-300 dark:hover:text-red-300 transition-colors">
      <LogOut className="w-5 h-5" strokeWidth={1.5} /> Cerrar sesión
    </button>
  </div>
);

export default function Layout() {
  const { user, logout } = useAuth();
  const { setForceDark } = useTheme();
  const nav = useNavigate();
  const location = useLocation();
  const items = useNavItems();
  const isJarvisPage = location.pathname === "/jarvis";

  useEffect(() => { setForceDark(isJarvisPage); return () => setForceDark(false); }, [isJarvisPage, setForceDark]);

  return (
    <div className="app-shell h-[100dvh] flex overflow-hidden">
      <aside className="glass-panel hidden md:flex flex-col fixed left-4 top-4 bottom-4 w-[17rem] rounded-[28px] p-5 z-20 overflow-y-auto scrollbar-thin" data-testid="sidebar">
        <button onClick={() => nav("/")} className="mb-8 text-left px-1" data-testid="brand-home">
          <BrandMark />
        </button>
        <nav className="flex flex-col gap-1.5 flex-1">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} data-testid={it.testid} className={navCls}>
              <NavIcon icon={it.icon} />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <UserBox user={user} logout={logout} />
      </aside>

      <main className="flex-1 min-w-0 md:ml-[18.5rem] h-full flex flex-col pt-[env(safe-area-inset-top)] md:pt-0 overflow-hidden">
        {!isJarvisPage && <AppHeader />}
        <div className="flex-1 min-h-0 overflow-y-auto w-full scrollbar-thin pb-28 md:pb-0">
          <FinishOrderProvider><Outlet /></FinishOrderProvider>
        </div>
      </main>

      <BottomNav />
      {!isJarvisPage && ["admin", "ventas"].includes(user?.role) && <FloatingActionButton />}
    </div>
  );
}
