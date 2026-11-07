import { Trash2, Clock, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAGES, DUE_STYLES, fileUrl, fmtDate, money } from "@/lib/stages";
import { DueBadge, Avatar, ProgressBar } from "@/components/Badges";

export const OrderCard = ({ order: o, canEdit, canDelete, onOpen, onMove, onDelete, onDragStart }) => (
  <div
    draggable={canEdit}
    onDragStart={onDragStart}
    onClick={onOpen}
    className={`relative rounded-xl p-4 cursor-pointer transition-all duration-300 group overflow-hidden backdrop-blur-md bg-zinc-950/60 shadow-lg hover:-translate-y-1 hover:shadow-2xl hover:bg-zinc-900/80 border ${DUE_STYLES[o.estado_entrega]?.card || 'border-white/5'}`}
    data-testid={`order-card-${o.id}`}
  >
    {/* Brillo sutil de cristal en la parte superior */}
    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

    {o.fotos?.length > 0 && (
      <div className="relative -mx-4 -mt-4 mb-3 h-28 overflow-hidden rounded-t-xl border-b border-white/5">
        <img src={fileUrl(o.fotos[0].path, o.fotos[0].url)} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" data-testid={`order-thumb-${o.id}`} />
        {o.fotos.length > 1 && (
          <span className="absolute bottom-1.5 right-1.5 text-[10px] px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[#c5a572] border border-[#c5a572]/30 font-medium">
            +{o.fotos.length - 1}
          </span>
        )}
      </div>
    )}
    
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        {/* El Folio ahora parece un sello de lujo */}
        <div className="inline-block text-[10px] font-mono font-bold text-[#c5a572] bg-[#c5a572]/10 px-1.5 py-0.5 rounded border border-[#c5a572]/20 mb-1 tracking-widest">
          {o.folio || "S/N"}
        </div>
        <div className="font-medium text-sm truncate text-zinc-100">{o.cliente}</div>
        <div className="text-xs text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">{o.descripcion}</div>
      </div>
      {canDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-zinc-500 hover:text-red-400 bg-white/5 hover:bg-red-500/20 p-1.5 rounded-full md:opacity-0 group-hover:opacity-100 transition-all" data-testid={`btn-delete-${o.id}`}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>

    {o.progreso > 0 && <div className="mt-3"><ProgressBar value={o.progreso} /></div>}
    
    {canDelete && o.stage === "Terminado" && o.saldo > 0 && (
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-red-300 bg-red-950/60 backdrop-blur-md border border-red-500/40 rounded-lg px-2.5 py-1.5 shadow-inner" data-testid={`saldo-alert-${o.id}`}>
        <AlertTriangle className="w-3.5 h-3.5" /> Saldo pendiente <span className="font-bold">{money(o.saldo)}</span>
      </div>
    )}

    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/10">
      <div className="flex items-center gap-2 min-w-0">
        {o.asignado_nombre && <Avatar name={o.asignado_nombre} />}
        {["atrasado", "por_vencer"].includes(o.estado_entrega)
          ? <DueBadge status={o.estado_entrega} testid={`due-${o.id}`} />
          : <span className="text-[11px] text-zinc-500 flex items-center gap-1 truncate"><Clock className="w-3 h-3 text-[#c5a572]" />{o.fecha_entrega ? fmtDate(o.fecha_entrega, { day: "numeric", month: "short" }) : "sin fecha"}</span>}
      </div>
      {canEdit && (
        <div onClick={(e) => e.stopPropagation()}>
          <Select value={o.stage} onValueChange={onMove}>
            <SelectTrigger className="h-7 w-28 bg-white/5 border-white/10 text-[11px] text-zinc-300 hover:bg-white/10 hover:border-[#c5a572]/50 transition-colors rounded-lg" data-testid={`stage-select-${o.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-950/95 backdrop-blur-xl border-[#c5a572]/30 shadow-2xl">
              {STAGES.map((s) => <SelectItem key={s} value={s} className="text-xs focus:bg-[#c5a572]/20 focus:text-[#c5a572]">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  </div>
);