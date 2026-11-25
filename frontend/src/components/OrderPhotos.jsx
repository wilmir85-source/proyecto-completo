import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { fileUrl } from "@/lib/stages";
import { ImagePlus, Loader2, X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";

export const OrderPhotos = ({ order, onChange, readOnly }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null); // ahora guarda el ÍNDICE, no el path
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const fotos = order.fotos || [];

  const upload = async (files) => {
    setUploading(true);
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f);
      try {
        await api.post(`/orders/${order.id}/photos`, fd);
      } catch (e) {
        toast.error(e.response?.data?.detail || `Error subiendo ${f.name}`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    onChange();
  };

  const remove = async (path) => {
    try {
      await api.delete(`/orders/${order.id}/photos`, { params: { path } });
      toast.success("Foto eliminada");
      if (preview !== null && preview >= fotos.length - 1) setPreview(null);
      onChange();
    } catch (e) { toast.error(e.response?.data?.detail || "No se pudo eliminar la foto"); }
  };

  // --- TRUCO PARA DESCARGAR DESDE CLOUDINARY ---
  const getDownloadUrl = (path) => {
    const url = fileUrl(path);
    if (url.includes("cloudinary.com")) {
      return url.replace("/upload/", "/upload/fl_attachment/");
    }
    return url;
  };

  // Teclado en el visor + reset de zoom al cambiar de foto
  useEffect(() => {
    if (preview === null) return;
    setZoom(false);
    const onKey = (e) => {
      if (e.key === "Escape") setPreview(null);
      else if (e.key === "ArrowRight") setPreview((i) => (i + 1) % fotos.length);
      else if (e.key === "ArrowLeft") setPreview((i) => (i - 1 + fotos.length) % fotos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, fotos.length]);

  const toggleZoom = (e) => {
    if (!zoom) {
      const r = e.currentTarget.getBoundingClientRect();
      setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
    }
    setZoom((z) => !z);
  };

  const cur = preview !== null ? fotos[preview] : null;

  return (
    <div data-testid="order-photos">
      <div className="text-xs uppercase tracking-widest text-zinc-400 mb-3">Fotos de referencia ({fotos.length})</div>
      {/* ▲ cols-3 igual que hoy en celular; en PC (lg) pasa a 2 columnas = miniaturas más grandes */}
      <div className="grid grid-cols-3 lg:grid-cols-2 gap-3">
        {fotos.map((f, i) => (
          <div key={f.path} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
            <img src={fileUrl(f.path)} alt={f.nombre} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setPreview(i)} data-testid="order-photo-img" />
            {!readOnly && <button onClick={() => remove(f.path)} className="absolute top-1 right-1 p-1 rounded-md bg-black/70 text-zinc-300 hover:text-red-400 md:opacity-0 group-hover:opacity-100 transition-opacity" data-testid="btn-delete-photo">
              <X className="w-3.5 h-3.5" />
            </button>}
          </div>
        ))}
        {!readOnly && <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="aspect-square rounded-lg border border-dashed border-white/15 hover:border-[#c5a572]/50 hover:text-amber-400 text-zinc-400 flex flex-col items-center justify-center gap-1 text-xs transition-colors"
          data-testid="btn-add-photo">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
          {uploading ? "Subiendo..." : "Subir fotos"}
        </button>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
        onChange={(e) => e.target.files?.length && upload([...e.target.files])} data-testid="input-photo-file" />

      {/* ▲ VISOR EN PORTAL: escapa del modal grande (backdrop-blur) y evita el conflicto de dos Dialog de Radix */}
      {cur && createPortal(
        <div
          data-testid="photo-preview"
          className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          {/* Flechas de navegación */}
          {fotos.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setPreview((i) => (i - 1 + fotos.length) % fotos.length); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-800/80 hover:bg-[#c5a572] text-white transition-colors z-10">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setPreview((i) => (i + 1) % fotos.length); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-800/80 hover:bg-[#c5a572] text-white transition-colors z-10">
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="overflow-hidden rounded-xl border border-white/10">
              <img
                src={fileUrl(cur.path)}
                alt={cur.nombre}
                onClick={toggleZoom}
                style={{ transformOrigin: origin, transform: zoom ? "scale(2)" : "scale(1)" }}
                className={`max-w-[92vw] max-h-[72vh] object-contain transition-transform duration-200 ${zoom ? "cursor-zoom-out" : "cursor-zoom-in"}`}
              />
            </div>

            <div className="text-xs text-zinc-400 flex items-center gap-3">
              <span className="font-mono">{preview + 1} / {fotos.length}</span>
              <span className="flex items-center gap-1 text-zinc-500">
                {zoom ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                {zoom ? "clic para alejar" : "clic para acercar"}
              </span>
            </div>

            <div className="flex gap-3 justify-center">
              <a href={getDownloadUrl(cur.path)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-[#c5a572] hover:bg-[#b08d5b] text-black font-bold rounded-lg transition-colors text-sm">
                <Download className="w-4 h-4" /> Descargar Foto
              </a>
              <button onClick={() => setPreview(null)}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors text-sm">
                <X className="w-4 h-4" /> Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};