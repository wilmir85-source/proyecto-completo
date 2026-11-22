import { createContext, useContext, useEffect, useState } from "react";

const KEY = "jarvis_theme";
const ThemeCtx = createContext(null);
const systemTheme = () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export const ThemeProvider = ({ children }) => {
  const [pref, setPref] = useState(() => localStorage.getItem(KEY));
  const [sys, setSys] = useState(systemTheme);
  const [forceDark, setForceDark] = useState(false);
  const theme = pref || sys;
  const applied = forceDark ? "dark" : theme;

  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const h = (e) => setSys(e.matches ? "dark" : "light");
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", applied === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", applied === "dark" ? "#08080a" : "#f6efe3");
  }, [applied]);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    setPref(next);
  };

  return <ThemeCtx.Provider value={{ theme, applied, toggle, setForceDark }}>{children}</ThemeCtx.Provider>;
};

export const useTheme = () => useContext(ThemeCtx);
