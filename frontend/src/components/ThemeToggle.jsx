import { SunMedium, MoonStar } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export const ThemeToggle = () => {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button onClick={toggle} data-testid="theme-toggle" role="switch" aria-checked={dark}
      aria-label={dark ? "Cambiar a modo día" : "Cambiar a modo noche"} title={dark ? "Modo día" : "Modo noche"}
      className="relative flex items-center w-[84px] h-12 p-1 rounded-full border transition-colors duration-300 bg-amber-50/80 border-amber-900/10 shadow-inner dark:bg-white/5 dark:border-white/10">
      <span className={`absolute top-1 left-1 w-10 h-10 rounded-full shadow-md transition-transform duration-300 ease-out bg-gradient-to-br from-[#f0d391] to-[#b8893b] dark:from-zinc-700 dark:to-zinc-900 ${dark ? "translate-x-[34px]" : ""}`} />
      <span className="relative z-10 flex w-10 h-10 items-center justify-center">
        <SunMedium className={`w-5 h-5 transition-colors ${dark ? "text-zinc-500" : "text-[#3b2a0c]"}`} />
      </span>
      <span className="relative z-10 flex w-10 h-10 items-center justify-center -ml-1">
        <MoonStar className={`w-5 h-5 transition-colors ${dark ? "text-[#e3c993]" : "text-stone-500"}`} />
      </span>
    </button>
  );
};
