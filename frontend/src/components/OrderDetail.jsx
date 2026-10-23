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
      {/* 
        DISEÑO RESPONSIVO UNIVERSAL:
        - w-[95vw] md:max-w-xl: 95% de ancho en cel, máx 576px en PC.
        - max-h-[85dvh]: Usa el alto real de la pantalla (evita la muesca del iPhone).
        - z-[100]: Se pone por ENCIMA del menú de abajo para que no lo tape.
        - mt-8 mb-20: Da un pequeño respiro arriba y abajo en el celular.
      */}
      <DialogContent className="bg-zinc-950 border-zinc-800 w-[95vw] md:max-w-xl max-h-[85dvh] mt-8 mb-20 md:my-auto overflow-y-auto rounded-xl z-[100] p-5 md:p-6 shadow-2xl">
        {order && (
          <>
            <DialogHeader className="pb-2">
              <DialogTitle className="font-display text-xl pr-8">{order.cliente}</DialogTitle>
            </DialogHeader>
            
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
                : <div className="text-xs text-zinc-500 bg-zinc-900/60 border border-white/5 rounded-lg p-3" data-testid="detail-readonly-hint">Solo lectura: este trabajo está en {order.stage}{order.asignado_nombre ? ` con ${order.asignado_nombre}` : ""}. Puedes actualizarlo cuando llegue a tu departamento o te lo asignen.</div>}
              </Section>
              
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