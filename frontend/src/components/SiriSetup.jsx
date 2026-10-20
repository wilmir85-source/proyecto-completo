import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, RefreshCw, Mic, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const TZ = !BROWSER_TZ || BROWSER_TZ === "UTC" ? "America/Mexico_City" : BROWSER_TZ;

const EXAMPLES = [
  ["Crear pedido rápido", "Pedido rápido para María López, anillo de compromiso en oro 14k"],
  ["Mover a Terminado", "Mueve el pedido de María López a Terminado"],
  ["Estado de un pedido", "¿Cómo va el pedido de María López?"],
];

const Copyable = ({ label, value, testid }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{label}</div>
    <div className="flex gap-2">
      <code className="flex-1 text-[11px] text-cyan-200 break-all bg-zinc-950 rounded-lg px-3 py-2 border border-white/5" data-testid={testid}>{value || "Cargando..."}</code>
      <Button size="icon" variant="outline" className="border-zinc-700 shrink-0" disabled={!value} data-testid={`${testid}-copy`}
        onClick={() => navigator.clipboard.writeText(value).then(() => toast.success(`${label} copiado`))}><Copy className="w-4 h-4" /></Button>
    </div>
  </div>
);

const Step = ({ n, title, children }) => (
  <li className="flex gap-3">
    <span className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs flex items-center justify-center shrink-0">{n}</span>
    <div className="text-sm text-zinc-300 space-y-1"><div className="font-medium text-zinc-100">{title}</div>{children}</div>
  </li>
);

const Tester = ({ siriKey, url }) => {
  const [texto, setTexto] = useState(EXAMPLES[2][1]);
  const [resp, setResp] = useState("");
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true); setResp("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: siriKey, texto, tz: TZ }) });
      setResp(await r.text());
    } catch { setResp("Error de conexión"); }
    setLoading(false);
  };
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950/60 p-4 space-y-3" data-testid="siri-tester">
      <div className="text-xs uppercase tracking-widest text-zinc-500">Probar como si fuera Siri</div>
      <div className="flex gap-2">
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} className="bg-zinc-900 border-zinc-800" data-testid="siri-test-input" />
        <Button onClick={run} disabled={loading || !siriKey} className="bg-cyan-600 hover:bg-cyan-500 text-black shrink-0" data-testid="siri-test-run">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        </Button>
      </div>
      {resp && <p className="text-sm text-cyan-100 italic" data-testid="siri-test-response">“{resp}”</p>}
    </div>
  );
};

export const SiriSetup = () => {
  const [key, setKey] = useState("");
  const url = `${process.env.REACT_APP_BACKEND_URL}/api/siri`;
  useEffect(() => { api.get("/me/siri").then((r) => setKey(r.data.key)); }, []);
  const regenerate = async () => {
    if (!window.confirm("Tu atajo actual dejará de funcionar hasta que pegues la nueva clave. ¿Continuar?")) return;
    setKey((await api.post("/me/siri/regenerate")).data.key);
    toast.success("Nueva clave generada");
  };

  return (
    <div className="card-glass rounded-2xl p-6 mb-6 border border-cyan-500/20" data-testid="siri-card">
      <div className="flex items-center gap-3 mb-2">
        <Mic className="w-6 h-6 text-cyan-400" />
        <h2 className="font-display text-xl">“Oye Siri, Jarvis”</h2>
      </div>
      <p className="text-sm text-zinc-400 mb-5">Atajo de Apple para hablarle a Jarvis sin abrir la app, incluso con el iPhone bloqueado, en el carro o con AirPods. Cada persona usa su propia clave y Jarvis respeta su rol.</p>
      <div className="space-y-3 mb-6">
        <Copyable label="URL" value={url} testid="siri-url" />
        <Copyable label="Tu clave personal" value={key} testid="siri-key" />
        <button onClick={regenerate} className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1" data-testid="siri-regenerate"><RefreshCw className="w-3 h-3" />Generar nueva clave (si la perdiste o alguien más la vio)</button>
      </div>
      <ol className="space-y-5 mb-6">
        <Step n={1} title="Crea el atajo">Abre la app <b>Atajos</b> → pestaña <b>Atajos</b> → botón <b>+</b> arriba a la derecha.</Step>
        <Step n={2} title="Ponle nombre “Jarvis”">Toca el nombre arriba → <b>Renombrar</b> → escribe <b>Jarvis</b>. Ese nombre es la frase para Siri.</Step>
        <Step n={3} title="Acción: Dictar texto">Toca <b>Agregar acción</b>, busca <b>“Dictar texto”</b> y agrégala. Toca <b>Idioma</b> → <b>Español</b>. En <b>Dejar de escuchar</b> elige <b>“Tras una pausa”</b>.</Step>
        <Step n={4} title="Acción: Obtener contenido de URL">Busca <b>“Obtener contenido de URL”</b> y agrégala. En la URL pega la <b>URL</b> de arriba. Toca la flecha <b>›</b> para ver más opciones:
          <ul className="list-disc ml-5 text-zinc-400 text-xs space-y-1 mt-1">
            <li><b>Método:</b> POST</li>
            <li><b>Cuerpo de la solicitud:</b> JSON</li>
            <li>Toca <b>Agregar campo nuevo → Texto</b>. Clave: <code className="text-cyan-300">key</code>. Valor: pega <b>tu clave personal</b>.</li>
            <li>Otro campo <b>Texto</b>. Clave: <code className="text-cyan-300">texto</code>. Valor: toca el campo y elige la variable azul <b>“Texto dictado”</b>.</li>
            <li>Opcional, otro campo <b>Texto</b>. Clave: <code className="text-cyan-300">tz</code>. Valor: <code className="text-cyan-300">{TZ}</code></li>
          </ul>
        </Step>
        <Step n={5} title="Acción: Leer texto">Busca <b>“Leer texto”</b> (o “Decir texto”) y agrégala. Su entrada debe ser <b>“Contenido de la URL”</b>. Toca la flecha <b>›</b> → <b>Idioma: Español</b>.</Step>
        <Step n={6} title="Pruébalo">Toca <b>OK</b>. Di <b>“Oye Siri, Jarvis”</b>, espera el tono y dicta tu orden. La primera vez iOS te pedirá permiso para conectarse: elige <b>Permitir siempre</b>.</Step>
      </ol>
      <div className="mb-5">
        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Cosas que puedes decir</div>
        <div className="space-y-2">
          {EXAMPLES.map(([t, e]) => (
            <div key={t} className="text-sm"><span className="text-cyan-300">{t}:</span> <span className="text-zinc-300 italic">“{e}”</span></div>
          ))}
          <div className="text-xs text-zinc-500">También puedes pedir abonos, recordatorios, el informe del día o lo que sepas de un cliente.</div>
        </div>
      </div>
      <Tester siriKey={key} url={url} />
    </div>
  );
};
