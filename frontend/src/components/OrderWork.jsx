import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ORDER_TYPES, toISO, toLocalInput, apiError } from "@/lib/stages";
import { useFinishOrder } from "@/components/FinishOrderDialog";
import { DeadlineProgressBar } from "@/components/DeadlineProgressBar";
import {
  CheckCircle2, AlertTriangle, PauseCircle, PlayCircle, RotateCcw, Loader2, X, PackageCheck, Lock,
} from "lucide-react";

const Label = ({ children }) => (
  <div className="text-xs uppercase tracking-widest text-zinc-400 mb-1.5">{children}</div>
);

const IMPORT_STAGES = ["Comprada (USA)", "En Bodega USA", "En Vuelo a GT", "En Aduana (GT)", "Lista en Taller", "Entregada al Cliente"];
const DIGITAL_TYPES = ["Diseño", "Molde", "Diseño 3D"];
const isDigitalType = (t) => DIGITAL_TYPES.includes(t);

/* ============================================================
   RUTA DEL PEDIDO — única fuente de verdad.
   Se guarda en el pedido como nota [RUTA: a > b > c] (mismo
   mecanismo que la pausa, sin tocar backend). Si el backend
   algún día expone order.ruta (array), se usa primero.
   ============================================================ */
const CIERRE = ["Terminado", "Entregado"];

export const buildRoute = (tipo, esCastable) => {
  if (tipo === "Importación de máquinas") return [...IMPORT_STAGES];
  if (tipo === "Inyección") return ["Ventas", "Vulcanizado", "Inyección", "Casting", "Fabricación", ...CIERRE];
  if (tipo === "Vulcanizado") return esCastable
    ? ["Ventas", "Vulcanizado", "Inyección", "Casting", "Fabricación", ...CIERRE]
    : ["Ventas", "Vulcanizado", ...CIERRE];
  if (tipo === "Ceras") return esCastable
    ? ["Ventas", "Ceras", "Casting", "Fabricación", ...CIERRE]
    : ["Ventas", "Ceras", ...CIERRE]; // solo venta de ceras: termina al entregar
  if (isDigitalType(tipo)) return esCastable
    ? ["Ventas", "Diseño 3D", "Casting", "Fabricación", ...CIERRE] // fabricación: resina castable → fundición
    : ["Ventas", "Diseño 3D", ...CIERRE]; // solo entrega/venta del archivo o molde
  if (tipo === "Reparaciones") return ["Ventas", "Reparaciones", ...CIERRE];
  if (tipo === "Grabado Láser") return ["Ventas", "Grabado Láser", ...CIERRE];
  return ["Ventas", "Diseño 3D", "Ceras", "Casting", "Fabricación", ...CIERRE]; // Fabricación (default)
};

const parseRouteNota = (notas = "") => {
  const m = [...notas.matchAll(/\[RUTA:\s*([^\]]+)\]/g)].pop();
  if (!m) return null;
  const stages = m[1].split(">").map((s) => s.trim()).filter(Boolean);
  return stages.length >= 2 ? stages : null;
};

export const getOrderRoute = (order) => {
  if (order.tipo === "Importación de máquinas") return [...IMPORT_STAGES];
  if (Array.isArray(order.ruta) && order.ruta.length >= 2) return order.ruta;
  return parseRouteNota(order.notas) || buildRoute(order.tipo || "Fabricación", !!order.es_castable);
};

const routeNota = (route) => `[RUTA: ${route.join(" > ")}]`;

// Reescribe la última marca [RUTA: …] o la agrega si no existe.
export const upsertRouteNota = (notas = "", route) => {
  const matches = [...notas.matchAll(/\[RUTA:[^\]]*\]/g)];
  if (!matches.length) return [notas?.trimEnd(), routeNota(route)].filter(Boolean).join("\n");
  const last = matches[matches.length - 1];
  return notas.slice(0, last.index) + routeNota(route) + notas.slice(last.index + last[0].length);
};

// Siguiente etapa según la ruta guardada. "Entregado" (cierre total)
// NUNCA se devuelve aquí: eso es solo de admin/ventas.
const getNextStage = (order, route) => {
  const i = route.indexOf(order.stage);
  if (i === -1 || i >= route.length - 1) return null;
  const next = route[i + 1];
  return next === "Entregado" ? null : next;
};

// Origen al repetir: la ruta lo decide, no se elige a mano.
const getRepeatOrigin = (order, route) => {
  if (route.includes("Inyección")) return "Inyección"; // el molde ya existe: se reinyecta
  if (route.includes("Diseño 3D") && (isDigitalType(order.tipo) || order.es_castable)) return "Diseño 3D";
  if (route.includes("Ceras")) return "Ceras";
  return route.find((s) => s !== "Ventas") || route[0];
};

/* ============================================================
   PAUSA (derivada de notas, igual que antes)
   ============================================================ */
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

// Mini-mapa: ahora muestra la ruta REAL del pedido (sin ALT_SLOT).
const StageChain = ({ order, isImport, route }) => {
  const { chain, current, accent } = useMemo(() => {
    if (isImport) {
      return { chain: IMPORT_STAGES, current: IMPORT_STAGES.indexOf(order.import_status || IMPORT_STAGES[0]), accent: "blue" };
    }
    return { chain: route, current: route.indexOf(order.stage), accent: "gold" };
  }, [order.stage, order.import_status, isImport, route]);

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

// Diálogo de motivo. En "repetir" el destino está BLOQUEADO al origen de la ruta.
const MotivoDialog = ({ kind, order, fixedTarget, busy, onClose, onConfirm }) => {
  const [motivo, setMotivo] = useState("");
  const isPausa = kind === "pausar";

  useEffect(() => { setMotivo(""); }, [kind, fixedTarget]);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const confirmar = () => {
    const m = motivo.trim();
    if (!m || busy) return;
    onConfirm(m, fixedTarget);
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
                : "Registra qué pasó. La pieza regresa a su origen según la ruta del pedido."}
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
          <div className="mt-3 flex items-start gap-3 px-3 py-2.5 rounded-lg border border-[#c5a572]/40 bg-[#c5a572]/5" data-testid="repeat-origin">
            <Lock className="w-4 h-4 text-[#c5a572] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#c5a572]">Regresa a: {fixedTarget}</div>
              <div className="text-[11px] text-zinc-500">Lo define la ruta del pedido — no se elige a mano. Al marcar listo, recorre la misma ruta hacia adelante.</div>
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
            {isPausa ? "Pausar pedido" : `Enviar a ${fixedTarget}`}
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

  useEffect(() => { setProgreso(order.progreso ?? 0); }, [order.id, order.progreso]);
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
  const route = useMemo(() => getOrderRoute(order), [order.tipo, order.es_castable, order.notas, order.ruta]);
  const nextStage = isImport ? null : getNextStage(order, route);
  const repeatOrigin = useMemo(() => getRepeatOrigin(order, route), [order, route]);
  const pause = useMemo(() => getPauseInfo(order.notas || ""), [order.notas]);
  const closed = order.stage === "Entregado";

  const importIdx = IMPORT_STAGES.indexOf(order.import_status || IMPORT_STAGES[0]);
  const nextImport = importIdx >= 0 && importIdx < IMPORT_STAGES.length - 1 ? IMPORT_STAGES[importIdx + 1] : null;
  const canAdvanceImport = nextImport && (nextImport !== "Entregada al Cliente" || staff);
  // El trabajador NUNCA puede elegir "Entregada al Cliente" ni desde el select interno.
  const importOptions = IMPORT_STAGES.filter((s) =>
    staff || s !== "Entregada al Cliente" || s === (order.import_status || IMPORT_STAGES[0])
  );

  // Staff: el select solo ofrece la ruta de ESTE pedido (más la etapa actual si es un pedido viejo fuera de ruta).
  const routeOptions = route.includes(order.stage) ? route : [order.stage, ...route];

  const confirmarPausa = (motivo) => {
    setDialog(null);
    patch({ notas: appendNota(orderRef.current.notas, `[PAUSADO en ${orderRef.current.stage}]: ${motivo}`) }, "Pedido pausado y motivo guardado");
  };
  const confirmarRepetir = (motivo, target) => {
    setDialog(null);
    patch(
      { stage: target, progreso: 0, notas: appendNota(orderRef.current.notas, `[REPETIR]: ${motivo} (Regresó a ${target})`) },
      `Repetido: enviado a ${target}`
    );
  };
  const reanudar = () =>
    patch({ notas: appendNota(orderRef.current.notas, `[REANUDADO en ${orderRef.current.stage}]`) }, "Trabajo reanudado");

  // Al cambiar tipo o castable, la ruta se recalcula y se reescribe en el pedido.
  const changeTipo = (tipo) => {
    const r = buildRoute(tipo, !!orderRef.current.es_castable);
    patch({ tipo, notas: upsertRouteNota(orderRef.current.notas, r) }, `Tipo: ${tipo} · ruta actualizada`);
  };
  const changeCastable = (v) => {
    const r = buildRoute(orderRef.current.tipo || "Fabricación", v);
    patch({ es_castable: v, notas: upsertRouteNota(orderRef.current.notas, r) }, `Castable: ${v ? "Sí" : "No"} · ruta actualizada`);
  };

  const selectCls = "flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c5a572] disabled:opacity-50";

  return (
    <div className="grid grid-cols-2 gap-3" data-testid="order-work">

      <StageChain order={order} isImport={isImport} route={route} />

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
            className={selectCls} data-testid="staff-stage-select">
            {routeOptions.map((s) => (
              <option key={s} value={s}>
                {s}{s === nextStage ? " → siguiente" : ""}{s === "Entregado" ? " (cierre: solo admin/ventas)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="h-9 flex items-center px-3 rounded-md bg-zinc-900/50 border border-zinc-800 text-sm text-[#c5a572] font-bold">
            {order.stage}
          </div>
        )}
        {staff && !isImport && (
          <p className="text-[10px] text-zinc-600 mt-1">Solo se muestran las etapas de la ruta de este pedido.</p>
        )}
      </div>

      {/* AVANCE DE CADENA (trabajadores) — según la ruta guardada */}
      {!staff && !isImport && nextStage && (
        <div className="col-span-2 mt-1">
          <button type="button" disabled={busy || pause.paused}
            title={pause.paused ? "Reanuda el pedido para poder avanzarlo" : undefined}
            onClick={() => patch({ stage: nextStage, progreso: 0 }, `¡Trabajo terminado! Enviado a ${nextStage}`)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="btn-advance">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Terminar y enviar a {nextStage}
          </button>
        </div>
      )}

      {/* TERMINADO: el trabajador ya no puede hacer nada; el cierre es de admin/ventas */}
      {!staff && !isImport && order.stage === "Terminado" && (
        <div className="col-span-2 flex items-center gap-2 text-[11px] text-zinc-500 bg-zinc-900/40 border border-white/5 rounded-lg px-3 py-2">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          Pieza terminada. El cierre y la entrega los hace únicamente Ventas / Admin.
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

      {/* PAUSA / REPETIR (trabajadores) — nunca en una orden cerrada */}
      {!staff && !isImport && !closed && (
        <div className="col-span-2 grid grid-cols-2 gap-2 mt-1">
          {!pause.paused && order.stage !== "Terminado" && (
            <button type="button" onClick={() => setDialog("pausar")} disabled={busy}
              className="w-full bg-amber-950/40 border border-amber-900/50 text-amber-400 font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-amber-950/70 disabled:opacity-40"
              data-testid="btn-pause">
              <PauseCircle className="w-4 h-4" /> Pausar / Falta Mat.
            </button>
          )}
          <button type="button" onClick={() => setDialog("repetir")} disabled={busy}
            className={`${pause.paused || order.stage === "Terminado" ? "col-span-2" : ""} w-full bg-red-950/40 border border-red-900/50 text-red-400 font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-red-950/70 disabled:opacity-40`}
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
            {importOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {!staff && <p className="text-[10px] text-blue-300/50 mt-1">La entrega al cliente solo la marca Ventas / Admin.</p>}
        </div>
      )}

      {/* TIPO DE TRABAJO Y CASTABLE (Solo Admin/Ventas) — reescriben la ruta */}
      {staff && !isImport && (
        <div className="col-span-2 grid grid-cols-2 gap-3 bg-zinc-900/30 p-3 rounded-lg border border-white/5 mt-2">
          <div>
            <Label>Tipo de trabajo</Label>
            <select value={order.tipo || "Fabricación"} disabled={busy}
              onChange={(e) => changeTipo(e.target.value)}
              className={selectCls}>
              {ORDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>¿Es Castable? (Fundición)</Label>
            <label className="flex items-center gap-2 h-9 cursor-pointer">
              <input type="checkbox" checked={order.es_castable || false} disabled={busy}
                onChange={(e) => changeCastable(e.target.checked)}
                className="w-5 h-5 accent-[#c5a572] rounded border-zinc-800" />
              <span className="text-sm text-zinc-300">Requiere fundición</span>
            </label>
          </div>
          <p className="col-span-2 text-[10px] text-zinc-600 -mt-1">Cambiar esto recalcula y guarda la ruta del pedido.</p>
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
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-40 flex items-center justify-center gap-2"
            data-testid="btn-close-order">
            {busy && <Loader2 className="w-5 h-5 animate-spin" />}
            Cerrar Orden y Entregar
          </button>
        </div>
      )}

      {dialog && (
        <MotivoDialog kind={dialog} order={order} fixedTarget={repeatOrigin} busy={busy}
          onClose={() => setDialog(null)}
          onConfirm={dialog === "pausar" ? confirmarPausa : confirmarRepetir} />
      )}
    </div>
  );
};