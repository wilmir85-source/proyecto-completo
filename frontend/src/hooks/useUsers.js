import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const reload = () => api.get("/users").then((r) => setUsers(r.data)).catch(() => {});
  useEffect(() => { reload(); }, []);
  return { users, reload };
};
