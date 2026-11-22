import { useAuth } from "@/context/AuthContext";

export const STAFF_ROLES = ["admin", "ventas"];
export const canSeeMoney = (user) => STAFF_ROLES.includes(user?.role);

export const MoneyGate = ({ children, fallback = null }) => {
  const { user } = useAuth();
  return canSeeMoney(user) ? children : fallback;
};
