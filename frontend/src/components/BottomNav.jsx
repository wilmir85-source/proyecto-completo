import { Link, useLocation } from "react-router-dom";
import { House, ShoppingBag, Hammer, LayoutGrid, LogOut, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavItems } from "@/lib/nav";
import { ArcReactorIcon } from "@/components/ArcReactorIcon";

const TABS = [
  { name: "Inicio", path: "/", icon: House },
  { name: "Pedidos", path: "/pedidos", icon: ShoppingBag },
  { name: "Taller", path: "/produccion", icon: Hammer },
  { name: "Jarvis", path: "/jarvis", icon: ArcReactorIcon },
];
const TAB_PATHS = TABS.map((t) => t.path);
const vibrate = () => navigator.vibrate && navigator.vibrate(10);

const TabInner = ({ icon: Icon, label, active }) => (
  <>
    <span className={`flex items-center justify-center w-12 h-9 rounded-full transition-all duration-300 ${active ? "nav-active scale-105" : ""}`}>
      <Icon className="w-[22px] h-[22px]" strokeWidth={1.5} />
    </span>
    <span className={`text-xs leading-none ${active ? "font-bold text-[#7a5717] dark:text-[#e3c993]" : "font-medium"}`}>{label}</span>
  </>
);

const tabCls = "flex-1 flex flex-col items-center justify-center gap-1.5 min-h-[60px] rounded-full text-stone-600 dark:text-zinc-400 active:scale-95 transition-transform";

const MoreSheet = ({ items, onClose, logout }) => (
  <div className="md:hidden fixed inset-0 z-[55] bg-stone-900/30 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} data-testid="more-sheet">
    <div className="glass-panel absolute bottom-[104px] left-3 right-3 rounded-[28px] p-5 max-h-[68vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <span className="font-display text-2xl text-stone-900 dark:text-white">Más opciones</span>
        <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 rounded-full bg-amber-900/5 dark:bg-white/5 flex items-center justify-center text-stone-700 dark:text-zinc-300"><X className="w-5 h-5" strokeWidth={1.5} /></button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <Link key={it.to} to={it.to} onClick={() => { vibrate(); onClose(); }} data-testid={`m-${it.testid}`}
            className="flex flex-col items-center justify-center gap-2 min-h-[100px] p-2 rounded-2xl bg-white/60 border border-amber-900/10 text-stone-800 dark:bg-white/[0.04] dark:border-white/5 dark:text-zinc-200 text-sm text-center leading-tight active:scale-95 transition-transform">
            <span className="nav-icon w-12 h-12 rounded-2xl flex items-center justify-center">
              <it.icon className="w-6 h-6" strokeWidth={1.5} />
            </span>
            {it.short || it.label}
          </Link>
        ))}
        <button onClick={() => { vibrate(); onClose(); logout(); }} data-testid="m-btn-logout"
          className="flex flex-col items-center justify-center gap-2 min-h-[100px] p-2 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-700 dark:text-red-300 text-sm">
          <span className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center"><LogOut className="w-6 h-6" strokeWidth={1.5} /></span>
          Salir
        </button>
      </div>
    </div>
  </div>
);

export const BottomNav = () => {
  const { pathname } = useLocation();
  const [showMore, setShowMore] = useState(false);
  const { logout } = useAuth();
  const more = useNavItems().filter((i) => !TAB_PATHS.includes(i.to));
  const isActive = (p) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  return (
    <>
      <nav className="md:hidden fixed inset-x-3 z-[60] bottom-[calc(12px+env(safe-area-inset-bottom))]" data-testid="bottom-nav">
        <div className="glass-panel flex items-stretch h-[80px] px-2 py-2 gap-1 rounded-full">
          {TABS.map((t) => (
            <Link key={t.path} to={t.path} onClick={() => { vibrate(); setShowMore(false); }} data-testid={`tab-${t.name.toLowerCase()}`} className={tabCls} aria-current={isActive(t.path) ? "page" : undefined}>
              <TabInner icon={t.icon} label={t.name} active={isActive(t.path)} />
            </Link>
          ))}
          <button onClick={() => { vibrate(); setShowMore(!showMore); }} data-testid="tab-more" aria-expanded={showMore} className={tabCls}>
            <TabInner icon={LayoutGrid} label="Más" active={showMore} />
          </button>
        </div>
      </nav>
      {showMore && <MoreSheet items={more} onClose={() => setShowMore(false)} logout={logout} />}
    </>
  );
};
