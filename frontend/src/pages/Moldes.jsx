import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Upload, Search, Loader2, Save, FileText, BookOpen, ClipboardPaste } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Moldes() {
  const [isScanning, setIsScanning] = useState(false);
  const [libreria, setLibreria] = useState("");
  const [texto, setTexto] = useState("");
  
  const [moldes, setMoldes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);

  const loadMoldes = async (searchQuery = "") => {
    try {
      const url = searchQuery ? `/molds?search=${searchQuery}` : "/molds";
      const { data } = await api.get(url);
      setMoldes(data);
    } catch (error) {
      toast.error("Error al cargar las librerías");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMoldes();
  }, []);

  // 1. ESCANEAR FOTO (Solo extrae el texto, no guarda foto)
  const handleScan = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setIsScanning(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const { data } = await api.post("/molds/scan", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setTexto(data.texto);
      toast.success("¡Texto leído! Revisa, corrige si hace falta y guárdalo.");
    } catch (error) {
      toast.error("No se pudo leer la imagen.");
    } finally {
      setIsScanning(false);
    }
  };

  // 2. PEGAR DESDE EL PORTAPAPELES (Ideal para texto manual)
  const pegarTexto = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setTexto(text);
      toast.success("Texto pegado desde el portapapeles");
    } catch (err) {
      toast.error("Tu navegador no permitió leer el portapapeles.");
    }
  };

  // 3. GUARDAR LA LIBRERÍA
  const handleSave = async () => {
    if (!libreria.trim() || !texto.trim()) {
      toast.error("Ponle un nombre a la librería y asegúrate de que haya texto.");
      return;
    }
    try {
      await api.post("/molds", { titulo: libreria, texto: texto });
      toast.success("Librería guardada exitosamente");
      setLibreria("");
      setTexto("");
      loadMoldes();
    } catch (error) {
      toast.error("Error al guardar");
    }
  };

  const handleSearch = (e) => {
    setBusqueda(e.target.value);
    loadMoldes(e.target.value);
  };

  const descargarPdf = async (id, nombre) => {
    try {
      const response = await api.get(`/molds/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Libreria_${nombre}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      toast.error("Error al descargar PDF");
    }
  };

  // Resaltar la palabra buscada en dorado
  const resaltarTexto = (textoCompleto) => {
    if (!busqueda) return textoCompleto;
    const regex = new RegExp(`(${busqueda})`, 'gi');
    return textoCompleto.split(regex).map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-[#c5a572] text-black px-1 rounded">{part}</mark> : part
    );
  };

  return (
    <div className="p-5 md:p-12 max-w-6xl mx-auto pb-32">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.3em] text-[#c5a572] mb-3">Biblioteca Digital</div>
        <h1 className="font-display text-4xl font-light text-white">Librerías de Moldes</h1>
        <p className="text-sm text-zinc-400 mt-2">Escanea tus libretas o pega texto manual. Sin fotos, solo texto organizado.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PANEL IZQUIERDO: CREAR LIBRERÍA */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card-glass rounded-2xl p-6 border border-[#c5a572]/20">
            <h2 className="font-display text-xl text-white mb-4">Agregar Texto</h2>
            
            {/* Botón para escanear foto */}
            <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center relative hover:bg-zinc-900 transition-colors mb-4">
              <input type="file" accept="image/*" onChange={handleScan} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isScanning} />
              {isScanning ? <Loader2 className="w-8 h-8 text-[#c5a572] animate-spin mx-auto mb-2" /> : <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />}
              <p className="text-sm text-zinc-300 font-medium">{isScanning ? "Leyendo letra..." : "Escanear foto de libreta"}</p>
            </div>

            <div className="space-y-3">
              <Input 
                placeholder="Nombre de la Librería (Ej. Peritos, Anillos)" 
                value={libreria} 
                onChange={(e) => setLibreria(e.target.value)} 
                className="bg-zinc-950 border-zinc-800" 
              />
              
              <div className="relative">
                <textarea 
                  placeholder="El texto de la foto aparecerá aquí. También puedes pegar texto o escribirlo manual..."
                  value={texto} 
                  onChange={(e) => setTexto(e.target.value)}
                  className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-md p-3 pb-12 text-sm text-zinc-300 focus:border-[#c5a572] font-mono"
                />
                {/* Botón para pegar */}
                <Button 
                  onClick={pegarTexto} 
                  variant="secondary"
                  className="absolute bottom-2 right-2 h-8 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  <ClipboardPaste className="w-3 h-3 mr-1" /> Pegar
                </Button>
              </div>

              <Button onClick={handleSave} className="w-full bg-[#c5a572] hover:bg-[#b08d5b] text-black font-semibold">
                <Save className="w-4 h-4 mr-2" /> Guardar Librería
              </Button>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: BUSCADOR Y TEXTOS GUARDADOS */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input 
              placeholder="Buscar dentro de todas las librerías (Ej. perito, 8x6, oro...)" 
              value={busqueda} 
              onChange={handleSearch} 
              className="pl-10 bg-zinc-900 border-zinc-800 h-12 text-lg" 
            />
          </div>

          {loading ? (
            <div className="text-center py-10 text-zinc-500">Cargando librerías...</div>
          ) : moldes.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 card-glass rounded-2xl border border-white/5">
              No hay textos guardados aún.
            </div>
          ) : (
            <div className="grid gap-4">
              {moldes.map((molde) => (
                <div key={molde.id} className="card-glass rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-display text-xl text-[#c5a572] flex items-center gap-2">
                      <BookOpen className="w-5 h-5" /> {molde.titulo}
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => descargarPdf(molde.id, molde.titulo)} className="border-[#c5a572]/30 text-[#c5a572] hover:bg-[#c5a572]/10">
                      <FileText className="w-4 h-4 mr-2" /> PDF
                    </Button>
                  </div>
                  
                  {/* AQUÍ SOLO SE MUESTRA EL TEXTO (Sin fotos) */}
                  <div className="text-sm text-zinc-300 whitespace-pre-wrap max-h-64 overflow-y-auto bg-zinc-950/50 p-4 rounded-lg border border-white/5 font-mono">
                    {resaltarTexto(molde.texto)}
                  </div>
                  
                  <div className="text-[10px] text-zinc-600 flex justify-between">
                    <span>Por: {molde.creado_por}</span>
                    <span>{new Date(molde.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}