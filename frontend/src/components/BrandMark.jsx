import { useBrand } from "@/hooks/useBrand";

export const BrandMark = ({ size = "md" }) => {
  const brand = useBrand();
  const big = size === "lg";
  return (
    <div className="flex items-center gap-3" data-testid="brand-mark">
      <img src={brand.logoUrl} alt={brand.nombre} className={`${big ? "w-12 h-12" : "w-10 h-10"} rounded-xl object-cover bg-zinc-900 border border-amber-500/30`} data-testid="brand-logo" />
      <div className="text-left min-w-0">
        <div className={`font-display ${big ? "text-2xl" : "text-base"} font-semibold leading-tight truncate`} data-testid="brand-name">{brand.nombre}</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-400/80 mt-0.5">Jarvis · IA 24/7</div>
      </div>
    </div>
  );
};
