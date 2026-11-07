import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Upload, Search, FileText, Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Moldes() {
  const [file, setFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [nombreMolde, setNombreMolde] = useState("");
  const [textoExtraido, setTextoExtraido] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  
  const [moldes, setMoldes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);

  // Cargar los moldes al entrar
  const loadMoldes = async (searchQuery = "") => {
    try {
      const url = searchQuery ? `/molds?search=${searchQuery}` : "/molds";
      const { data } = await api.get(url);
      setMoldes(data);
    } catch (error) {
      toast.error("Error al cargar los moldes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMoldes();
  }, []);

  // Función para escanear la foto con Gemini
  const handleScan = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsScanning(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const { data } = await api.post("/molds/scan", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      setTextoExtraido(data.texto);
      setFotoUrl(data.foto_url);
      toast.success("¡Texto leído con éxito! Revisa y guarda.");
    } catch (error) {
      toast.error("No se pudo leer la imagen. Intenta de nuevo.");
    } finally {
      setIsScanning(false);
    }
  };

  // Función para guardar el molde
  const handleSave = async () => {
    if (!nombreMolde.trim() || !textoExtraido.trim()) {
      toast.error("Ponle un nombre y asegúrate de que haya texto.");
      return;
    }

    try {
      await api.post("/molds", {
        nombre: nombreMolde,
        texto: textoExtraido,
        foto_url: fotoUrl
      });
      toast.success("Molde guardado en la base de datos");
      
      // Limpiamos la pantalla
      setNombreMolde("");
      setTextoExtraido("");
      setFotoUrl("");
      setFile(null);
      loadMoldes(); // Recargamos la lista
    } catch (error) {
      toast.error("Error al guardar el molde");
    }
  };

  const handleSearch = (e) => {
    const val = e.target.value;
    setBusqueda(val);
    loadMoldes(val);
  };

  return (
    <div className="p-5 md:p-12 max-w-6xl mx-auto pb-32">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.3em] text-[#c5a572] mb-3">Archivo de Diseños</div>
        <h1 className="font-display text-4xl font-light text-white">Base de Datos de Moldes</h1>
        <p className="text-sm text-zinc-400 mt-2">Escanea notas escritas a mano o busca diseños existentes.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LADO IZQUIERDO: Escáner y Guardado */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card-glass rounded-2xl p-6 border border-[#c5a572]/20">
            <h2 className="font-display text-xl text-white mb-4">Escanear Nueva Nota</h2>
            
            <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center hover:bg-zinc-900 transition-colors relative">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleScan} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isScanning}
              />
              {isScanning ? (
                <Loader2 className="w-8 h-8 text-[#c5a572] animate-spin mx-auto mb-2" />
              ) : (
                <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
              )}
              <p className="text-sm text-zinc-300 font-medium">
                {isScanning ? "Leyendo letra..." : "Tomar foto o subir imagen"}
              </p>
            </div>

            {(textoExtraido || fotoUrl) && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Nombre del Molde</label>
                  <Input 
                    placeholder="Ej. Top 8x6 Bachillerato" 
                    value={nombreMolde} 
                    onChange={(e) => setNombreMolde(e.target.value)}
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Texto Extraído (Editable)</label>
                  <textarea 
                    value={textoExtraido} 
                    onChange={(e) => setTextoExtraido(e.target.value)}
                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-md p-3 text-sm text-zinc-300 focus:outline-none focus:border-[#c5a572]"
                  />
                </div>
                <Button onClick={handleSave} className="w-full bg-[#c5a572] hover:bg-[#b08d5b] text-black font-medium">
                  <Save className="w-4 h-4 mr-2" /> Guardar Molde
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* LADO DERECHO: Buscador y Resultados */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input 
              placeholder="Buscar por nombre o medida (ej. 8x6, zafiro...)" 
              value={busqueda}
              onChange={handleSearch}
              className="pl-10 bg-zinc-900 border-zinc-800 h-12"
            />
          </div>

          {loading ? (
            <div className="text-center py-10 text-zinc-500">Cargando moldes...</div>
          ) : moldes.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 card-glass rounded-2xl border border-white/5">
              No hay moldes guardados aún.
            </div>
          ) : (
            <div className="grid gap-4">
              {moldes.map((molde) => (
                <div key={molde.id} className="card-glass rounded-2xl p-5 border border-white/5 flex gap-4">
                  {molde.foto_url && (
                    <img src={molde.foto_url} alt={molde.nombre} className="w-24 h-24 object-cover rounded-xl border border-zinc-800" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg text-[#c5a572] truncate">{molde.nombre}</h3>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{molde.texto}</p>
                    <div className="text-[10px] text-zinc-600 mt-2">Guardado por {molde.creado_por}</div>
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