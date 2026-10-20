import { useRef, useState } from "react";

const Recognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const useSpeechRecognition = () => {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const start = (onFinal) => {
    if (!Recognition || listening) return;
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
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const stop = () => recRef.current?.stop();

  return { supported: !!Recognition, listening, interim, start, stop };
};
