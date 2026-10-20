const LABELS = { idle: "En línea", listening: "Escuchando...", thinking: "Procesando...", speaking: "Hablando" };

export const ArcReactor = ({ state = "idle", onClick, size = 220 }) => (
  <button onClick={onClick} className={`arc-reactor arc-${state} relative rounded-full focus:outline-none`}
    style={{ width: size, height: size }} data-testid="jarvis-orb" aria-label="Hablar con Jarvis">
    <span className="arc-ring arc-ring-1" />
    <span className="arc-ring arc-ring-2" />
    <span className="arc-ring arc-ring-3" />
    <span className="arc-core" />
    <span className="absolute -bottom-9 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.35em] text-cyan-300/80 whitespace-nowrap" data-testid="jarvis-state">
      {LABELS[state]}
    </span>
  </button>
);
