import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

export const FloatingActionButton = () => {
  const nav = useNavigate();
  return (
    <button
      onClick={() => nav(`/pedidos?nuevo=${Date.now()}`)}
      data-testid="fab-new-order"
      aria-label="Nuevo pedido"
      className="btn-gold fixed right-5 md:right-10 bottom-[124px] md:bottom-10 z-40 w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl transition-transform hover:scale-105 active:scale-95"
    >
      <Plus className="w-7 h-7" strokeWidth={2} />
    </button>
  );
};
