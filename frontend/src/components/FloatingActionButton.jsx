import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

export const FloatingActionButton = () => {
  return (
    <Link
      to="/pedidos"
      className="fixed right-5 md:right-10 z-40 bg-amber-600 hover:bg-[#c5a572] text-black p-4 rounded-full shadow-xl shadow-amber-900/40 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center border-2 border-amber-400/50"
      style={{ bottom: "150px" }} // <--- ESTO OBLIGA AL BOTÓN A SUBIR
      aria-label="Nuevo Pedido"
    >
      <Plus className="w-6 h-6" strokeWidth={3} />
    </Link>
  );
};