import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, PackagePlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useInbox } from "@/hooks/useInbox";

const timeAgo = (iso) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Ahora mismo";
  if (m < 60) return `Hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `Hace ${h} h`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
};

const InboxItem = ({ n, onOpen }) => (
  <button onClick={() => onOpen(n)} data-testid={`inbox-item-${n.id}`}
    className={`w-full text-left flex gap-3 p-4 rounded-xl min-h-[64px] transition-colors ${n.leida ? "hover:bg-white/5" : "bg-[#c5a572]/10 hover:bg-[#c5a572]/15"}`}>
    <span className="mt-0.5 shrink-0 w-10 h-10 rounded-full bg-[#c5a572]/15 border border-[#c5a572]/30 flex items-center justify-center text-[#c5a572]">
      <PackagePlus className="w-5 h-5" />
    </span>
    <span className="flex-1 min-w-0">
      <span className={`block text-sm leading-snug ${n.leida ? "text-zinc-300" : "text-white font-semibold"}`}>{n.titulo}</span>
      <span className="block text-sm text-zinc-400 mt-1 truncate">{n.mensaje}</span>
      <span className="block text-xs text-zinc-400 mt-1">{timeAgo(n.created_at)}</span>
    </span>
    {!n.leida && <span className="mt-2 w-2.5 h-2.5 rounded-full bg-[#c5a572] shrink-0" aria-label="Sin leer" />}
  </button>
);

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { items, unread, markRead, markAll } = useInbox();
  const nav = useNavigate();

  const openItem = (n) => {
    if (!n.leida) markRead(n.id);
    setOpen(false);
    nav(n.url);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button data-testid="notification-bell" aria-label={`Avisos${unread ? `, ${unread} sin leer` : ""}`}
          className="relative w-12 h-12 rounded-full flex items-center justify-center text-zinc-200 bg-white/5 border border-white/10 hover:border-[#c5a572]/50 hover:text-[#c5a572] transition-colors">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span data-testid="notification-badge" className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center ring-2 ring-[#09090b]">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[min(92vw,400px)] p-0 bg-zinc-950/95 backdrop-blur-xl border-white/10 rounded-2xl shadow-2xl" data-testid="notification-panel">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div>
            <div className="font-display text-lg text-white">Avisos</div>
            <div className="text-xs text-zinc-400">{unread ? `${unread} sin leer` : "Estás al día"}</div>
          </div>
          {unread > 0 && (
            <button onClick={markAll} data-testid="notification-read-all" className="min-h-[44px] px-3 rounded-xl text-sm text-[#c5a572] hover:bg-[#c5a572]/10 flex items-center gap-2">
              <CheckCheck className="w-4 h-4" /> Marcar todo leído
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-2">
          {items.length === 0 && (
            <div className="py-12 px-6 text-center text-zinc-400 text-sm" data-testid="notification-empty">
              <Bell className="w-8 h-8 mx-auto mb-3 text-zinc-600" /> No tienes avisos por ahora.
            </div>
          )}
          {items.map((n) => <InboxItem key={n.id} n={n} onOpen={openItem} />)}
        </div>
      </PopoverContent>
    </Popover>
  );
};
