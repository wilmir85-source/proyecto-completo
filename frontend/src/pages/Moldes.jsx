import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { 
  Folder, Plus, Search, Save, Upload, Loader2, BookOpen, Camera, Trash2, X 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Moldes() {
  // --- ESTADOS ---
  const [librerias, setLibrerias] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null);
  const [moldes, setMoldes] = useState([]);
  
  // Estados para crear carpeta
  const [nuevaLib, setNuevaLib] = useState("");
  
  // Estados para crear molde
  const [numero, setNumero] = useState("");
  const [texto, setTexto] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null);

  // Búsqueda global
  const [busqueda, setBusqueda] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);

  // --- CARGA DE DATOS ---
  const loadLibrerias = async () => {
    const { data } = await api.get("/libraries");
    setLibrerias(data);
  };

  const loadMoldes = async (libId) => {
    const { data } = await api.get(`/libraries/${libId}/molds`);
    setMoldes(data);
  };

  useEffect(() => { loadLibrerias(); }, []);

  // --- CREAR CARPETA ---
  const crearLibreria = async () => {
    if (!nuevaLib.trim()) return;
    await api.post("/libraries", { nombre: nuevaLib });
    setNuevaLib("");
    loadLibrerias();
    toast.success("Carpeta creada");
  };

  const seleccionarLibreria = (lib) => {
    setSelectedLib(lib);
    loadMoldes(lib.id);
    setNumero("");
    setTexto("");
    setFotoPreview(null);
  };

  // --- ESCANEAR FOTO ---
  const handleScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setFotoPreview(URL.createObjectURL(file));
    setIsScanning(true);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const { data } = await api.post("/molds/scan", formData, { 
        headers: { "Content-Type": "multipart/form-data" }
      });
      setTexto(data.texto);
      toast.success("¡Texto leído! Revisa y guárdalo.");
    } catch (error) {
      toast.error("Error al leer la foto. Intenta de nuevo.");
    } finally {
      setIsScanning(false);
    }
  };

  // --- GUARDAR MOLDE ---
  const guardarMolde = async () => {
    if (!numero.trim() || !texto.trim()) {
      toast.error("Ponle un número/nombre y asegúrate de que haya texto.");
      return;
    }
    await api.post("/molds", { libreria_id: selectedLib.id, numero, texto });
    setNumero("");
    setTexto("");
    setFotoPreview(null);
    loadMoldes(selectedLib.id);
    toast.success("Molde guardado en esta carpeta");
  };

  // --- BUSCADOR GLOBAL ---
  const buscar = async (e) => {
    const q = e.target.value;
    setBusqueda(q);
    if (!q) { setResultadosBusqueda([]); return; }
    const { data } = await api.get(`/molds/search?q=${q}`);
    setResultadosBusqueda(data);
  };

  return (
    <div className="p-5 md:p-12 max-w-7xl mx-auto pb-32">
      {/* HEADER */}
      <header className="mb-8">
        <h1 className="font-display text-4xl font-light text-white">Archivo de Moldes</h1>
        <p className="text-sm text-zinc-400 mt-2">Organiza tu inventario por carpetas. Escanea o digita los moldes.</p>
      </header>

      {/* BUSCADOR GLOBAL */}
      <div className="relative mb-8 z-50">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <Input 
          placeholder="Buscar en TODAS las carpetas (Ej. Perito, 45, Zafiro...)" 
          value={busqueda} onChange={buscar} 
          className="pl-12 bg-zinc-900 border-[#c5a572]/30 h-14 text-lg rounded-xl shadow-lg" 
        />
        {busqueda && resultadosBusqueda.length > 0 && (
          <div className="absolute top-16 left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
            {resultadosBusqueda.map(r => (
              <div key={r.id} className="p-4 border-b border-zinc-800 hover:bg-zinc-800 flex justify-between items-center">
                <div>
                  <span className="text-[#c5a572] font-bold text-lg block">Molde: {r.numero}</span>
                  <p className="text-sm text-zinc-400 line-clamp-1">{r.texto}</p>
                </div>
                <span className="text-xs bg-zinc-800 px-3 py-1 rounded-full text-zinc-300 border border-zinc-700">
                  {r.nombre_libreria}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* COLUMNA IZQUIERDA: CARPETAS */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card-glass p-5 rounded-2xl border border-white/10 shadow-lg">
            <h2 className="text-xs uppercase tracking-widest text-[#c5a572] mb-3 font-bold">Nueva Carpeta</h2>
            <div className="flex gap-2">
              <Input 
                placeholder="Ej. Peritos" 
                value={nuevaLib} 
                onChange={(e) => setNuevaLib(e.target.value)} 
                className="bg-zinc-950 border-zinc-800 rounded-lg" 
              />
              <Button onClick={crearLibreria} className="bg-[#c5a572] hover:bg-[#b08d5b] text-black rounded-lg">
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {librerias.map(lib => (
              <button 
                key={lib.id} 
                onClick={() => seleccionarLibreria(lib)}
                className={`w-full text-left p-4 rounded-xl flex items-center gap-3 transition-all ${
                  selectedLib?.id === lib.id 
                  ? "bg-[#c5a572]/15 border border-[#c5a572]/50 shadow-md" 
                  : "bg-zinc-900/50 border border-white/5 hover:bg-zinc-800"
                }`}
              >
                <Folder className={`w-5 h-5 ${selectedLib?.id === lib.id ? "text-[#c5a572]" : "text-zinc-500"}`} />
                <span className="text-sm font-medium text-white">{lib.nombre}</span>
              </button>
            ))}
          </div>
        </div>

        {/* COLUMNA DERECHA: CONTENIDO DE LA CARPETA */}
        <div className="lg:col-span-3 space-y-6">
          {selectedLib ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-[#c5a572]/10 rounded-lg border border-[#c5a572]/20">
                  <Folder className="w-6 h-6 text-[#c5a572]" />
                </div>
                <h2 className="text-3xl text-white font-display">{selectedLib.nombre}</h2>
              </div>

              {/* FORMULARIO DE NUEVO MOLDE */}
              <div className="card-glass p-6 rounded-2xl border border-white/10 shadow-lg space-y-5">
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Botón de subir foto */}
                  <div className="md:col-span-1">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:bg-zinc-900 transition-colors relative overflow-hidden">
                      {fotoPreview && (
                        <img src={fotoPreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                      )}
                      <div className="relative z-10 flex flex-col items-center">
                        {isScanning ? (
                          <Loader2 className="w-8 h-8 text-[#c5a572] animate-spin mb-2" />
                        ) : (
                          <Camera className="w-8 h-8 text-[#c5a572] mb-2" />
                        )}
                        <span className="text-sm font-medium text-white text-center px-2">
                          {isScanning ? "Leyendo..." : "Subir Foto"}
                        </span>
                      </div>
                      <input type="file" accept="image/*" onChange={handleScan} className="hidden" disabled={isScanning} />
                    </label>
                  </div>

                  {/* Número del molde */}
                  <div className="md:col-span-2">
                    <label className="text-xs text-zinc-400 mb-2 block font-medium">Número o Nombre del Molde</label>
                    <Input 
                      placeholder="Ej. 45, 102, Perito 8x6..." 
                      value={numero} 
                      onChange={(e) => setNumero(e.target.value)} 
                      className="bg-zinc-950 border-zinc-800 h-12 text-lg rounded-lg" 
                    />
                  </div>
                </div>

                {/* Texto editable */}
                <div>
                  <label className="text-xs text-zinc-400 mb-2 block font-medium">Texto Extraído (Editable)</label>
                  <textarea 
                    placeholder="El texto de la foto aparecerá aquí. Si no subes foto, puedes escribir directamente..."
                    value={texto} 
                    onChange={(e) => setTexto(e.target.value)}
                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 focus:border-[#c5a572] font-mono resize-none"
                  />
                </div>

                <Button onClick={guardarMolde} className="w-full bg-[#c5a572] hover:bg-[#b08d5b] text-black font-bold h-12 rounded-lg shadow-md">
                  <Save className="w-5 h-5 mr-2" /> Guardar Molde en esta Carpeta
                </Button>
              </div>

              {/* LISTA DE MOLDES GUARDADOS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {moldes.map(m => (
                  <div key={m.id} className="card-glass p-4 rounded-2xl border border-white/5 flex flex-col gap-3 shadow-sm hover:border-[#c5a572]/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <span className="bg-[#c5a572]/10 text-[#c5a572] font-bold text-lg px-3 py-1 rounded-lg border border-[#c5a572]/20">
                        {m.numero}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap line-clamp-4 font-mono">
                      {m.texto}
                    </p>
                  </div>
                ))}
                {moldes.length === 0 && (
                  <div className="col-span-full text-zinc-500 text-center py-12 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
                    Esta carpeta está vacía. ¡Sube una foto o escribe un molde arriba!
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-zinc-500 card-glass rounded-3xl border border-white/10">
              <BookOpen className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">Selecciona una carpeta de la izquierda o crea una nueva para empezar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}