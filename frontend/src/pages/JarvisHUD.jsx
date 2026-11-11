import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Send, Mic, Volume2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { api, API } from "@/lib/api";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition"; 

export default function JarvisHUD() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [state, setState] = useState("idle"); 
  const [voiceOn, setVoiceOn] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const speech = useSpeechRecognition();
  
  const endRef = useRef(null);
  const handsFreeRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state]);

  const unlockAudio = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  };

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    speech.stop(); 
    
    if (!voiceOn) {
      setState("idle"); 
      if (handsFreeRef.current) setTimeout(() => { if(handsFreeRef.current) listen(); }, 1000);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-MX"; 
    utterance.rate = 1.0; 
    
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang.includes("es"));
    if (spanishVoice) utterance.voice = spanishVoice;

    utterance.onstart = () => setState("speaking");
    utterance.onend = () => {
      setState("idle");
      if (handsFreeRef.current) setTimeout(() => { if(handsFreeRef.current) listen(); }, 1500);
    };
    utterance.onerror = () => {
      setState("idle");
      if (handsFreeRef.current) setTimeout(() => { if(handsFreeRef.current) listen(); }, 1500);
    };

    window.speechSynthesis.speak(utterance);
  };

  const listen = () => {
    if (state === "thinking" || state === "speaking") return;
    unlockAudio();
    if (speech.listening) { speech.stop(); return; }
    speech.start((textoDictado) => {
      setInput(textoDictado);
      setTimeout(() => { send(null, textoDictado); }, 500);
    });
  };

  const send = async (e, overrideText = null) => {
    if (e) e.preventDefault();
    const text = (overrideText || input).trim();
    if (!text || state === "thinking") return;

    setInput("");
    speech.stop();

    const userMsg = { id: Date.now().toString(), role: "user", content: text };
    const replyId = (Date.now() + 1).toString();
    const replyMsg = { id: replyId, role: "assistant", content: "" };

    setMessages((m) => [...m, userMsg, replyMsg]);
    setState("thinking");

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("access_token") || localStorage.getItem("jarvis_token");
      
      const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message: text, session_id: "default" })
      });

      if (!response.ok) throw new Error("Error en la respuesta del servidor");
      if (!response.body) throw new Error("No stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || ""; 

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            try {
              const data = JSON.parse(part.slice(6));
              if (data.type === "delta") {
                acc += data.content;
                setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: acc } : x)));
              } else if (data.type === "image") {
                const imgMsg = { id: Date.now().toString(), role: "assistant", type: "image", content: data.url };
                setMessages((m) => [...m, imgMsg]);
              }
            } catch (err) {}
          }
        }
      }
      
      if (acc) speak(acc);
      setState("idle");

    } catch (err) {
      toast.error("Error al comunicarse con Jarvis");
      setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: "Disculpe, perdí la conexión." } : x)));
      setState("idle");
    }
  };

  const orbState = speech.listening ? "listening" : state;
  const isActive = orbState !== "idle"; // <-- ARREGLADO AQUÍ: Evita el pantallazo negro

  return (
    <div className="h-[100dvh] flex flex-col lg:flex-row bg-[#09090b] overflow-hidden relative">
      
      {/* CSS MÁGICO PARA LA ANIMACIÓN DEL REACTOR */}
      <style>{`
        @keyframes spin-slow { 100% { transform: rotate(360deg); } }
        @keyframes spin-reverse { 100% { transform: rotate(-360deg); } }
        @keyframes pulse-glow { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        
        .reactor-outer { animation: spin-slow 8s linear infinite; }
        .reactor-inner { animation: spin-reverse 6s linear infinite; }
        .reactor-core { animation: pulse-glow 2s ease-in-out infinite; }
        
        .reactor-idle .reactor-outer { animation-play-state: paused; border-color: #3f3f46; }
        .reactor-idle .reactor-inner { animation-play-state: paused; border-color: #27272a; }
        .reactor-idle .reactor-core { animation-play-state: paused; background-color: #52525b; box-shadow: none; }
      `}</style>

      {/* HUD DE FONDO (Líneas de escaneo) */}
      <div className="absolute inset-0 pointer-events-none opacity-10" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34, 211, 238, 0.2) 2px, rgba(34, 211, 238, 0.2) 4px)"
      }} />

      {/* PANEL IZQUIERDO / SUPERIOR (REACTOR) */}
      <section className="lg:w-[400px] shrink-0 flex flex-col items-center justify-center py-6 lg:py-8 lg:border-r border-white/5 relative z-10 bg-zinc-950/50 backdrop-blur-sm">
        
        {/* ENCABEZADO */}
        <div className="text-center flex flex-col items-center mb-6">
          <h1 className="font-display text-3xl md:text-4xl font-light tracking-[0.3em] text-cyan-400 mb-2">J.A.R.V.I.S.</h1>
          <div className="flex items-center gap-2 bg-cyan-950/50 border border-cyan-800/50 px-4 py-1 rounded-full">
            <span className={`w-2 h-2 rounded-full ${state === "thinking" ? "bg-yellow-500 animate-pulse" : isActive ? "bg-cyan-400 animate-ping" : "bg-emerald-500"}`} />
            <span className="text-[10px] font-mono tracking-widest text-cyan-300">
              {state === "thinking" ? "PROCESANDO..." : isActive ? "ESCUCHANDO..." : "EN LÍNEA"}
            </span>
          </div>
        </div>

        {/* REACTOR ARC AZUL (HECHO 100% EN CSS PARA QUE NO FALLE) */}
        <div 
          className={`relative flex items-center justify-center cursor-pointer my-6 ${!isActive ? 'reactor-idle' : ''}`} 
          onClick={listen}
        >
          {/* Anillo exterior giratorio */}
          <div className={`reactor-outer absolute w-[180px] h-[180px] md:w-[240px] md:h-[240px] rounded-full border-[2px] border-dashed transition-colors duration-500 ${isActive ? 'border-cyan-400' : ''}`} />
          
          {/* Anillo interior girando al revés */}
          <div className={`reactor-inner absolute w-[140px] h-[140px] md:w-[190px] md:h-[190px] rounded-full border-[3px] transition-colors duration-500 ${isActive ? 'border-cyan-500 shadow-[0_0_30px_rgba(34,211,238,0.5)]' : ''}`} />
          
          {/* Centro del reactor */}
          <div className="w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center bg-cyan-950/40 shadow-[inset_0_0_20px_rgba(34,211,238,0.8)] z-10">
             <div className={`reactor-core w-10 h-10 md:w-16 md:h-16 rounded-full transition-all duration-500 ${isActive ? 'bg-cyan-300 shadow-[0_0_40px_rgba(34,211,238,1)]' : ''}`} />
          </div>
        </div>
        
        {/* INTERRUPTORES SEPARADOS */}
        <div className="flex flex-col gap-4 w-64 text-sm text-zinc-400 mt-4 bg-zinc-900/60 p-4 rounded-2xl border border-white/5 shadow-xl">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="flex items-center gap-2"><Volume2 className="w-4 h-4 text-cyan-400" /> Respuesta por voz</span>
            <Switch checked={voiceOn} onCheckedChange={setVoiceOn} />
          </label>
          <div className="h-px w-full bg-white/5"></div>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="flex items-center gap-2"><Mic className="w-4 h-4 text-cyan-400" /> Manos libres</span>
            <Switch checked={handsFree} onCheckedChange={(v) => { setHandsFree(v); handsFreeRef.current = v; }} />
          </label>
        </div>
      </section>

      {/* PANEL DERECHO / INFERIOR (CHAT) */}
      <section className="flex-1 flex flex-col min-h-0 relative z-10">
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6" aria-live="polite">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.length === 0 && (
              <div className="text-center text-zinc-500 mt-10">
                <p className="text-lg text-cyan-400/70 mb-2">Hola, señor. ¿En qué puedo asistirle hoy?</p>
                <p className="text-sm">Prueba diciendo: "Jarvis, abre el historial" o "Jarvis, ¿cuántos pedidos hay?"</p>
              </div>
            )}
            
            {messages.map((m, i) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.type === "image" ? (
                  <div className="bg-zinc-900/80 border border-cyan-500/30 rounded-2xl p-2 max-w-[85%] shadow-lg shadow-cyan-900/20">
                    <div className="text-xs text-cyan-400 mb-2 flex items-center gap-2 font-sans">
                      <ImageIcon className="w-4 h-4" /> Diseño generado
                    </div>
                    <img src={m.content} alt="Diseño" className="rounded-xl w-full object-cover shadow-md" />
                  </div>
                ) : (
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-cyan-600 text-white font-medium font-sans shadow-lg shadow-cyan-900/30" : "bg-zinc-900/80 border border-cyan-900/50 text-zinc-200 font-mono"}`}>
                    {m.content || (state === "thinking" && i === messages.length - 1 ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : "")}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>
        
        {/* INPUT DE TEXTO */}
        <div className="p-4 border-t border-white/5 bg-zinc-950/80 backdrop-blur-md pb-safe">
          <form onSubmit={send} className="max-w-3xl mx-auto flex gap-2">
            <Button type="button" variant="outline" size="icon" onClick={listen} className={`h-11 w-11 md:h-12 md:w-12 shrink-0 bg-zinc-900 border-zinc-800 ${speech.listening ? 'text-red-500 border-red-500 animate-pulse' : 'text-cyan-400'}`}>
              <Mic className="w-4 h-4" />
            </Button>
            <Input 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder={speech.listening ? "Escuchando..." : "Escribe o habla..."} 
              className="bg-zinc-900 border-zinc-800 h-11 md:h-12 text-sm font-sans focus-visible:ring-cyan-500" 
              disabled={state === "thinking"} 
            />
            <Button type="submit" disabled={state === "thinking" || !input.trim()} className="h-11 w-11 md:h-12 md:w-12 shrink-0 bg-cyan-600 hover:bg-cyan-500 text-white font-medium">
              {state === "thinking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}