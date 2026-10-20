import { useState } from "react";
import { NavLink } from "react-router-dom";
import { MoreHorizontal, LogOut } from "lucide-react";

const PRIMARY = ["/", "/jarvis", "/pedidos", "/mis-trabajos"];

export const MobileNav = ({ items, onLogout }) => {
  const [open, setOpen] = useState(false);
  const primary = items.filter((i) => PRIMARY.includes(i.to));
  const rest = items.filter((i) => !PRIMARY.includes(i.to));
  const cls = ({ isActive }) =>
    `flex flex-col items-center gap-1 text-[10px] py-2 flex-1 transition-colors ${isActive ? "text-amber-400" : "text-zinc-500"}`;

  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/70" onClick={() => setOpen(false)}>
          <div className="absolute bottom-20 left-3 right-3 card-glass rounded-2xl p-3 grid grid-cols-3 gap-2" onClick={(e) => e.stopPropagation()}>
            {rest.map((it) => (
              <NavLink key={it.to} to={it.to} onClick={() => setOpen(false)} className={cls} data-testid={`m-${it.testid}`}>
                <it.icon className="w-5 h-5" />{it.label}
              </NavLink>
            ))}
            <button onClick={onLogout} className="flex flex-col items-center gap-1 text-[10px] py-2 text-red-400" data-testid="m-btn-logout">
              <LogOut className="w-5 h-5" />Salir
            </button>
          </div>
        </div>
      )}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-t border-white/10 flex pb-[env(safe-area-inset-bottom)]" data-testid="mobile-nav">
        {primary.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={cls} data-testid={`m-${it.testid}`}>
            <it.icon className="w-5 h-5" />{it.label}
          </NavLink>
        ))}
        <button onClick={() => setOpen(!open)} className="flex flex-col items-center gap-1 text-[10px] py-2 flex-1 text-zinc-500" data-testid="m-more">
          <MoreHorizontal className="w-5 h-5" />Más
        </button>
      </nav>
    </>
  );
};
