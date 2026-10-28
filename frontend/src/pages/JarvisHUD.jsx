import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Send, Mic, Volume2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { ArcReactor } from "@/components/ArcReactor";
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
    setMessages((m) => [...m, userMsg]);
    
    // DETECCIÓN DE IMAGEN
    const imageKeywords = /(genera|crea|dibuja|haz|imagen|foto|renderiza)/i;
    if (imageKeywords.test(text)) {
      setState("thinking");
      
      try {
        let cleanText = text.replace(/(jarvis|me ayudas|puedes|generar|genera|crear|crea|una imagen|imagen|foto|dibuja|haz|de|un|una|el|la|con|para|y|dama|carrera)/gi, "").trim();
        cleanText = cleanText.replace(/ónix/gi, "black onyx").replace(/oro/gi, "gold").replace(/plata/gi, "silver").replace(/graduación/gi, "graduation");
        
        const finalPrompt = `Product photography of a luxury jewelry ring, ${cleanText}, isolated on a dark background, macro lens, high quality, 8k, no humans, no faces, no hands, no people`;

        const token = localStorage.getItem("jarvis_token");
        const res = await fetch(`${API}/generate-image`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ prompt: finalPrompt })
        });
        
        const data = await res.json();
        
        if (data.url) {
          const imgMsg = { id: Date.now().toString(), role: "assistant", type: "image", content: data.url, prompt: finalPrompt };
          setMessages((m) => [...m, imgMsg]);
          speak("Aquí tiene su diseño, señor.");
        } else {
          toast.error("No se pudo generar la imagen.");
        }
      } catch (err) {
        toast.error("Error al generar la imagen con Replicate.");
      } finally {
        setState("idle");
      }
      return;
    }

    // CHAT NORMAL
    const replyId = (Date.now() + 1).toString();
    const replyMsg = { id: replyId, role: "assistant", content: "" };
    setMessages((m) => [...m, replyMsg]);
    setState("thinking");

    try {
      const token = localStorage.getItem("jarvis_token");
      const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message: text, session_id: "default" })
      });

      if (!response.body) throw new Error("No stream");
      const textResponse = await response.text();
      let acc = "";
      const lines = textResponse.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "delta") acc += data.content;
          } catch (err) {}
        }
      }
      setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: acc } : x)));
      speak(acc);
    } catch (err) {
      toast.error("Error al comunicarse con Jarvis");
      setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: "Disculpe, perdí la conexión." } : x)));
      setState("idle");
    }
  };

  const orbState = speech.listening ? "listening" : state;

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col lg:flex-row jarvis-hud">
      <section className="lg:w-[420px] shrink-0 flex flex-col items-center justify-center gap-8 py-8 lg:border-r border-white/5 relative">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.5em] text-cyan-400/70">Just A Rather Very Intelligent System</div>
          <h1 className="font-display text-4xl font-light tracking-[0.3em] mt-2 text-cyan-100">J.A.R.V.I.S.</h1>
        </div>
        <ArcReactor state={orbState} onClick={listen} size={window.innerWidth < 1024 ? 150 : 220} />
        
        <div className="flex flex-col gap-3 w-64 mt-4 text-xs text-zinc-400">
          <label className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Volume2 className="w-4 h-4" /> Respuesta por voz</span>
            <Switch checked={voiceOn} onCheckedChange={setVoiceOn} />
          </label>
          <label className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Mic className="w-4 h-4" /> Manos libres</span>
            <Switch checked={handsFree} onCheckedChange={(v) => { setHandsFree(v); handsFreeRef.current = v; }} />
          </label>
        </div>
      </section>

      <section className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto px-5 md:px-8 py-6" aria-live="polite">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((m, i) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.type === "image" ? (
                  <div className="bg-zinc-900 border border-white/10 rounded-2xl p-3 max-w-[85%]">
                    <div className="text-xs text-zinc-400 mb-2 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-amber-500" /> Diseño generado por IA
                    </div>
                    <img src={m.content} alt={m.prompt} className="rounded-xl w-full object-cover" />
                  </div>
                ) : (
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-amber-600 text-black" : "card-glass border-cyan-500/15 text-zinc-200"}`}>
                    {m.content || (state === "thinking" && i === messages.length - 1 ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : "")}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>
        <div className="p-4 border-t border-white/5">
          <form onSubmit={send} className="max-w-3xl mx-auto flex gap-2">
            <Button type="button" variant="outline" size="icon" onClick={listen} className={`h-12 w-12 bg-zinc-950 border-zinc-800 ${speech.listening ? 'text-red-500 border-red-500 animate-pulse' : ''}`}>
              <Mic className="w-4 h-4" />
            </Button>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={speech.listening ? "Escuchando..." : "Pídele a Jarvis que genere un diseño..."} className="bg-zinc-950 border-zinc-800 h-12 text-sm" disabled={state === "thinking"} />
            <Button type="submit" disabled={state === "thinking" || !input.trim()} className="h-12 bg-cyan-600 hover:bg-cyan-500 text-black">
              {state === "thinking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}