import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { STAGES, ORDER_TYPES, toISO, toLocalInput, apiError } from "@/lib/stages";
import { useFinishOrder } from "@/components/FinishOrderDialog";
import { DeadlineProgressBar } from "@/components/DeadlineProgressBar";
import {
  CheckCircle2, AlertTriangle, PauseCircle, PlayCircle, RotateCcw, Loader2, X, PackageCheck,
} from "lucide-react";

const Label = ({ children }) => (
  <div className="text-xs uppercase tracking-widest text-zinc-400 mb-1.5">{children}</div>
);

const IMPORT_STAGES = ["Comprada (USA)", "En Bodega USA", "En Vuelo a GT", "En Aduana (GT)", "Lista en Taller", "Entregada al Cliente"];
const DIGITAL_TYPES = ["Diseño", "Molde", "Diseño 3D"];
const JEWELRY_CHAIN = ["Ventas", "Diseño 3D", "Ceras", "Casting", "Fabricación", "Terminado", "Entregado"];
const DIGITAL_CHAIN = ["Ventas", "Diseño 3D", "Terminado", "Entregado"];
const ALT_SLOT = { "Inyección": 2, "Vulcanizado": 3, "Grabado Láser": 4, "Reparaciones": 4 };

const isDigitalType = (t) => DIGITAL_TYPES.includes(t);

// Cadena de avance: respeta el tipo de trabajo y nunca "avanza" desde Terminado/Entregado.
const getNextStage = (currentStage, orderType) => {
  if (currentStage === "Terminado" || currentStage === "Entregado") return null;
  if (orderType === "Importación de máquinas") return null;
  if (currentStage === "Ventas") return "Diseño 3D";
  if (isDigitalType(orderType)) return "Terminado";
  if (currentStage === "Diseño 3D") return "Ceras";
  if (currentStage === "Ceras" || currentStage === "Inyección") return "Casting";
  if (currentStage === "Casting" || currentStage === "Vulcanizado") return "Fabricación";
  if (currentStage === "Fabricación" || currentStage === "Grabado Láser" || currentStage === "Reparaciones") return "Terminado";
  return null;
};

// El estado "pausado" se deriva de las notas (sin tocar el backend): gana la última marca.
const getPauseInfo = (notas = "") => {
  const iP = notas.lastIndexOf("[PAUSADO");
  const iR = Math.max(notas.lastIndexOf("[REANUDADO"), notas.lastIndexOf("[REPETIR]"));
  const paused = iP !== -1 && iP > iR;
  let stage = "", motivo = "";
  if (paused) {
    const m = [...notas.matchAll(/\[PAUSADO en ([^\]]+)\]:\s*([^\n]+)/g)].pop();
    if (m) { stage = m[1]; motivo = m[2]; }
  }
  return { paused, stage, motivo };
};

const appendNota = (notas, tag) => [notas?.trimEnd(), tag].filter(Boolean).join("\n");

// Mini-mapa de la cadena: el trabajador ve dónde está y qué sigue.
const StageChain = ({ order, isImport, isDigital }) => {
  const { chain, current, accent } = useMemo(() => {
    if (isImport) {
      return { chain: IMPORT_STAGES, current: IMPORT_STAGES.indexOf(order.import_status || IMPORT_STAGES[0]), accent: "blue" };
    }
    const base = isDigital ? [...DIGITAL_CHAIN] : [...JEWELRY_CHAIN];
    if (!isDigital && ALT_SLOT[order.stage] != null) base[ALT_SLOT[order.stage]] = order.stage;
    return { chain: base, current: base.indexOf(order.stage), accent: "gold" };
  }, [order.stage, order.import_status, isImport, isDigital]);

  const dot = (i) =>
    i < current ? "bg-emerald-500"
    : i === current ? (accent === "blue" ? "bg-blue-400 animate-pulse" : "bg-[#c5a572] animate-pulse")
    : "bg-zinc-700";
  const txt = (i) =>
    i < current ? "text-emerald-500/80"
    : i === current ? (accent === "blue" ? "text-blue-300 font-bold" : "text-[#c5a572] font-bold")
    : "text-zinc-500";

  return (
    <div className="col-span-2 flex items-center gap-1.5 bg-zinc-900/40 border border-white/5 rounded-lg px-3 py-2 overflow-x-auto" data-testid="stage-chain">
      {chain.map((s, i) => (
        <Fragment key={s}>
          {i > 0 && <div className={`h-px flex-1 min-w-[6px] ${i <= current ? "bg-emerald-700" : "bg-zinc-800"}`} />}
          <div className="flex items-center gap-1 shrink-0">
            <span className={`w-2 h-2 rounded-full ${dot(i)}`} />
            <span className={`text-[9px] uppercase tracking-wider whitespace-nowrap ${txt(i)}`}>{s}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
};

const REPEAT_DESTS = [
  { id: "Diseño 3D", desc: "Reimprimir en resina castable" },
  { id: "Ceras", desc: "Volver a fabricar la cera a mano" },
  { id: "Inyección", desc: "Volver a inyectar con el molde de goma" },
];

// Diálogo propio en lugar de window.prompt / window.confirm.
const MotivoDialog = ({ kind, order, suggestedTarget, busy, onClose, onConfirm }) => {
  const [motivo, setMotivo] = useState("");
  const [target, setTarget] = useState(suggestedTarget);
  const isPausa = kind === "pausar";

  useEffect(() => { setMotivo(""); setTarget(suggestedTarget); }, [kind, suggestedTarget]);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const confirmar = () => {
    const m = motivo.trim();
    if (!m || busy) return;
    onConfirm(m, target);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="motivo-dialog"
    >
      <div role="dialog" aria-modal="true" aria-label={isPausa ? "Pausar trabajo" : "Repetir trabajo"}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPausa ? "bg-amber-950/60 text-amber-400" : "bg-red-950/60 text-red-400"}`}>
            {isPausa ? <PauseCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-zinc-100 font-bold">{isPausa ? "Pausar trabajo" : "Repetir trabajo"}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {isPausa
                ? `El pedido quedará marcado como pausado en ${order.stage} hasta que lo reanudes.`
                : "Registra qué pasó y elige a qué etapa regresa la pieza."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-200 transition-colors" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <Label>{isPausa ? "Motivo de la pausa" : "¿Qué pasó?"}</Label>
        <textarea
          autoFocus rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) confirmar(); }}
          placeholder={isPausa ? "Ej. Falta piedra de 2 mm, esperando oro…" : "Ej. Se arruinó al pulir, falló la fundición…"}
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c5a572]"
        />

        {!isPausa && (
          <div className="mt-3">
            <Label>Regresar a</Label>
            <div className="grid gap-2">
              {REPEAT_DESTS.map((d) => (
                <button key={d.id} type="button" onClick={() => setTarget(d.id)}
                  className={`flex items-center justify-between gap-2 text-left px-3 py-2 rounded-lg border transition-all ${target === d.id ? "border-[#c5a572] bg-[#c5a572]/10" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"}`}>
                  <span>
                    <span className={`block text-sm font-bold ${target === d.id ? "text-[#c5a572]" : "text-zinc-300"}`}>{d.id}</span>
                    <span className="block text-[11px] text-zinc-500">{d.desc}</span>
                  </span>
                  {d.id === suggestedTarget && (
                    <span className="text-[9px] uppercase tracking-widest text-emerald-400 border border-emerald-800 bg-emerald-950/50 rounded-full px-2 py-0.5 shrink-0">Sugerido</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-zinc-300 font-bold hover:bg-zinc-800/60 transition-all">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} disabled={!motivo.trim() || busy} data-testid="motivo-confirm"
            className={`flex-1 py-2.5 rounded-xl text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isPausa ? "bg-amber-600 hover:bg-amber-500" : "bg-red-600 hover:bg-red-500"}`}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPausa ? "Pausar pedido" : `Enviar a ${target}`}
          </button>
        </div>
        <p className="text-[10px] text-zinc-600 mt-2 text-center">Ctrl + Enter para confirmar · Esc para cancelar</p>
      </div>
    </div>
  );
};

export const OrderWork = ({ order, staff, users, onChange }) => {
  const [progreso, setProgreso] = useState(order.progreso ?? 0);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const timer = useRef(null);
  const orderRef = useRef(order);
  orderRef.current = order;
  const { notifyFinished } = useFinishOrder();

  // Sincroniza el slider cuando el pedido cambia desde el servidor o se abre otro pedido.
  useEffect(() => { setProgreso(order.progreso ?? 0); }, [order.id, order.progreso]);
  // Cancela commits pendientes al desmontar o cambiar de pedido.
  useEffect(() => () => clearTimeout(timer.current), [order.id]);

  const patch = async (body, msg) => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/orders/${orderRef.current.id}`, body);
      toast.success(msg);
      if (body.stage === "Terminado") notifyFinished(data);
      onChange?.();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const isImport = order.tipo === "Importación de máquinas";
  const isDigital = isDigitalType(order.tipo);
  const nextStage = getNextStage(order.stage, order.tipo);
  const pause = useMemo(() => getPauseInfo(order.notas || ""), [order.notas]);
  const suggestedTarget = isDigital || order.es_castable ? "Diseño 3D" : order.stage === "Inyección" ? "Inyección" : "Ceras";

  const importIdx = IMPORT_STAGES.indexOf(order.import_status || IMPORT_STAGES[0]);
  const nextImport = importIdx >= 0 && importIdx < IMPORT_STAGES.length - 1 ? IMPORT_STAGES[importIdx + 1] : null;
  const canAdvanceImport = nextImport && (nextImport !== "Entregada al Cliente" || staff);

  const confirmarPausa = (motivo) => {
    setDialog(null);
    patch({ notas: appendNota(order.notas, `[PAUSADO en ${order.stage}]: ${motivo}`) }, "Pedido pausado y motivo guardado");
  };
  const confirmarRepetir = (motivo, target) => {
    setDialog(null);
    patch(
      { stage: target, progreso: 0, notas: appendNota(order.notas, `[REPETIR]: ${motivo} (Regresó a ${target})`) },
      `Repetido: enviado a ${target}`
    );
  };
  const reanudar = () =>
    patch({ notas: appendNota(order.notas, `[REANUDADO en ${order.stage}]`) }, "Trabajo reanudado");

  const selectCls = "flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c5a572] disabled:opacity-50";

  return (
    <div className="grid grid-cols-2 gap-3" data-testid="order-work">

      <StageChain order={order} isImport={isImport} isDigital={isDigital} />

      {pause.paused && (
        <div className="col-span-2 flex items-start gap-3 bg-amber-950/30 border border-amber-900/50 rounded-lg p-3" data-testid="pause-banner">
          <PauseCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-amber-300">Pausado en {pause.stage || order.stage}</div>
            {pause.motivo && <div className="text-xs text-amber-200/70 mt-0.5 break-words">{pause.motivo}</div>}
          </div>
          <button type="button" onClick={reanudar} disabled={busy}
            className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-emerald-400 border border-emerald-800 bg-emerald-950/50 hover:bg-emerald-900/50 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50">
            <PlayCircle className="w-4 h-4" /> Reanudar
          </button>
        </div>
      )}

      {/* ETAPA ACTUAL */}
      <div className="col-span-2">
        <Label>Etapa actual</Label>
        {staff ? (
          <select value={order.stage} disabled={busy}
            onChange={(e) => patch({ stage: e.target.value }, `Movido a ${e.target.value}`)}
            className={selectCls}>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}{s === nextStage ? " → siguiente" : ""}</option>
            ))}
          </select>
        ) : (
          <div className="h-9 flex items-center px-3 rounded-md bg-zinc-900/50 border border-zinc-800 text-sm text-[#c5a572] font-bold">
            {order.stage}
          </div>
        )}
      </div>

      {/* AVANCE DE CADENA (trabajadores) */}
      {!staff && !isImport && nextStage && (
        <div className="col-span-2 mt-1">
          <button type="button" disabled={busy || pause.paused}
            title={pause.paused ? "Reanuda el pedido para poder avanzarlo" : undefined}
            onClick={() => patch({ stage: nextStage, progreso: 100 }, `¡Trabajo terminado! Enviado a ${nextStage}`)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="btn-advance">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Terminar y enviar a {nextStage}
          </button>
        </div>
      )}

      {/* AVANCE DE IMPORTACIÓN */}
      {isImport && canAdvanceImport && (
        <div className="col-span-2 mt-1">
          <button type="button" disabled={busy}
            onClick={() => patch({ import_status: nextImport }, `Importación: ${nextImport}`)}
            className="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-40">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackageCheck className="w-5 h-5" />}
            Avanzar paquete a {nextImport}
          </button>
        </div>
      )}

      {/* PAUSA / REPETIR (trabajadores) */}
      {!staff && (
        <div className="col-span-2 grid grid-cols-2 gap-2 mt-1">
          {!pause.paused && (
            <button type="button" onClick={() => setDialog("pausar")} disabled={busy}
              className="w-full bg-amber-950/40 border border-amber-900/50 text-amber-400 font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-amber-950/70 disabled:opacity-40"
              data-testid="btn-pause">
              <PauseCircle className="w-4 h-4" /> Pausar / Falta Mat.
            </button>
          )}
          <button type="button" onClick={() => setDialog("repetir")} disabled={busy}
            className={`${pause.paused ? "col-span-2" : ""} w-full bg-red-950/40 border border-red-900/50 text-red-400 font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-red-950/70 disabled:opacity-40`}
            data-testid="btn-repeat">
            <RotateCcw className="w-4 h-4" /> Repetir / Arruinado
          </button>
        </div>
      )}

      {/* RASTREADOR DE IMPORTACIÓN */}
      {isImport && (
        <div className="col-span-2 bg-blue-950/20 border border-blue-900/50 p-3 rounded-lg mt-1">
          <Label>Seguimiento del Paquete (Interno)</Label>
          <select value={order.import_status || IMPORT_STAGES[0]} disabled={busy}
            onChange={(e) => patch({ import_status: e.target.value }, `Importación: ${e.target.value}`)}
            className="flex h-9 w-full rounded-md border border-blue-800 bg-blue-950/50 px-3 py-1 text-sm text-blue-200 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:opacity-50">
            {IMPORT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* TIPO DE TRABAJO Y CASTABLE (Solo Admin/Ventas) */}
      {staff && !isImport && (
        <div className="col-span-2 grid grid-cols-2 gap-3 bg-zinc-900/30 p-3 rounded-lg border border-white/5 mt-2">
          <div>
            <Label>Tipo de trabajo</Label>
            <select value={order.tipo || "Fabricación"} disabled={busy}
              onChange={(e) => patch({ tipo: e.target.value }, `Tipo: ${e.target.value}`)}
              className={selectCls}>
              {ORDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>¿Es Castable? (Fundición)</Label>
            <label className="flex items-center gap-2 h-9 cursor-pointer">
              <input type="checkbox" checked={order.es_castable || false} disabled={busy}
                onChange={(e) => patch({ es_castable: e.target.checked }, `Castable: ${e.target.checked ? "Sí" : "No"}`)}
                className="w-5 h-5 accent-[#c5a572] rounded border-zinc-800" />
              <span className="text-sm text-zinc-300">Requiere fundición</span>
            </label>
          </div>
        </div>
      )}

      {/* ASIGNAR TRABAJADOR */}
      <div className="col-span-2">
        <Label>Asignar joyero / trabajador</Label>
        {staff ? (
          <select value={order.asignado_a || ""} disabled={busy}
            onChange={(e) => patch({ asignado_a: e.target.value || null }, "Asignación actualizada")}
            className={selectCls}>
            <option value="">Sin asignar</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        ) : (
          <div className="h-9 flex items-center text-sm text-zinc-300">{order.asignado_nombre || "Sin asignar"}</div>
        )}
      </div>

      {/* FECHA DE ENTREGA Y MATERIALES */}
      {staff && (
        <>
          <div className="col-span-2">
            <Label>Fecha de entrega estimada</Label>
            <Input key={`${order.id}-fe-${order.fecha_entrega ?? ""}`} type="datetime-local"
              defaultValue={toLocalInput(order.fecha_entrega)} disabled={busy} className="bg-zinc-900 border-zinc-800"
              onBlur={(e) => e.target.value !== toLocalInput(order.fecha_entrega) && patch({ fecha_entrega: toISO(e.target.value) }, "Fecha actualizada")} />
          </div>
          {!isImport && (
            <div className="col-span-2 grid grid-cols-3 gap-3">
              {[["metal", "Metal", "text"], ["peso_metal", "Peso metal (g)", "number"], ["piedra", "Tipo de piedra", "text"]].map(([k, l, t]) => (
                <div key={k}>
                  <Label>{l}</Label>
                  <Input key={`${order.id}-${k}-${order[k] ?? ""}`} type={t} step="0.01"
                    defaultValue={order[k] ?? ""} disabled={busy} className="bg-zinc-900 border-zinc-800"
                    onBlur={(e) => {
                      let v;
                      if (t === "number") {
                        if (e.target.value === "") v = null;
                        else {
                          v = parseFloat(e.target.value);
                          if (!Number.isFinite(v) || v < 0) return toast.error("Peso inválido");
                        }
                      } else v = e.target.value;
                      const prev = order[k] ?? (t === "number" ? null : "");
                      if (v !== prev) patch({ [k]: v }, `${l} actualizado`);
                    }} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* PROGRESO */}
      <div className="col-span-2 mt-2">
        <div className="flex justify-between mb-1"><Label>Progreso</Label><span className="text-xs font-mono text-amber-400">{progreso}%</span></div>
        <Slider value={[progreso]} max={100} step={5} disabled={busy}
          onValueChange={([v]) => setProgreso(v)}
          onValueCommit={([v]) => {
            clearTimeout(timer.current);
            timer.current = setTimeout(() => {
              if (v !== (orderRef.current.progreso ?? 0)) patch({ progreso: v }, `Progreso ${v}%`);
            }, 700);
          }} />
        <DeadlineProgressBar fecha_entrega={order.fecha_entrega} progreso={order.progreso} stage={order.stage} />
      </div>

      {/* BOTÓN FINAL (SOLO ADMIN/VENTAS) */}
      {staff && order.stage === "Terminado" && (
        <div className="col-span-2 mt-4">
          <button type="button" disabled={busy}
            onClick={() => patch({ stage: "Entregado" }, "Pedido entregado al cliente")}
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-40 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-5 h-5 animate-spin" />}
            Cerrar Orden y Entregar
          </button>
        </div>
      )}

      {dialog && (
        <MotivoDialog kind={dialog} order={order} suggestedTarget={suggestedTarget} busy={busy}
          onClose={() => setDialog(null)}
          onConfirm={dialog === "pausar" ? confirmarPausa : confirmarRepetir} />
      )}
    </div>
  );
};