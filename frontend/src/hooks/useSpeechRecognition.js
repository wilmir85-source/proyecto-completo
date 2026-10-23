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
      
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
      if (MediaRecorder.isTypeSupported('audio/aac')) mimeType = 'audio/aac';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setListening(false);
        setInterim("Procesando voz...");
        
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
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

      mediaRecorder.start();
      setListening(true);
      setInterim("Escuchando... (6 seg máx)");

      // AUTO-STOP: Se detiene solo a los 6 segundos para no trabarse
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