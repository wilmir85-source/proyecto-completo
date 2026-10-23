import { useRef, useState } from "react";

const Recognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const useSpeechRecognition = () => {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const stop = () => {
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
    }
    setListening(false);
    setInterim("");
  };

  const start = (onFinal) => {
    if (!Recognition || listening) return;
    
    try {
      const rec = new Recognition();
      rec.lang = navigator.language?.startsWith("es") ? navigator.language : "es-MX";
      rec.interimResults = true;
      rec.continuous = false;
      let finalText = "";

      rec.onresult = (e) => {
        let txt = "";
        for (const r of e.results) {
          if (r.isFinal) finalText = r[0].transcript;
          else txt += r[0].transcript;
        }
        setInterim(finalText || txt);
      };

      rec.onend = () => {
        setListening(false);
        setInterim("");
        if (finalText.trim()) onFinal(finalText.trim());
      };

      rec.onerror = (e) => {
        console.warn("Error de micrófono:", e.error);
        setListening(false);
        setInterim("");
        // Si hay error (ej. sin permiso), apagamos el micro
      };

      recRef.current = rec;
      setListening(true);
      rec.start();

      // SALVAVIDAS: Si en 8 segundos no ha pasado nada, lo apagamos para que no se trabe
      setTimeout(() => {
        if (recRef.current === rec) {
          stop();
        }
      }, 8000);

    } catch (err) {
      console.warn("No se pudo iniciar el micrófono:", err);
      setListening(false);
    }
  };

  return { supported: !!Recognition, listening, interim, start, stop };
};