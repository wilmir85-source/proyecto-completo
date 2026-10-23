import { Trash2, Clock, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAGES, DUE_STYLES, fileUrl, fmtDate, money } from "@/lib/stages";
import { DueBadge, Avatar, ProgressBar } from "@/components/Badges";

export const OrderCard = ({ order: o, canEdit, canDelete, onOpen, onMove, onDelete, onDragStart }) => (
  <div
    draggable={canEdit}
    onDragStart={onDragStart}
    onClick={onOpen}
    className={`bg-zinc-900/70 border rounded-xl p-4 cursor-pointer hover:bg-zinc-900 transition-colors group ${DUE_STYLES[o.estado_entrega]?.card}`}
    data-testid={`order-card-${o.id}`}
  >
    {o.fotos?.length > 0 && (
      <div className="relative -mx-4 -mt-4 mb-3 h-28 overflow-hidden rounded-t-xl">
        {/* Aquí está el arreglo para que jale la foto de Cloudinary */}
        <img src={fileUrl(o.fotos[0].path, o.fotos[0].url)} alt="" className="w-full h-full object-cover" data-testid={`order-thumb-${o.id}`} />
        {o.fotos.length > 1 && <span className="absolute bottom-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-zinc-200">+{o.fotos.length - 1}</span>}
      </div>
    )}
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        {/* Aquí agregamos el número de Folio */}
        <div className="text-[10px] font-mono text-amber-500/80 mb-0.5 tracking-wider">{o.folio || "S/N"}</div>
        <div className="font-medium text-sm truncate">{o.cliente}</div>
        <div className="text-xs text-zinc-400 mt-1 line-clamp-2">{o.descripcion}</div>
      </div>
      {canDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-zinc-600 hover:text-red-400 md:opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`btn-delete-${o.id}`}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
    {o.progreso > 0 && <div className="mt-3"><ProgressBar value={o.progreso} /></div>}
    {canDelete && o.stage === "Terminado" && o.saldo > 0 && (
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-red-300 bg-red-950/50 border border-red-500/40 rounded-md px-2 py-1" data-testid={`saldo-alert-${o.id}`}>
        <AlertTriangle className="w-3 h-3" /> Saldo pendiente {money(o.saldo)}
      </div>
    )}
    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/5">
      <div className="flex items-center gap-1.5 min-w-0">
        {o.asignado_nombre && <Avatar name={o.asignado_nombre} />}
        {["atrasado", "por_vencer"].includes(o.estado_entrega)
          ? <DueBadge status={o.estado_entrega} testid={`due-${o.id}`} />
          : <span className="text-xs text-zinc-500 flex items-center gap-1 truncate"><Clock className="w-3 h-3" />{o.fecha_entrega ? fmtDate(o.fecha_entrega, { day: "numeric", month: "short" }) : "sin fecha"}</span>}
      </div>
      {canEdit && (
        <div onClick={(e) => e.stopPropagation()}>
          <Select value={o.stage} onValueChange={onMove}>
            <SelectTrigger className="h-6 w-28 bg-transparent border-zinc-800 text-xs" data-testid={`stage-select-${o.id}`}><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800">
              {STAGES.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  </div>
);