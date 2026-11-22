import { Link } from "react-router-dom";
import { PackagePlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BrandMark } from "@/components/BrandMark";
import { NotificationBell } from "@/components/NotificationBell";

export const AppHeader = () => {
  const { user } = useAuth();
  return (
    <header className="shrink-0 z-30 flex items-center justify-between gap-3 px-4 md:px-10 h-[72px] border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl" data-testid="app-header">
      <div className="md:hidden min-w-0"><BrandMark /></div>
      <div className="hidden md:block text-sm text-zinc-400">
        Hola, <span className="text-zinc-100 font-medium">{user?.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/requisiciones" data-testid="header-request-material"
          className="hidden sm:inline-flex items-center gap-2 min-h-[48px] px-5 rounded-full text-sm font-medium text-[#c5a572] border border-[#c5a572]/40 hover:bg-[#c5a572]/10 transition-colors">
          <PackagePlus className="w-5 h-5" /> Pedir material
        </Link>
        <NotificationBell />
      </div>
    </header>
  );
};
