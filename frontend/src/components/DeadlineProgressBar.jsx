import { AlertTriangle, Clock } from "lucide-react";

export const DeadlineProgressBar = ({ fecha_entrega, progreso, stage }) => {
  // Si no hay fecha o el pedido ya terminó, no mostramos la barra de tiempo
  if (!fecha_entrega || stage === "Terminado" || stage === "Entregado") return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const entrega = new Date(fecha_entrega);
  entrega.setHours(0, 0, 0, 0);

  // Calculamos los días exactos de diferencia
  const diffTime = entrega - hoy;
  const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let colorClass = "bg-emerald-500";
  let textClass = "text-emerald-400";
  let mensaje = `${diasRestantes} días restantes`;
  let showUrgentIcon = false;

  // Lógica de colores y mensajes
  if (diasRestantes < 0) {
    colorClass = "bg-red-600 animate-pulse";
    textClass = "text-red-500 font-bold";
    mensaje = `¡PLAZO VENCIDO por ${Math.abs(diasRestantes)} días!`;
    showUrgentIcon = true;
  } else if (diasRestantes === 0) {
    colorClass = "bg-red-600 animate-pulse";
    textClass = "text-red-500 font-bold";
    mensaje = "¡ENTREGA HOY!";
    showUrgentIcon = true;
  } else if (diasRestantes <= 1) {
    colorClass = "bg-red-600 animate-pulse";
    textClass = "text-red-500 font-bold";
    mensaje = "¡SÚPER URGENTE! (1 día o menos)";
    showUrgentIcon = true;
  } else if (diasRestantes <= 2) {
    colorClass = "bg-red-500";
    textClass = "text-red-400 font-semibold";
    mensaje = `Urgente: Quedan ${diasRestantes} días`;
  } else if (diasRestantes <= 4) {
    colorClass = "bg-yellow-500";
    textClass = "text-yellow-400";
    mensaje = `Atención: Quedan ${diasRestantes} días`;
  }

  // Calculamos el ancho de la barra (tomando 10 días como el 100% del tiempo)
  const maxDias = 10;
  const porcentajeTiempo = Math.max(0, Math.min(100, (diasRestantes / maxDias) * 100));

  return (
    <div className="space-y-1.5 mt-2 bg-zinc-900/50 p-3 rounded-lg border border-white/5">
      <div className="flex justify-between items-center text-xs">
        <span className={`flex items-center gap-1.5 ${textClass}`}>
          {showUrgentIcon ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          {mensaje}
        </span>
        <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Progreso: {progreso}%</span>
      </div>
      <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/10">
        <div
          className={`h-full ${colorClass} transition-all duration-500`}
          style={{ width: `${porcentajeTiempo}%` }}
        />
      </div>
    </div>
  );
};