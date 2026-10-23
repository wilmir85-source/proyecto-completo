import { useRef, useState } from "react";
import { API } from "@/lib/api";

export const useSpeechRecognition = () => {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const start = async (onFinal) => {
    if (listening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Dejamos que el navegador elija el mejor formato (Safari usa mp4)
      let options = {};
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/mp4')) options = { mimeType: 'audio/mp4' };
        else if (MediaRecorder.isTypeSupported('audio/webm')) options = { mimeType: 'audio/webm' };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setListening(false);
        setInterim("Procesando voz...");
        
        const mimeType = mediaRecorder.mimeType || 'audio/mp4';
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        // Si el audio está vacío, avisamos en lugar de mandar basura
        if (audioBlob.size === 0) {
          alert("El micrófono no grabó audio. Intenta hablar más fuerte o más tiempo.");
          setInterim("");
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const formData = new FormData();
        formData.append("file", audioBlob, `audio.${extension}`);

        try {
          const token = localStorage.getItem("jarvis_token");
          const res = await fetch(`${API}/transcribe`, {
            method: "POST",
            headers: {
              ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: formData
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.text) onFinal(data.text);
          } else {
            console.error("Error en el servidor al transcribir");
          }
        } catch (err) {
          console.error("Error enviando audio:", err);
        } finally {
          setInterim("");
          stream.getTracks().forEach(track => track.stop());
        }
      };

      // EL TRUCO PARA SAFARI: start(1000) guarda pedacitos cada segundo
      mediaRecorder.start(1000);
      setListening(true);
      setInterim("Escuchando... (6 seg máx)");

      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, 6000);

    } catch (err) {
      console.warn("No se pudo acceder al micrófono:", err);
      setListening(false);
      alert("Debes permitir el micrófono en los ajustes de tu iPhone/Safari.");
    }
  };

  const stop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  return { supported: true, listening, interim, start, stop };
};