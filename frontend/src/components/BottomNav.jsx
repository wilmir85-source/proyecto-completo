import { Link, useLocation } from "react-router-dom";
import { Home, ClipboardList, Hammer, Bot, Menu, Smartphone, LogOut, Archive, Gem } from "lucide-react"; // <-- Agregamos Gem
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export const BottomNav = () => {
  const location = useLocation();
  const path = location.pathname;
  const [showMore, setShowMore] = useState(false);
  const { user, logout } = useAuth(); // <-- Agregamos 'user' para validar el permiso

  // Lógica para mostrar Moldes solo a los autorizados
  const canSeeMolds = ["admin", "ventas"].includes(user?.role) || 
                      user?.departamento === "Ceras" || 
                      user?.departamento === "Inyección";

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
      {/* Menú flotante fijo abajo - Efecto Cristal */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#09090b]/80 backdrop-blur-2xl border-t border-[#c5a572]/30 z-50 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.6)]">
        <div className="flex justify-around items-center h-[65px]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.path === "/" ? path === "/" : path.startsWith(tab.path);
            return (
              <Link
                key={tab.name}
                to={tab.path}
                onClick={handleTabClick}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all ${
                  isActive ? "text-[#c5a572]" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <div className={`p-1.5 rounded-full transition-all ${isActive ? "bg-[#c5a572]/15 shadow-[0_0_10px_rgba(197,165,114,0.2)]" : ""}`}>
                  <Icon className={`w-5 h-5 ${isActive ? "scale-110 drop-shadow-md" : ""} transition-transform`} />
                </div>
                <span className={`text-[10px] font-medium ${isActive ? "font-semibold" : ""}`}>{tab.name}</span>
              </Link>
            );
          })}
          
          <button
            onClick={() => { if(navigator.vibrate) navigator.vibrate(10); setShowMore(!showMore); }}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all ${
              showMore ? "text-[#c5a572]" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <div className={`p-1.5 rounded-full transition-all ${showMore ? "bg-[#c5a572]/15 shadow-[0_0_10px_rgba(197,165,114,0.2)]" : ""}`}>
               <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">Más</span>
          </button>
        </div>
      </div>

      {/* Panel desplegable de "Más" */}
      {showMore && (
        <div className="md:hidden fixed bottom-[65px] left-0 right-0 bg-zinc-950/95 backdrop-blur-2xl border-t border-[#c5a572]/30 z-40 p-5 grid grid-cols-3 gap-y-6 gap-x-2 pb-10 shadow-2xl">
          <Link to="/clientes" className="flex flex-col items-center text-zinc-300 text-[11px] hover:text-white" onClick={handleTabClick}>
            <span className="bg-[#c5a572]/10 border border-[#c5a572]/20 p-3 rounded-full mb-1.5 shadow-sm text-[#c5a572]">👥</span> Clientes
          </Link>
          <Link to="/inventario" className="flex flex-col items-center text-zinc-300 text-[11px] hover:text-white" onClick={handleTabClick}>
            <span className="bg-[#c5a572]/10 border border-[#c5a572]/20 p-3 rounded-full mb-1.5 shadow-sm text-[#c5a572]">📦</span> Inventario
          </Link>
          <Link to="/tareas" className="flex flex-col items-center text-zinc-300 text-[11px] hover:text-white" onClick={handleTabClick}>
            <span className="bg-[#c5a572]/10 border border-[#c5a572]/20 p-3 rounded-full mb-1.5 shadow-sm text-[#c5a572]">📝</span> Tareas
          </Link>
          <Link to="/ventas" className="flex flex-col items-center text-zinc-300 text-[11px] hover:text-white" onClick={handleTabClick}>
            <span className="bg-[#c5a572]/10 border border-[#c5a572]/20 p-3 rounded-full mb-1.5 shadow-sm text-[#c5a572]">💰</span> Ventas
          </Link>
          <Link to="/mi-joyeria" className="flex flex-col items-center text-zinc-300 text-[11px] hover:text-white" onClick={handleTabClick}>
            <span className="bg-[#c5a572]/10 border border-[#c5a572]/20 p-3 rounded-full mb-1.5 shadow-sm text-[#c5a572]">🏪</span> Mi Joyería
          </Link>
          
          {/* BOTÓN DE MOLDES (Protegido) */}
          {canSeeMolds && (
            <Link to="/moldes" className="flex flex-col items-center text-zinc-300 text-[11px] hover:text-white" onClick={handleTabClick}>
              <span className="bg-[#c5a572]/10 border border-[#c5a572]/20 p-3 rounded-full mb-1.5 shadow-sm">
                <Gem className="w-5 h-5 text-[#c5a572]"/>
              </span> Moldes
            </Link>
          )}

          <Link to="/historial" className="flex flex-col items-center text-zinc-300 text-[11px] hover:text-white" onClick={handleTabClick}>
            <span className="bg-[#c5a572]/10 border border-[#c5a572]/20 p-3 rounded-full mb-1.5 shadow-sm">
              <Archive className="w-5 h-5 text-[#c5a572]"/>
            </span> Historial
          </Link>

          <Link to="/equipo" className="flex flex-col items-center text-zinc-300 text-[11px] hover:text-white" onClick={handleTabClick}>
            <span className="bg-[#c5a572]/10 border border-[#c5a572]/20 p-3 rounded-full mb-1.5 shadow-sm text-[#c5a572]">👨‍💼</span> Equipo
          </Link>
          <Link to="/iphone" className="flex flex-col items-center text-zinc-300 text-[11px] hover:text-white" onClick={handleTabClick}>
            <span className="bg-[#c5a572]/10 border border-[#c5a572]/20 p-3 rounded-full mb-1.5 shadow-sm">
              <Smartphone className="w-5 h-5 text-[#c5a572]"/>
            </span> Siri y App
          </Link>
          <button onClick={() => { handleTabClick(); logout(); }} className="flex flex-col items-center text-red-400 text-[11px] hover:text-red-300">
            <span className="bg-red-950/50 border border-red-500/20 p-3 rounded-full mb-1.5 shadow-sm">
              <LogOut className="w-5 h-5 text-red-500"/>
            </span> Salir
          </button>
        </div>
      )}
    </>
  );
};