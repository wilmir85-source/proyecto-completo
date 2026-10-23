import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { money, fmtDate } from "@/lib/stages";
import { useAuth } from "@/context/AuthContext";
import { OrderPhotos } from "@/components/OrderPhotos";
import { OrderWork } from "@/components/OrderWork";
import { OrderPayments } from "@/components/OrderPayments";
import { OrderHistory } from "@/components/OrderHistory";
import { PdfButton } from "@/components/PdfButton";
import { ShareButton } from "@/components/ShareButton";
import { DueBadge, StageBadge } from "@/components/Badges";

const Section = ({ children }) => <div className="border-t border-white/5 pt-4">{children}</div>;

export const OrderDetail = ({ order: current, users = [], onClose, onChange }) => {
  const { user } = useAuth();
  const last = useRef(null);
  if (current) last.current = current;
  const order = current || last.current;
  const staff = ["admin", "ventas"].includes(user?.role);
  const canEdit = !!order && (staff || order.asignado_a === user?.id || order.stage === user?.departamento);
  
  return (
    <Dialog open={!!current} onOpenChange={(o) => !o && onClose()}>
      
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto z-[100] bg-zinc-950 border-zinc-800 p-5 pb-28">
        {order && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl pr-8">{order.cliente}</DialogTitle>
            </DialogHeader>
            
            {/* AQUÍ ESTÁ EL FOLIO AGREGADO */}
            <div className="text-xs font-mono text-amber-500 mb-2 -mt-1">Folio: {order.folio || "S/N"}</div>
            
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <StageBadge stage={order.stage} />
                <DueBadge status={order.estado_entrega} testid="detail-due-status" />
                <span className="text-xs text-zinc-500">Entrega: {fmtDate(order.fecha_entrega)}</span>
              </div>
              <p className="text-sm text-zinc-300">{order.descripcion}</p>
              <div className="text-xs text-zinc-500 flex flex-wrap gap-x-4">
                {order.telefono_cliente && <span>Tel: <span className="text-zinc-300">{order.telefono_cliente}</span></span>}
                {staff && <span>Precio: <span className="text-zinc-300">{money(order.precio)}</span></span>}
                {order.creado_por && <span>Creado por {order.creado_por}</span>}
              </div>
              {order.notas && <p className="text-xs text-zinc-500">{order.notas}</p>}
              {canEdit && <PdfButton order={order} />}
              {staff && <ShareButton order={order} />}
              <Section>{canEdit
                ? <OrderWork key={`${order.id}-${order.progreso}`} order={order} staff={staff} users={users} onChange={onChange} />
                : <div className="text-xs text-zinc-500 bg-zinc-900/60 border border-white/5 rounded-lg p-3" data-testid="detail-readonly-hint">Solo lectura: este trabajo está en {order.stage}{order.asignado_nombre ? ` con ${order.asignado_nombre}` : ""}. Puedes actualizarlo cuando llegue a tu departamento o te lo asignen.</div>}</Section>
              {staff && <Section><OrderPayments order={order} onChange={onChange} /></Section>}
              <Section><OrderHistory order={order} onChange={onChange} readOnly={!canEdit} /></Section>
              <Section><OrderPhotos order={order} onChange={onChange} readOnly={!canEdit} /></Section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};