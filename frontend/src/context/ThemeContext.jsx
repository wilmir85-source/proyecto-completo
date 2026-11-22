import { createContext, useContext, useEffect, useState } from "react";

const ThemeCtx = createContext(null);

// Función que decide si es de día o de noche
const getAutoTheme = () => {
  const hora = new Date().getHours();
  // De 7:00 AM a 6:59 PM = Modo Claro (light)
  // De 7:00 PM a 6:59 AM = Modo Oscuro (dark)
  return (hora >= 7 && hora < 19) ? "light" : "dark";
};

export const ThemeProvider = ({ children }) => {
  // Iniciamos el tema según la hora actual
  const [theme, setTheme] = useState(getAutoTheme);
  const [forceDark, setForceDark] = useState(false);
  
  // Si Jarvis está abierto, forzamos oscuro. Si no, usamos el tema automático
  const applied = forceDark ? "dark" : theme;

  // Revisar la hora cada minuto. Si cambia de las 7 PM, la pantalla cambiará sola.
  useEffect(() => {
    const interval = setInterval(() => {
      setTheme(getAutoTheme());
    }, 60000); // Revisa cada minuto (60,000 ms)
    return () => clearInterval(interval);
  }, []);

  // Aplicar los colores al HTML
  useEffect(() => {
    document.documentElement.classList.toggle("dark", applied === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", applied === "dark" ? "#08080a" : "#f6efe3");
  }, [applied]);

  // Dejamos la función toggle vacía por si algún archivo viejo la sigue llamando
  const toggle = () => {};

  return <ThemeCtx.Provider value={{ theme, applied, toggle, setForceDark }}>{children}</ThemeCtx.Provider>;
};

export const useTheme = () => useContext(ThemeCtx);