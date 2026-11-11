import { useState } from "react";
import { Zap } from "lucide-react";
import JarvisHUD from "@/pages/JarvisHUD";

export default function JarvisWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* BOTÓN FLOTANTE (El Arc Reactor) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[90] w-14 h-14 bg-zinc-950 border-2 border-cyan-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:scale-110 transition-transform group"
      >
        <Zap className="w-6 h-6 text-cyan-400 group-hover:animate-pulse" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
        </span>
      </button>

      {/* VENTANA MODAL FLOTANTE */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 md:p-6">
          <div className="w-full max-w-md h-[90vh] md:h-[80vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
            <JarvisHUD onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}