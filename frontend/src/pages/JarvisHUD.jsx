import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Send, Mic, Volume2, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { ArcReactor } from "@/components/ArcReactor";
import { api, API } from "@/lib/api";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition"; 

export default function JarvisHUD({ onClose }) {
  const navigate = useNavigate();
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
              } 
              else if (data.type === "navigate") {
                toast.success(`Abriendo pantalla...`);
                setTimeout(() => {
                  if (onClose) onClose(); // Cerramos el chat flotante
                  navigate(data.path);
                }, 1500); 
              }
              else if (data.type === "image") {
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

  return (
    <div className="h-full flex flex-col bg-zinc-950 rounded-2xl overflow-hidden relative">
      {/* BOTÓN DE CERRAR (Solo si estamos en modo ventana flotante) */}
      {onClose && (
        <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-zinc-800/80 hover:bg-red-500/80 rounded-full text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      )}

      <section className="shrink-0 flex flex-col items-center justify-center gap-3 py-6 border-b border-white/5 bg-gradient-to-b from-[#111] to-zinc-950">
        <div className="text-center flex flex-col items-center">
          <h1 className="font-display text-2xl font-light tracking-[0.3em] text-gold-gradient mb-2">J.A.R.V.I.S.</h1>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
            <span className={`w-2 h-2 rounded-full ${state === "thinking" ? "bg-yellow-500 animate-pulse" : "bg-emerald-500"}`} />
            <span className="text-[10px] font-mono tracking-widest text-zinc-400">
              {state === "thinking" ? "PROCESANDO..." : "EN LÍNEA"}
            </span>
          </div>
        </div>

        <ArcReactor state={orbState} onClick={listen} size={window.innerWidth < 1024 ? 90 : 120} />
        
        <div className="flex gap-4 text-xs text-zinc-400 bg-zinc-900/50 px-4 py-2 rounded-xl">
          <label className="flex items-center gap-2 cursor-pointer">
            <span>Voz</span>
            <Switch checked={voiceOn} onCheckedChange={setVoiceOn} className="scale-75" />
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <span>Manos libres</span>
            <Switch checked={handsFree} onCheckedChange={(v) => { setHandsFree(v); handsFreeRef.current = v; }} className="scale-75" />
          </label>
        </div>
      </section>

      <section className="flex-1 flex flex-col min-h-0 bg-black/40">
        <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-zinc-500 text-sm mt-10">
                <p>Hola, señor. ¿En qué puedo asistirle hoy?</p>
                <p className="text-xs mt-2">Prueba diciendo: "Jarvis, abre el historial" o "Jarvis, ¿cuántos pedidos hay?"</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.type === "image" ? (
                  <div className="bg-zinc-900/60 border border-[#c5a572]/30 rounded-2xl p-2 max-w-[85%] shadow-lg">
                    <div className="text-xs text-[#c5a572] mb-2 flex items-center gap-2 font-sans">
                      <ImageIcon className="w-4 h-4" /> Diseño
                    </div>
                    <img src={m.content} alt="Diseño" className="rounded-xl w-full object-cover shadow-md" />
                  </div>
                ) : (
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-[#c5a572] text-black font-medium font-sans" : "bg-zinc-800 border-zinc-700 text-zinc-200 font-mono"}`}>
                    {m.content || (state === "thinking" && i === messages.length - 1 ? <Loader2 className="w-4 h-4 animate-spin text-[#c5a572]" /> : "")}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>
        
        <div className="p-3 border-t border-white/5 bg-zinc-950 pb-safe">
          <form onSubmit={send} className="flex gap-2">
            <Button type="button" variant="outline" size="icon" onClick={listen} className={`h-10 w-10 shrink-0 bg-zinc-900 border-zinc-800 ${speech.listening ? 'text-red-500 border-red-500 animate-pulse' : 'text-zinc-400'}`}>
              <Mic className="w-4 h-4" />
            </Button>
            <Input 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder="Escribe o habla..." 
              className="bg-zinc-900 border-zinc-800 h-10 text-sm font-sans" 
              disabled={state === "thinking"} 
            />
            <Button type="submit" disabled={state === "thinking" || !input.trim()} className="h-10 w-10 shrink-0 bg-[#c5a572] hover:bg-[#b08d5b] text-black font-medium">
              {state === "thinking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}