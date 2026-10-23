import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Send, Mic } from "lucide-react";
import { toast } from "sonner";
import { ArcReactor } from "@/components/ArcReactor";
import { api, API } from "@/lib/api";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition"; 

const MARK = "|||"; 
const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

export default function JarvisHUD() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [state, setState] = useState("idle");
  const [voiceOn, setVoiceOn] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const speech = useSpeechRecognition();
  const [voice, setVoice] = useState("alloy");
  
  const endRef = useRef(null);
  const audioRef = useRef(null);
  const handsFreeRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state]);

  const listen = () => {
    if (state === "thinking") return;
    
    // Si ya está escuchando, detenemos la grabación
    if (speech.listening) {
      speech.stop();
      return;
    }

    // Si no, empezamos a grabar y le decimos qué hacer con el texto
    speech.start((textoDictado) => {
      setInput(textoDictado);
      toast.success("¡Texto dictado!");
    });
  };

  const send = async (e) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || state === "thinking") return;

    setInput("");
    const userMsg = { id: Date.now().toString(), role: "user", content: text };
    const replyId = (Date.now() + 1).toString();
    const replyMsg = { id: replyId, role: "assistant", content: "" };

    setMessages((m) => [...m, userMsg, replyMsg]);
    setState("thinking");

    try {
      const token = localStorage.getItem("jarvis_token");
      
      // Temporizador de seguridad para que no se quede trabado
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message: text, session_id: "default" }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.body) throw new Error("No stream");

      const textResponse = await response.text();
      let acc = "";
      
      const lines = textResponse.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "delta") {
              acc += data.content;
            }
          } catch (err) {}
        }
      }
      
      setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: acc } : x)));

    } catch (err) {
      if (err.name === 'AbortError') {
        toast.error("Jarvis tardó mucho en responder (el servidor está despertando). Intenta de nuevo.");
        setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: "Disculpe, el servidor se está despertando. Intente de nuevo." } : x)));
      } else {
        toast.error("Error al comunicarse con Jarvis");
        setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: "Disculpe, perdí la conexión." } : x)));
      }
    } finally {
      setState("idle");
      if (handsFreeRef.current) listen();
    }
  };

  const orbState = speech.listening ? "listening" : state;

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col lg:flex-row jarvis-hud">
      <audio ref={audioRef} className="hidden" playsInline />
      <section className="lg:w-[420px] shrink-0 flex flex-col items-center justify-center gap-10 py-8 lg:border-r border-white/5 relative">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.5em] text-cyan-400/70">Just A Rather Very Intelligent System</div>
          <h1 className="font-display text-4xl font-light tracking-[0.3em] mt-2 text-cyan-100">J.A.R.V.I.S.</h1>
        </div>
        <ArcReactor state={orbState} onClick={listen} size={window.innerWidth < 1024 ? 150 : 220} />
        <div className="flex flex-col gap-3 w-64 mt-4 text-xs text-zinc-400">
          <label className="flex items-center justify-between">Respuesta por voz <Switch checked={voiceOn} onCheckedChange={setVoiceOn} data-testid="toggle-voice" /></label>
          <label className="flex items-center justify-between">Manos libres <Switch checked={handsFree} onCheckedChange={(v) => { setHandsFree(v); handsFreeRef.current = v; }} data-testid="toggle-handsfree" /></label>
        </div>
      </section>

      <section className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto px-5 md:px-8 py-6" data-testid="chat-messages" aria-live="polite">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((m, i) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-amber-600 text-black" : "card-glass border-cyan-500/15 text-zinc-200"}`} data-testid={`msg-${m.role}-${i}`}>
                  {m.content || (state === "thinking" && i === messages.length - 1 ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : "")}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>
        <div className="p-4 border-t border-white/5">
          <form onSubmit={send} className="max-w-3xl mx-auto flex gap-2">
            <Button type="button" variant="outline" size="icon" onClick={listen} className={`h-12 w-12 bg-zinc-950 border-zinc-800 ${speech.listening ? 'text-red-500 border-red-500 animate-pulse' : ''}`} data-testid="chat-mic">
              <Mic className="w-4 h-4" />
            </Button>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={speech.listening ? "Escuchando..." : "Escriba a Jarvis..."} className="bg-zinc-950 border-zinc-800 h-12 text-sm" disabled={state === "thinking"} data-testid="chat-input" />
            <Button type="submit" disabled={state === "thinking" || !input.trim()} className="h-12 bg-cyan-600 hover:bg-cyan-500 text-black" data-testid="chat-send">
              {state === "thinking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}