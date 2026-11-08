import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Upload, Search, Loader2, Save, X, Copy, FolderPlus, Folder, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Moldes() {
  // Estados para Librerías (Colecciones)
  const [libraries, setLibraries] = useState([]);
  const [currentLibrary, setCurrentLibrary] = useState(null); // Si es null, vemos las carpetas. Si tiene datos, vemos los moldes.
  const [newLibraryName, setNewLibraryName] = useState("");
  const [showNewLibrary, setShowNewLibrary] = useState(false);

  // Estados para Moldes
  const [moldes, setMoldes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Estados del Escáner
  const [file, setFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [nombreMolde, setNombreMolde] = useState("");
  const [textoExtraido, setTextoExtraido] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  
  // Visor de fotos
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  // --- CARGAR DATOS ---
  const loadLibraries = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/libraries");
      setLibraries(data);
    } catch (error) {
      toast.error("Error al cargar las colecciones");
    } finally {
      setLoading(false);
    }
  };

  const loadMoldes = async (searchQuery = "", libId = null) => {
    setLoading(true);
    try {
      let url = "/molds?";
      if (searchQuery) url += `search=${searchQuery}&`;
      if (libId) url += `library_id=${libId}`;
      
      const { data } = await api.get(url);
      setMoldes(data);
    } catch (error) {
      toast.error("Error al cargar los moldes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentLibrary) {
      loadMoldes("", currentLibrary.id);
    } else {
      loadLibraries();
    }
  }, [currentLibrary]);

  // --- CREAR LIBRERÍA ---
  const handleCreateLibrary = async () => {
    if (!newLibraryName.trim()) return;
    try {
      await api.post("/libraries", { nombre: newLibraryName });
      toast.success("Colección creada");
      setNewLibraryName("");
      setShowNewLibrary(false);
      loadLibraries();
    } catch (error) {
      toast.error("Error al crear colección");
    }
  };

  // --- ESCANEAR FOTO ---
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
      toast.success("¡Texto leído con éxito!");
    } catch (error) {
      toast.error("No se pudo leer la imagen.");
    } finally {
      setIsScanning(false);
    }
  };

  // --- GUARDAR MOLDE ---
  const handleSave = async () => {
    if (!nombreMolde.trim() || !textoExtraido.trim()) {
      toast.error("Ponle un nombre y asegúrate de que haya texto.");
      return;
    }

    try {
      await api.post("/molds", {
        nombre: nombreMolde,
        texto: textoExtraido,
        foto_url: fotoUrl,
        library_id: currentLibrary?.id || null // Se guarda en la carpeta actual
      });
      toast.success("Molde guardado");
      setNombreMolde("");
      setTextoExtraido("");
      setFotoUrl("");
      setFile(null);
      loadMoldes("", currentLibrary.id);
    } catch (error) {
      toast.error("Error al guardar el molde");
    }
  };

  const copiarTexto = (texto) => {
    navigator.clipboard.writeText(texto);
    toast.success("Texto copiado");
  };

  // --- RENDERIZADO PRINCIPAL ---
  return (
    <div className="p-5 md:p-12 max-w-6xl mx-auto pb-32">
      
      {/* VISTA 1: TODAS LAS LIBRERÍAS (Como el inicio de Spotify) */}
      {!currentLibrary ? (
        <>
          <header className="mb-8 flex justify-between items-end">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[#c5a572] mb-3">Archivo de Diseños</div>
              <h1 className="font-display text-4xl font-light text-white">Tus Colecciones</h1>
              <p className="text-sm text-zinc-400 mt-2">Agrupa tus moldes por categorías (Graduación, Dijes, etc).</p>
            </div>
            <Button onClick={() => setShowNewLibrary(true)} className="bg-[#c5a572] text-black hover:bg-[#b08d5b]">
              <FolderPlus className="w-4 h-4 mr-2" /> Nueva Colección
            </Button>
          </header>

          {showNewLibrary && (
            <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex gap-2">
              <Input 
                placeholder="Ej. Anillos de Graduación" 
                value={newLibraryName} 
                onChange={(e) => setNewLibraryName(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
              />
              <Button onClick={handleCreateLibrary} className="bg-[#c5a572] text-black">Crear</Button>
              <Button variant="ghost" onClick={() => setShowNewLibrary(false)}>Cancelar</Button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-10 text-zinc-500">Cargando colecciones...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {libraries.map((lib) => (
                <div 
                  key={lib.id} 
                  onClick={() => setCurrentLibrary(lib)}
                  className="card-glass p-6 rounded-2xl cursor-pointer hover:bg-zinc-800/80 transition-all border border-white/5 group"
                >
                  <Folder className="w-12 h-12 text-[#c5a572] mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="font-display text-xl text-white truncate">{lib.nombre}</h3>
                  <p className="text-xs text-zinc-400 mt-1">{lib.total_moldes} moldes</p>
                </div>
              ))}
              {libraries.length === 0 && (
                <div className="col-span-full text-center py-10 text-zinc-500">
                  Aún no tienes colecciones. ¡Crea la primera!
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        
        /* VISTA 2: DENTRO DE UNA LIBRERÍA (Como el interior de una playlist) */
        <>
          <header className="mb-8 flex items-center gap-4">
            <Button variant="ghost" onClick={() => setCurrentLibrary(null)} className="text-zinc-400 hover:text-white">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[#c5a572] mb-1">Colección</div>
              <h1 className="font-display text-4xl font-light text-white">{currentLibrary.nombre}</h1>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna Izquierda: Escáner */}
            <div className="lg:col-span-1 space-y-4">
              <div className="card-glass rounded-2xl p-6 border border-[#c5a572]/20">
                <h2 className="font-display text-xl text-white mb-4">Escanear para esta colección</h2>
                
                <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center hover:bg-zinc-900 transition-colors relative">
                  <input type="file" accept="image/*" onChange={handleScan} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isScanning} />
                  {isScanning ? <Loader2 className="w-8 h-8 text-[#c5a572] animate-spin mx-auto mb-2" /> : <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />}
                  <p className="text-sm text-zinc-300 font-medium">{isScanning ? "Leyendo letra..." : "Tomar foto o subir imagen"}</p>
                </div>

                {(textoExtraido || fotoUrl) && (
                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Nombre del Molde</label>
                      <Input placeholder="Ej. Top 8x6" value={nombreMolde} onChange={(e) => setNombreMolde(e.target.value)} className="bg-zinc-950 border-zinc-800" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Texto (Editable)</label>
                      <textarea value={textoExtraido} onChange={(e) => setTextoExtraido(e.target.value)} className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-md p-3 text-sm text-zinc-300 focus:outline-none" />
                    </div>
                    <Button onClick={handleSave} className="w-full bg-[#c5a572] text-black font-medium">
                      <Save className="w-4 h-4 mr-2" /> Guardar en {currentLibrary.nombre}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha: Lista de Moldes */}
            <div className="lg:col-span-2 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input placeholder="Buscar en esta colección..." value={busqueda} onChange={(e) => { setBusqueda(e.target.value); loadMoldes(e.target.value, currentLibrary.id); }} className="pl-10 bg-zinc-900 border-zinc-800 h-12" />
              </div>

              {loading ? (
                <div className="text-center py-10 text-zinc-500">Cargando...</div>
              ) : moldes.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 card-glass rounded-2xl border border-white/5">No hay moldes en esta colección.</div>
              ) : (
                <div className="grid gap-4">
                  {moldes.map((molde) => (
                    <div key={molde.id} className="card-glass rounded-2xl p-4 border border-white/5 flex gap-4">
                      {molde.foto_url && (
                        <div className="w-24 h-24 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-zinc-800" onClick={() => setFotoAmpliada(molde.foto_url)}>
                          <img src={molde.foto_url} alt={molde.nombre} className="w-full h-full object-cover hover:scale-110 transition-transform" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-lg text-[#c5a572] truncate">{molde.nombre}</h3>
                          <Button variant="ghost" size="icon" onClick={() => copiarTexto(molde.texto)} className="h-6 w-6 text-zinc-500 hover:text-white shrink-0">
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap flex-1 overflow-y-auto max-h-20 mt-1">{molde.texto}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* VISOR DE FOTO A PANTALLA COMPLETA */}
      {fotoAmpliada && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4" onClick={() => setFotoAmpliada(null)}>
          <button className="absolute top-6 right-6 p-2 bg-zinc-800 rounded-full text-white" onClick={(e) => { e.stopPropagation(); setFotoAmpliada(null); }}>
            <X className="w-6 h-6" />
          </button>
          <img src={fotoAmpliada} alt="Ampliación" className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}