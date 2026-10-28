import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

export const FloatingActionButton = () => {
  return (
    <Link
      to="/pedidos"
      className="fixed bottom-[85px] md:bottom-10 right-5 md:right-10 z-40 bg-amber-600 hover:bg-amber-500 text-black p-4 rounded-full shadow-xl shadow-amber-900/40 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center"
      aria-label="Nuevo Pedido"
    >
      <Plus className="w-6 h-6" strokeWidth={3} />
    </Link>
  );
};