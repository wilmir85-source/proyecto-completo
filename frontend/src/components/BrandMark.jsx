import { useBrand } from "@/hooks/useBrand";

export const BrandMark = ({ size = "md" }) => {
  const brand = useBrand();
  const big = size === "lg";
  return (
    <div className="flex items-center gap-3" data-testid="brand-mark">
      <img src={brand.logoUrl} alt={brand.nombre} className={`${big ? "w-12 h-12" : "w-10 h-10"} rounded-2xl object-cover bg-white dark:bg-zinc-900 border border-[#c5a572]/40 shadow-sm`} data-testid="brand-logo" />
      <div className="text-left min-w-0">
        <div className={`font-display ${big ? "text-2xl" : "text-base"} font-semibold leading-tight truncate text-stone-900 dark:text-white`} data-testid="brand-name">{brand.nombre}</div>
        <div className="text-xs uppercase tracking-[0.18em] whitespace-nowrap text-[#7a5717] dark:text-cyan-400/80 mt-0.5">Jarvis · IA 24/7</div>
      </div>
    </div>
  );
};
