import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom"; // <-- IMPORTANTE: Usamos Link para el botón Volver
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Send, Mic, Volume2, Image as ImageIcon, ChevronLeft } from "lucide-react";
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

  const isActive = speech.listening || state === "thinking" || state === "speaking";

  const IronManReactor = () => {
    return (
      <div className="relative flex items-center justify-center cursor-pointer group" onClick={listen}>
        <div className={`absolute w-28 h-28 md:w-40 md:h-40 rounded-full blur-2xl transition-all duration-700 ${isActive ? 'bg-cyan-500/40' : 'bg-cyan-900/10'}`} />
        <div className={`absolute w-28 h-28 md:w-40 md:h-40 rounded-full border-[2px] border-transparent border-t-cyan-400 border-b-cyan-400 transition-all duration-500 ${isActive ? 'animate-[spin_2s_linear_infinite] opacity-100' : 'animate-[spin_10s_linear_infinite] opacity-40'}`} />
        <div className={`absolute w-20 h-20 md:w-32 md:h-32 rounded-full border-[3px] border-zinc-800 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] ${isActive ? 'animate-[spin_3s_linear_infinite_reverse]' : 'animate-[spin_15s_linear_infinite_reverse]'}`}>
           <div className="absolute inset-0 rounded-full border-[1px] border-cyan-600/20 m-1" />
        </div>
        <div className={`relative w-14 h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center bg-zinc-900 border-2 border-zinc-700 shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all duration-300 ${isActive ? 'shadow-[0_0_50px_rgba(34,211,238,0.8)] scale-110' : ''}`}>
           <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-cyan-300 shadow-[0_0_30px_rgba(255,255,255,0.9)]' : 'bg-cyan-800/50'} `}>
              <div className="w-5 h-5 md:w-8 md:h-8 bg-white rounded-full opacity-90 blur-[1px]" />
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-hidden font-sans">
      
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes spin-reverse { 100% { transform: rotate(-360deg); } }
      `}</style>

      {/* BARRA SUPERIOR CON BOTÓN VOLVER (AHORA ES UN LINK SEGURO) */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md shrink-0 z-50 relative">
        <Link 
          to="/" 
          className="flex items-center gap-1 text-zinc-400 hover:text-cyan-400 bg-white/5 px-4 py-2 rounded-full transition-colors active:bg-white/20 border border-white/10"
        >
          <ChevronLeft className="w-4 h-4" /> Volver
        </Link>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${state === "thinking" ? "bg-amber-400 animate-pulse" : isActive ? "bg-cyan-400 animate-ping" : "bg-emerald-500"}`} />
          <span className="text-[10px] font-mono tracking-widest text-cyan-300 font-bold uppercase">
            {state === "thinking" ? "Procesando" : isActive ? "Escuchando" : "En Línea"}
          </span>
        </div>
      </div>

      {/* ZONA DEL REACTOR */}
      <div className="flex flex-col items-center pt-6 pb-4 border-b border-white/5 shrink-0 bg-gradient-to-b from-zinc-950 to-[#050505]">
        <IronManReactor />
        
        <div className="flex flex-row gap-3 mt-6 w-[90%] max-w-[320px] bg-zinc-900/50 p-2 rounded-xl border border-white/5">
          <label className="flex-1 flex items-center justify-between cursor-pointer bg-black/40 px-2 py-1.5 rounded-lg border border-white/5">
            <span className="flex items-center gap-1 text-[10px] text-zinc-300 font-medium"><Volume2 className="w-3 h-3 text-cyan-400" /> Voz</span>
            <Switch checked={voiceOn} onCheckedChange={setVoiceOn} className="scale-[0.7]" />
          </label>
          <label className="flex-1 flex items-center justify-between cursor-pointer bg-black/40 px-2 py-1.5 rounded-lg border border-white/5">
            <span className="flex items-center gap-1 text-[10px] text-zinc-300 font-medium"><Mic className="w-3 h-3 text-cyan-400" /> Manos libres</span>
            <Switch checked={handsFree} onCheckedChange={(v) => { setHandsFree(v); handsFreeRef.current = v; }} className="scale-[0.7]" />
          </label>
        </div>
      </div>

      {/* CHAT */}
      <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-zinc-500 mt-4 flex flex-col items-center justify-center">
              <p className="text-sm text-cyan-400/80 mb-1 font-mono">Sistemas en línea, señor.</p>
              <p className="text-xs max-w-xs mx-auto">Toca el reactor para hablar o escribe un comando abajo.</p>
            </div>
          )}
          
          {messages.map((m, i) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.type === "image" ? (
                <div className="bg-zinc-900/80 border border-cyan-500/30 rounded-2xl p-2 max-w-[85%] shadow-lg shadow-cyan-900/20">
                  <div className="text-[10px] text-cyan-400 mb-1 flex items-center gap-1 font-sans font-bold uppercase tracking-wider">
                    <ImageIcon className="w-3 h-3" /> Imagen
                  </div>
                  <img src={m.content} alt="Diseño" className="rounded-xl w-full object-cover shadow-md" />
                </div>
              ) : (
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap shadow-lg ${m.role === "user" ? "bg-cyan-600 text-white font-medium font-sans rounded-tr-sm" : "bg-[#111] border border-cyan-900/50 text-cyan-50 font-mono rounded-tl-sm"}`}>
                  {m.content || (state === "thinking" && i === messages.length - 1 ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : "")}
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
      
      {/* INPUT */}
      <div className="p-3 bg-black shrink-0">
        <form onSubmit={send} className="max-w-3xl mx-auto flex gap-2 bg-zinc-900/90 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-2xl">
          <Button type="button" variant="ghost" size="icon" onClick={listen} className={`h-9 w-9 shrink-0 rounded-xl ${speech.listening ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-cyan-400 hover:bg-cyan-900/30'}`}>
            <Mic className="w-4 h-4" />
          </Button>
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={speech.listening ? "Escuchando..." : "Escribe o habla..."} 
            className="bg-transparent border-none h-9 text-sm font-sans focus-visible:ring-0 text-white placeholder:text-zinc-500" 
            disabled={state === "thinking"} 
          />
          <Button type="submit" disabled={state === "thinking" || !input.trim()} className="h-9 w-9 shrink-0 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors">
            {state === "thinking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}