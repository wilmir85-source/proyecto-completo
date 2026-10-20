import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiError } from "@/lib/stages";
import { refreshBrand, useBrand } from "@/hooks/useBrand";

const FIELDS = [["nombre", "Nombre de la joyería"], ["telefono", "Teléfono / WhatsApp"], ["codigo_pais", "Código de país para WhatsApp (ej. 52 México, 57 Colombia, 1 EE.UU.)"], ["direccion", "Dirección"], ["mensaje", "Mensaje para clientes (página de seguimiento)"]];

export default function MiJoyeria() {
  const brand = useBrand();
  const [form, setForm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { api.get("/settings").then((r) => setForm(r.data)); }, []);

  const save = async () => {
    try {
      const { nombre, telefono, direccion, mensaje, codigo_pais } = form;
      await api.patch("/settings", { nombre, telefono, direccion, mensaje, codigo_pais });
      await refreshBrand();
      toast.success("Datos guardados");
    } catch (e) { toast.error(apiError(e)); }
  };

  const upload = async (file) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      setForm((await api.post("/settings/logo", fd)).data);
      await refreshBrand();
      toast.success("Logo actualizado");
    } catch (e) { toast.error(apiError(e)); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeLogo = async () => {
    setForm((await api.delete("/settings/logo")).data);
    await refreshBrand();
    toast.success("Logo restablecido");
  };

  if (!form) return null;
  return (
    <div className="p-5 md:p-12 max-w-3xl">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">Configuración</div>
        <h1 className="font-display text-4xl font-light">Mi joyería</h1>
        <p className="text-sm text-zinc-500 mt-2">El logo y el nombre aparecen en la app, en las órdenes de trabajo (PDF) y en la página de seguimiento que ven tus clientes.</p>
      </header>
      <div className="card-glass rounded-2xl p-6 mb-6 flex flex-wrap items-center gap-6" data-testid="logo-card">
        <img src={brand.logoUrl} alt="Logo" className="w-28 h-28 rounded-2xl object-cover border border-amber-500/30 bg-zinc-900" data-testid="logo-preview" />
        <div className="space-y-3">
          <div className="text-sm text-zinc-300">{form.has_logo ? "Logo personalizado" : "Logo provisional de Jarvis"}</div>
          <div className="flex gap-2">
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="bg-amber-600 hover:bg-amber-500 text-black" data-testid="btn-upload-logo">
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}{form.has_logo ? "Cambiar logo" : "Subir logo"}
            </Button>
            {form.has_logo && <Button variant="outline" onClick={removeLogo} className="border-zinc-700" data-testid="btn-remove-logo"><Trash2 className="w-4 h-4" /></Button>}
          </div>
          <div className="text-xs text-zinc-500">JPG, PNG o WEBP. Mejor si es cuadrado.</div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} data-testid="input-logo-file" />
        </div>
      </div>
      <div className="card-glass rounded-2xl p-6 space-y-4" data-testid="business-form">
        {FIELDS.map(([k, l]) => (
          <label key={k} className="block text-[10px] uppercase tracking-widest text-zinc-500">{l}
            <Input value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="bg-zinc-900 border-zinc-800 mt-1.5 normal-case tracking-normal text-sm text-zinc-100" data-testid={`business-${k}`} />
          </label>
        ))}
        <Button onClick={save} className="bg-amber-600 hover:bg-amber-500 text-black" data-testid="btn-save-business">Guardar</Button>
      </div>
    </div>
  );
}
