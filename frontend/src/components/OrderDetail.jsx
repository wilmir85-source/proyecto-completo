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
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Trash2, CheckCircle2 } from "lucide-react";

// Separador elegante (hilo de oro)
const Section = ({ children }) => <div className="border-t border-[#c5a572]/20 pt-4 mt-2">{children}</div>;

export const OrderDetail = ({ order: current, users = [], onClose, onChange }) => {
  const { user } = useAuth();
  const last = useRef(null);
  if (current) last.current = current;
  const order = current || last.current;
  const staff = ["admin", "ventas"].includes(user?.role);
  const canEdit = !!order && (staff || order.asignado_a === user?.id || order.stage === user?.departamento);
  
  return (
    <Dialog open={!!current} onOpenChange={(o) => !o && onClose()}>
      
      {/* EFECTO DE CRISTAL Y BORDE DORADO EN LA VENTANA */}
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto z-[100] bg-zinc-950/80 backdrop-blur-2xl border-[#c5a572]/40 p-5 pb-28 shadow-2xl rounded-2xl">
        {order && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl text-gold-gradient pr-8">{order.cliente}</DialogTitle>
            </DialogHeader>
            
            {/* FOLIO ESTILO SELLO DE LUJO */}
            <div className="inline-block text-xs font-mono font-bold text-[#c5a572] bg-[#c5a572]/10 px-2 py-0.5 rounded border border-[#c5a572]/30 mb-3 mt-1 tracking-widest">
              FOLIO: {order.folio || "S/N"}
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <StageBadge stage={order.stage} />
                <DueBadge status={order.estado_entrega} testid="detail-due-status" />
                <span className="text-xs text-zinc-400">Entrega: <span className="text-zinc-200">{fmtDate(order.fecha_entrega)}</span></span>
              </div>
              
              <p className="text-sm text-zinc-300 bg-white/5 p-3 rounded-lg border border-white/5">{order.descripcion}</p>
              
              <div className="text-xs text-zinc-400 flex flex-wrap gap-x-6 gap-y-2 bg-black/20 p-3 rounded-lg">
                {order.telefono_cliente && <span>Teléfono: <span className="text-zinc-200">{order.telefono_cliente}</span></span>}
                {staff && <span>Precio: <span className="text-gold-gradient font-bold text-sm">{money(order.precio)}</span></span>}
                {order.creado_por && <span>Creado por: <span className="text-zinc-200">{order.creado_por}</span></span>}
              </div>
              
              {order.notas && <p className="text-xs text-zinc-500 italic">Nota: {order.notas}</p>}
              
              <div className="flex flex-col gap-2">
                {canEdit && <PdfButton order={order} />}
                {staff && <ShareButton order={order} />}
              </div>
              
              <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-[#c5a572]/20">
                
                {/* BOTÓN DE ENTREGADO */}
                {canEdit && (
                  <button 
                    onClick={async () => {
                      if (window.confirm("¿Confirmas que el cliente ya recibió el pedido y se cerró la cuenta?")) {
                        try {
                          await api.patch(`/orders/${order.id}`, { stage: "Entregado" });
                          toast.success("¡Pedido entregado con éxito!");
                          onChange(); 
                          onClose();   
                        } catch (e) {
                          toast.error("Error al marcar como entregado");
                        }
                      }
                    }}
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/40 transform hover:scale-[1.01]"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Marcar como Entregado
                  </button>
                )}

                {/* BOTÓN DE ELIMINAR */}
                {staff && (
                  <button 
                    onClick={async () => {
                      if (window.confirm("¿Estás seguro de eliminar/cancelar este pedido? Se moverá al Historial.")) {
                        try {
                          await api.delete(`/orders/${order.id}`);
                          toast.success("Pedido archivado");
                          onChange();
                          onClose();
                        } catch (e) {
                          toast.error("Error al archivar");
                        }
                      }
                    }}
                    className="w-full bg-zinc-900/50 border border-red-900/50 hover:bg-red-950/40 text-red-400 font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" /> Eliminar / Cancelar Pedido
                  </button>
                )}
              </div>

              {/* El componente OrderWork contiene los inputs (Departamento, Progreso, etc.) */}
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