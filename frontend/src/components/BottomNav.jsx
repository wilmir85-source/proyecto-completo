import { Link, useLocation } from "react-router-dom";
import { Home, ClipboardList, Hammer, Bot, Menu, Smartphone, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export const BottomNav = () => {
  const location = useLocation();
  const path = location.pathname;
  const [showMore, setShowMore] = useState(false);
  const { logout } = useAuth();

  const handleTabClick = () => {
    if (navigator.vibrate) navigator.vibrate(10);
    setShowMore(false);
  };

  const tabs = [
    { name: "Panel", path: "/", icon: Home },
    { name: "Pedidos", path: "/pedidos", icon: ClipboardList },
    { name: "Taller", path: "/produccion", icon: Hammer },
    { name: "Jarvis", path: "/jarvis", icon: Bot },
  ];

  return (
    <>
      {/* Menú flotante fijo abajo */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-md border-t border-white/10 z-50 pb-safe">
        <div className="flex justify-around items-center h-[60px]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.path === "/" ? path === "/" : path.startsWith(tab.path);
            return (
              <Link
                key={tab.name}
                to={tab.path}
                onClick={handleTabClick}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive ? "text-amber-500" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "scale-110" : ""} transition-transform`} />
                <span className="text-[10px] font-medium">{tab.name}</span>
              </Link>
            );
          })}
          
          <button
            onClick={() => { if(navigator.vibrate) navigator.vibrate(10); setShowMore(!showMore); }}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              showMore ? "text-amber-500" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">Más</span>
          </button>
        </div>
      </div>

      {/* Panel desplegable de "Más" */}
      {showMore && (
        <div className="md:hidden fixed bottom-[60px] left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-white/10 z-40 p-4 grid grid-cols-3 gap-4 pb-8">
          <Link to="/clientes" className="flex flex-col items-center text-zinc-400 text-xs hover:text-white" onClick={handleTabClick}>
            <span className="bg-zinc-800 p-3 rounded-full mb-1">👥</span> Clientes
          </Link>
          <Link to="/inventario" className="flex flex-col items-center text-zinc-400 text-xs hover:text-white" onClick={handleTabClick}>
            <span className="bg-zinc-800 p-3 rounded-full mb-1">📦</span> Inventario
          </Link>
          <Link to="/tareas" className="flex flex-col items-center text-zinc-400 text-xs hover:text-white" onClick={handleTabClick}>
            <span className="bg-zinc-800 p-3 rounded-full mb-1">📝</span> Tareas
          </Link>
          <Link to="/ventas" className="flex flex-col items-center text-zinc-400 text-xs hover:text-white" onClick={handleTabClick}>
            <span className="bg-zinc-800 p-3 rounded-full mb-1">💰</span> Ventas
          </Link>
          <Link to="/mi-joyeria" className="flex flex-col items-center text-zinc-400 text-xs hover:text-white" onClick={handleTabClick}>
            <span className="bg-zinc-800 p-3 rounded-full mb-1">🏪</span> Mi Joyería
          </Link>
          <Link to="/equipo" className="flex flex-col items-center text-zinc-400 text-xs hover:text-white" onClick={handleTabClick}>
            <span className="bg-zinc-800 p-3 rounded-full mb-1">👨‍💼</span> Equipo
          </Link>
          {/* NUEVOS BOTONES AGREGADOS AQUÍ */}
          <Link to="/iphone" className="flex flex-col items-center text-zinc-400 text-xs hover:text-white" onClick={handleTabClick}>
            <span className="bg-zinc-800 p-3 rounded-full mb-1"><Smartphone className="w-5 h-5 text-amber-500"/></span> Siri y App
          </Link>
          <button onClick={() => { handleTabClick(); logout(); }} className="flex flex-col items-center text-red-400 text-xs hover:text-red-300">
            <span className="bg-red-950/50 p-3 rounded-full mb-1"><LogOut className="w-5 h-5 text-red-500"/></span> Salir
          </button>
        </div>
      )}
    </>
  );
};