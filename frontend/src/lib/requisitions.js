import { Gem, Coins, CircleDot, Wrench, Package, MoreHorizontal } from "lucide-react";

export const CATEGORIAS = [
  { value: "Piedras", icon: Gem },
  { value: "Oro", icon: Coins },
  { value: "Plata", icon: CircleDot },
  { value: "Herramientas", icon: Wrench },
  { value: "Insumos de taller", icon: Package },
  { value: "Otro", icon: MoreHorizontal },
];
export const CAT_ICON = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.icon]));

export const UNIDADES = [
  { value: "pz", label: "piezas" },
  { value: "g", label: "gramos" },
  { value: "kg", label: "kilos" },
  { value: "ct", label: "quilates" },
  { value: "m", label: "metros" },
  { value: "caja", label: "cajas" },
];
export const UNIT_LABEL = Object.fromEntries(UNIDADES.map((u) => [u.value, u.label]));

export const ESTADOS = {
  pendiente: { label: "Esperando respuesta", chip: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  aprobada: { label: "Aprobado", chip: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  comprada: { label: "Ya se compró", chip: "bg-violet-500/15 text-violet-300 border-violet-500/40" },
  entregada: { label: "Entregado", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  rechazada: { label: "No aprobado", chip: "bg-red-500/15 text-red-300 border-red-500/40" },
};

export const ACTIONS = [
  { estado: "aprobada", label: "Aprobar" },
  { estado: "comprada", label: "Ya se compró" },
  { estado: "entregada", label: "Ya se entregó" },
  { estado: "rechazada", label: "No aprobar" },
];
