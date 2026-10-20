export const STAGES = [
  "Ventas", "Diseño 3D", "Ceras", "Inyección", "Vulcanizado",
  "Casting", "Fabricación", "Grabado Láser", "Reparaciones", "Importación de máquinas", "Terminado",
];
export const ORDER_TYPES = ["Diseño", "Fabricación", "Reparación", "Grabado", "Importación de máquinas", "Otro"];
export const DEPARTMENTS = STAGES.filter((s) => s !== "Terminado");

export const STAGE_HEX = {
  "Ventas": "#0ea5e9", "Diseño 3D": "#3b82f6", "Ceras": "#eab308", "Inyección": "#14b8a6", "Vulcanizado": "#8b5cf6",
  "Casting": "#f97316", "Fabricación": "#f59e0b", "Grabado Láser": "#ec4899", "Reparaciones": "#f43f5e", "Importación de máquinas": "#84cc16", "Terminado": "#10b981",
};

export const STAGE_STYLES = {
  "Ventas": { bar: "bg-sky-500", text: "text-sky-400", border: "border-sky-500/30", chip: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  "Diseño 3D": { bar: "bg-blue-500", text: "text-blue-400", border: "border-blue-500/30", chip: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  "Ceras": { bar: "bg-yellow-500", text: "text-yellow-400", border: "border-yellow-500/30", chip: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  "Inyección": { bar: "bg-teal-500", text: "text-teal-400", border: "border-teal-500/30", chip: "bg-teal-500/15 text-teal-400 border-teal-500/30" },
  "Vulcanizado": { bar: "bg-violet-500", text: "text-violet-400", border: "border-violet-500/30", chip: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  "Casting": { bar: "bg-orange-500", text: "text-orange-400", border: "border-orange-500/30", chip: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  "Fabricación": { bar: "bg-amber-500", text: "text-amber-400", border: "border-amber-500/30", chip: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  "Grabado Láser": { bar: "bg-pink-500", text: "text-pink-400", border: "border-pink-500/30", chip: "bg-pink-500/15 text-pink-400 border-pink-500/30" },
  "Reparaciones": { bar: "bg-rose-500", text: "text-rose-400", border: "border-rose-500/30", chip: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  "Importación de máquinas": { bar: "bg-lime-500", text: "text-lime-400", border: "border-lime-500/30", chip: "bg-lime-500/15 text-lime-400 border-lime-500/30" },
  "Terminado": { bar: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500/30", chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

export const DUE_STYLES = {
  atrasado: { label: "Atrasado", card: "border-red-500/60 bg-red-950/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]", chip: "bg-red-500/15 text-red-400 border-red-500/40", dot: "bg-red-500" },
  por_vencer: { label: "Por vencer", card: "border-yellow-500/50 bg-yellow-950/20", chip: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40", dot: "bg-yellow-400" },
  a_tiempo: { label: "A tiempo", card: "border-white/5", chip: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
  sin_fecha: { label: "Sin fecha", card: "border-white/5", chip: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30", dot: "bg-zinc-500" },
  terminado: { label: "Terminado", card: "border-emerald-500/20", chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
};

export const PAY_STYLES = {
  pagado: { label: "Pagado", chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  debe: { label: "Debe", chip: "bg-red-500/15 text-red-400 border-red-500/40" },
  sin_precio: { label: "Sin precio", chip: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
};

export const ROLE_LABELS = { admin: "Admin", ventas: "Ventas", trabajador: "Trabajador" };

export const money = (n) => `$${Number(n || 0).toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const toISO = (local) => (local ? new Date(local).toISOString() : null);
export const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export const fmtDate = (iso, opts = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) =>
  iso ? new Date(iso).toLocaleString("es", opts) : "—";

export const waPhone = (phone, cc = "") => {
  const d = (phone || "").replace(/\D/g, "");
  const c = (cc || "").replace(/\D/g, "");
  return c && d.length <= 10 && !d.startsWith(c) ? `${c}${d}` : d;
};

export const fileUrl = (path) =>
  `${process.env.REACT_APP_BACKEND_URL}/api/files/${path}?auth=${localStorage.getItem("jarvis_token")}`;

export const apiError = (e, fallback = "Ocurrió un error") => {
  const d = e?.response?.data?.detail;
  if (!d) return fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return String(d);
};
