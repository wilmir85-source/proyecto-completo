import { Link } from "react-router-dom";
import { PackagePlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BrandMark } from "@/components/BrandMark";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";

export const AppHeader = () => {
  const { user } = useAuth();
  return (
    <header className="shrink-0 z-30 px-3 pt-3 md:px-8 md:pt-4" data-testid="app-header">
      <div className="glass-panel flex items-center justify-between gap-3 h-[68px] px-3 md:px-5 rounded-2xl">
        <div className="lg:hidden min-w-0"><BrandMark /></div>
        <div className="hidden lg:block text-sm text-stone-600 dark:text-zinc-400">
          Hola, <span className="text-stone-900 dark:text-zinc-100 font-semibold">{user?.name}</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Link to="/requisiciones" data-testid="header-request-material"
            className="hidden lg:inline-flex items-center gap-2 min-h-[48px] px-5 rounded-xl text-sm font-semibold btn-soft">
            <PackagePlus className="w-5 h-5" /> Pedir material
          </Link>
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>
    </header>
  );
};
