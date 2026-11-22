import { Link, useLocation } from "react-router-dom";
import { Home, ClipboardList, Hammer, Menu, LogOut, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavItems } from "@/lib/nav";
import { ArcReactorIcon } from "@/components/ArcReactorIcon";

const TABS = [
  { name: "Inicio", path: "/", icon: Home },
  { name: "Pedidos", path: "/pedidos", icon: ClipboardList },
  { name: "Taller", path: "/produccion", icon: Hammer },
  { name: "Jarvis", path: "/jarvis", icon: ArcReactorIcon },
];
const TAB_PATHS = TABS.map((t) => t.path);

const vibrate = () => navigator.vibrate && navigator.vibrate(10);

const TabItem = ({ icon: Icon, label, active, ...props }) => (
  <Link {...props} className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[60px] transition-colors ${active ? "text-[#e3c993]" : "text-zinc-400"}`}>
    <span className={`flex items-center justify-center w-12 h-8 rounded-full transition-colors ${active ? "bg-[#c5a572]/15" : ""}`}>
      <Icon className="w-6 h-6" />
    </span>
    <span className={`text-xs ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
  </Link>
);

const MoreSheet = ({ items, onClose, logout }) => (
  <div className="md:hidden fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm" onClick={onClose} data-testid="more-sheet">
    <div className="absolute bottom-[76px] left-0 right-0 bg-zinc-950 border-t border-white/10 rounded-t-3xl p-5 pb-6 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <span className="font-display text-lg text-white">Más opciones</span>
        <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center text-zinc-300"><X className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <Link key={it.to} to={it.to} onClick={() => { vibrate(); onClose(); }} data-testid={`m-${it.testid}`}
            className="flex flex-col items-center justify-center gap-2 min-h-[96px] p-2 rounded-2xl bg-white/[0.04] border border-white/5 text-zinc-200 text-sm text-center leading-tight active:bg-white/10">
            <span className="w-11 h-11 rounded-full bg-[#c5a572]/10 border border-[#c5a572]/25 flex items-center justify-center text-[#e3c993]">
              <it.icon className="w-5 h-5" />
            </span>
            {it.short || it.label}
          </Link>
        ))}
        <button onClick={() => { vibrate(); onClose(); logout(); }} data-testid="m-btn-logout"
          className="flex flex-col items-center justify-center gap-2 min-h-[96px] p-2 rounded-2xl bg-red-950/30 border border-red-500/20 text-red-300 text-sm">
          <span className="w-11 h-11 rounded-full bg-red-500/10 flex items-center justify-center"><LogOut className="w-5 h-5" /></span>
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
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-[60] bg-[#09090b]/95 backdrop-blur-2xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]" data-testid="bottom-nav">
        <div className="flex items-stretch h-[76px] px-1 gap-1">
          {TABS.map((t) => (
            <TabItem key={t.path} to={t.path} icon={t.icon} label={t.name} active={isActive(t.path)}
              onClick={() => { vibrate(); setShowMore(false); }} data-testid={`tab-${t.name.toLowerCase()}`} />
          ))}
          <button onClick={() => { vibrate(); setShowMore(!showMore); }} data-testid="tab-more" aria-expanded={showMore}
            className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[60px] ${showMore ? "text-[#e3c993]" : "text-zinc-400"}`}>
            <span className={`flex items-center justify-center w-12 h-8 rounded-full ${showMore ? "bg-[#c5a572]/15" : ""}`}><Menu className="w-6 h-6" /></span>
            <span className="text-xs font-medium">Más</span>
          </button>
        </div>
      </nav>
      {showMore && <MoreSheet items={more} onClose={() => setShowMore(false)} logout={logout} />}
    </>
  );
};
