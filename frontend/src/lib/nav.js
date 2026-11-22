import { House, ShoppingBag, ListChecks, UsersRound, Hammer, BriefcaseBusiness, WalletCards, UserCog, Smartphone, Package, Store, Gem, PackagePlus, PackageCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ArcReactorIcon } from "@/components/ArcReactorIcon";

const STAFF = ["admin", "ventas"];

export const NAV_ITEMS = [
  { to: "/", label: "Inicio", icon: House, end: true, testid: "nav-dashboard" },
  { to: "/jarvis", label: "Asistente Jarvis", short: "Jarvis", icon: ArcReactorIcon, testid: "nav-jarvis" },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingBag, testid: "nav-orders" },
  { to: "/produccion", label: "Taller", icon: Hammer, testid: "nav-production" },
  { to: "/mis-trabajos", label: "Mis trabajos", icon: BriefcaseBusiness, testid: "nav-my-work" },
  { to: "/requisiciones", label: "Pedir material", icon: PackagePlus, testid: "nav-requisitions" },
  { to: "/moldes", label: "Moldes", icon: Gem, testid: "nav-molds", molds: true },
  { to: "/ventas", label: "Cobros y pagos", icon: WalletCards, testid: "nav-sales", roles: STAFF },
  { to: "/inventario", label: "Inventario", icon: Package, testid: "nav-inventory" },
  { to: "/tareas", label: "Tareas", icon: ListChecks, testid: "nav-tasks" },
  { to: "/clientes", label: "Clientes", icon: UsersRound, testid: "nav-clients", roles: STAFF },
  { to: "/historial", label: "Pedidos entregados", short: "Entregados", icon: PackageCheck, testid: "nav-history", roles: STAFF },
  { to: "/equipo", label: "Mi equipo", icon: UserCog, testid: "nav-team", roles: ["admin"] },
  { to: "/mi-joyeria", label: "Mi negocio", icon: Store, testid: "nav-business", roles: ["admin"] },
  { to: "/iphone", label: "Usar en el celular", short: "Celular", icon: Smartphone, testid: "nav-iphone" },
];

const hasDepto = (user, terms) => {
  const d = user?.departamento;
  if (!d) return false;
  const s = (Array.isArray(d) ? d.join(" ") : String(d)).toLowerCase();
  return terms.some((t) => s.includes(t));
};

export const canSeeMolds = (user) => STAFF.includes(user?.role) || hasDepto(user, ["cera", "inyec"]);

export const useNavItems = () => {
  const { user } = useAuth();
  return NAV_ITEMS.filter((i) => (!i.roles || i.roles.includes(user?.role)) && (!i.molds || canSeeMolds(user)));
};
