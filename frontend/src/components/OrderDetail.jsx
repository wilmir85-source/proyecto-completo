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
        BOTTOM SHEET PARA MÓVIL:
        - Se ancla abajo (bottom-0)
        - Ocupa todo el ancho en celular (w-full) y un ancho máximo en PC (md:max-w-xl)
        - Tiene esquinas redondeadas arriba (rounded-t-3xl)
        - Deja espacio abajo para el gesto del iPhone (pb-[env(safe-area-inset-bottom)])
      */}
      <DialogContent className="fixed bottom-0 top-auto translate-y-0 left-0 right-0 w-full md:max-w-xl md:mx-auto bg-zinc-950 border-zinc-800 border-b-0 rounded-t-3xl rounded-b-none max-h-[90dvh] overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-8 shadow-2xl data-[state=open]:slide-in-from-bottom duration-300" data-testid="order-detail-dialog">
        
        {/* Barrita de arrastre (Drag Handle) */}
        <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mb-4 md:hidden" />

        {order && (
          <>
            <DialogHeader className="mb-2">
              <DialogTitle className="font-display text-2xl text-zinc-100 flex items-center justify-between">
                {order.cliente}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <StageBadge stage={order.stage} />
                <DueBadge status={order.estado_entrega} testid="detail-due-status" />
                <span className="text-xs text-zinc-500">Entrega: {fmtDate(order.fecha_entrega)}</span>
              </div>
              
              <p className="text-sm text-zinc-300 bg-zinc-900/50 p-3 rounded-xl border border-white/5">{order.descripcion}</p>
              
              <div className="text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-2">
                {order.telefono_cliente && <span className="flex items-center gap-1">Tel: <span className="text-zinc-300 font-medium">{order.telefono_cliente}</span></span>}
                {staff && <span className="flex items-center gap-1">Precio: <span className="text-zinc-300 font-medium">{money(order.precio)}</span></span>}
                {order.creado_por && <span>Creado por {order.creado_por}</span>}
              </div>
              
              {order.notas && <p className="text-xs text-zinc-500 bg-amber-500/10 p-2 rounded border border-amber-500/20 text-amber-200/80">Nota: {order.notas}</p>}
              
              {/* Botones de acción principales */}
              <div className="flex flex-col gap-2 pt-2">
                {canEdit && <div className="w-full"><PdfButton order={order} /></div>}
                {staff && <div className="w-full"><ShareButton order={order} /></div>}
              </div>

              <Section>
                {canEdit
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