import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { fileUrl } from "@/lib/stages";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export const OrderPhotos = ({ order, onChange, readOnly }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
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
      onChange();
    } catch (e) { toast.error(e.response?.data?.detail || "No se pudo eliminar la foto"); }
  };

  return (
    <div data-testid="order-photos">
      <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Fotos de referencia ({fotos.length})</div>
      <div className="grid grid-cols-3 gap-3">
        {fotos.map((f) => (
          <div key={f.path} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
            <img src={fileUrl(f.path)} alt={f.nombre} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setPreview(f.path)} data-testid="order-photo-img" />
            {!readOnly && <button onClick={() => remove(f.path)} className="absolute top-1 right-1 p-1 rounded-md bg-black/70 text-zinc-300 hover:text-red-400 md:opacity-0 group-hover:opacity-100 transition-opacity" data-testid="btn-delete-photo">
              <X className="w-3.5 h-3.5" />
            </button>}
          </div>
        ))}
        {!readOnly && <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="aspect-square rounded-lg border border-dashed border-white/15 hover:border-amber-500/50 hover:text-amber-400 text-zinc-500 flex flex-col items-center justify-center gap-1 text-xs transition-colors"
          data-testid="btn-add-photo">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
          {uploading ? "Subiendo..." : "Subir fotos"}
        </button>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
        onChange={(e) => e.target.files?.length && upload([...e.target.files])} data-testid="input-photo-file" />
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-[95vw] w-auto bg-black border-zinc-800 p-2" data-testid="photo-preview">
          {preview && <img src={fileUrl(preview)} alt="" className="max-w-[90vw] max-h-[88vh] rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};
