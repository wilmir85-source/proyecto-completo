import { DUE_STYLES, PAY_STYLES, STAGE_STYLES } from "@/lib/stages";
import { AlertTriangle, Clock } from "lucide-react";

const base = "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border whitespace-nowrap";

export const DueBadge = ({ status, testid }) => {
  const s = DUE_STYLES[status] || DUE_STYLES.sin_fecha;
  const Icon = status === "atrasado" ? AlertTriangle : Clock;
  return <span className={`${base} ${s.chip}`} data-testid={testid}><Icon className="w-3 h-3" />{s.label}</span>;
};

export const PayBadge = ({ status, testid }) => {
  const s = PAY_STYLES[status] || PAY_STYLES.sin_precio;
  return <span className={`${base} ${s.chip}`} data-testid={testid}>{s.label}</span>;
};

export const StageBadge = ({ stage }) => (
  <span className={`${base} ${STAGE_STYLES[stage]?.chip}`}>{stage}</span>
);

export const Avatar = ({ name, className = "" }) => (
  <span title={name} className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold ${className}`}>
    {(name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
  </span>
);

export const ProgressBar = ({ value = 0 }) => (
  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
    <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-[width] duration-500" style={{ width: `${value}%` }} />
  </div>
);
