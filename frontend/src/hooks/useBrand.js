import { useEffect, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
let cache = null;
const listeners = new Set();

export const refreshBrand = async () => {
  const { data } = await axios.get(`${API}/settings`);
  cache = { ...data, logoUrl: `${API}/public/logo?v=${data.logo_v}` };
  listeners.forEach((l) => l(cache));
  document.title = `${cache.nombre} · Jarvis`;
  return cache;
};

export const useBrand = () => {
  const [brand, setBrand] = useState(cache || { nombre: "Mundo de Joyas", logoUrl: `${API}/public/logo` });
  useEffect(() => {
    listeners.add(setBrand);
    if (!cache) refreshBrand().catch(() => {});
    return () => listeners.delete(setBrand);
  }, []);
  return brand;
};
