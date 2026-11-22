import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const POLL_MS = 30000;

export const useInbox = () => {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => api.get("/notifications/inbox").then(({ data }) => {
    setItems(data.items);
    setUnread(data.no_leidas);
  }).catch(() => {}), []);

  useEffect(() => {
    load();
    const i = setInterval(load, POLL_MS);
    window.addEventListener("focus", load);
    return () => { clearInterval(i); window.removeEventListener("focus", load); };
  }, [load]);

  const markRead = async (id) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leida: true } : x)));
    setUnread((n) => Math.max(n - 1, 0));
    await api.post(`/notifications/inbox/${id}/read`).catch(() => {});
  };

  const markAll = async () => {
    setItems((xs) => xs.map((x) => ({ ...x, leida: true })));
    setUnread(0);
    await api.post("/notifications/inbox/read-all").catch(() => {});
  };

  return { items, unread, markRead, markAll, reload: load };
};
