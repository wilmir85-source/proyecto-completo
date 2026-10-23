import { useRef, useState } from "react";
import { API } from "@/lib/api";

export const useSpeechRecognition = () => {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null); // <-- NUEVO: Para mantener el micro vivo
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const start = async (onFinal) => {
    if (listening) return;

    try {
      // 1. Pedimos permiso al micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // 2. TRUCO PARA iOS 26: Creamos un AudioContext y conectamos el micro
      // Esto evita que iOS mate la pista de audio en las PWAs
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        // Conectamos a un gain con volumen 0 para no escuchar eco, pero mantener vivo el flujo
        const gain = audioContextRef.current.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(audioContextRef.current.destination);
        
        // Si el contexto está suspendido, lo reanudamos
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      }

      // 3. Elegimos el formato (iOS usa mp4)
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
        
        // Cerramos el AudioContext para liberar recursos
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        const mimeType = mediaRecorder.mimeType || 'audio/mp4';
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        if (audioBlob.size === 0) {
          alert("El micrófono no grabó audio. Intenta de nuevo.");
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
          }
        } catch (err) {
          console.error("Error enviando audio:", err);
        } finally {
          setInterim("");
          stream.getTracks().forEach(track => track.stop());
        }
      };

      // 4. Grabamos en pedacitos de 1 segundo (esto también ayuda en iOS)
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