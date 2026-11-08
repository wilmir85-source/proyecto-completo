import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Folder, Plus, Search, Save, Upload, Loader2, BookOpen, Camera, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Moldes() {
  const [librerias, setLibrerias] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null);
  const [moldes, setMoldes] = useState([]);
  
  // Estados para crear carpeta
  const [nuevaLib, setNuevaLib] = useState("");
  
  // Estados para crear molde
  const [numero, setNumero] = useState("");
  const [texto, setTexto] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null); // Para ver la foto antes de guardar

  // Búsqueda global
  const [busqueda, setBusqueda] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);

  const loadLibrerias = async () => {
    const { data } = await api.get("/libraries");
    setLibrerias(data);
  };

  const loadMoldes = async (libId) => {
    const { data } = await api.get(`/libraries/${libId}/molds`);
    setMoldes(data);
  };

  useEffect(() => { loadLibrerias(); }, []);

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

  // ESCANEAR FOTO CON GEMINI
  const handleScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Mostramos la miniatura de la foto
    setFotoPreview(URL.createObjectURL(file));
    setIsScanning(true);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const { data } = await api.post("/molds/scan", formData, { headers: { "Content-Type": "multipart/form-data" }});
      setTexto(data.texto);
      toast.success("¡Texto leído! Revisa y guárdalo.");
    } catch (error) {
      toast.error("Error al leer la foto. Intenta de nuevo.");
    } finally {
      setIsScanning(false);
    }
  };

  // GUARDAR MOLDE EN LA CARPETA
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

  const buscar = async (e) => {
    const q = e.target.value;
    setBusqueda(q);
    if (!q) { setResultadosBusqueda([]); return; }
    const { data } = await api.get(`/molds/search?q=${q}`);
    setResultadosBusqueda(data);
  };

  return (
    <div className="p-5 md:p-12 max-w-6xl mx-auto pb-32">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-light text-white">Archivo de Moldes</h1>
        <p className="text-sm text-zinc-400 mt-2">Crea carpetas, escanea fotos y organiza tu inventario.</p>
      </header>

      {/* BUSCADOR GLOBAL */}
      <div className="relative mb-8 z-50">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input 
          placeholder="Buscar molde en TODAS las carpetas (Ej. Perito, 45, Zafiro...)" 
          value={busqueda} onChange={buscar} 
          className="pl-10 bg-zinc-900 border-[#c5a572]/50 h-14 text-lg" 
        />
        {busqueda && resultadosBusqueda.length > 0 && (
          <div className="absolute top-16 left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
            {resultadosBusqueda.map(r => (
              <div key={r.id} className="p-4 border-b border-zinc-800 hover:bg-zinc-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[#c5a572] font-bold text-lg">Molde: {r.numero}</span>
                  <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-300">Carpeta: {r.nombre_libreria}</span>
                </div>
                <p className="text-sm text-zinc-400">{r.texto}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* COLUMNA IZQUIERDA: CARPETAS */}
        <div className="md:col-span-1 space-y-4">
          <div className="card-glass p-4 rounded-xl border border-white/10">
            <h2 className="text-xs uppercase tracking-widest text-[#c5a572] mb-3 font-bold">Nueva Carpeta</h2>
            <div className="flex gap-2">
              <Input placeholder="Ej. Peritos" value={nuevaLib} onChange={(e) => setNuevaLib(e.target.value)} className="bg-zinc-950 border-zinc-800" />
              <Button onClick={crearLibreria} className="bg-[#c5a572] text-black"><Plus className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="space-y-2">
            {librerias.map(lib => (
              <button 
                key={lib.id} onClick={() => seleccionarLibreria(lib)}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-2 transition-colors ${selectedLib?.id === lib.id ? "bg-[#c5a572]/20 border border-[#c5a572]/50" : "bg-zinc-900 border border-white/5 hover:bg-zinc-800"}`}
              >
                <Folder className="w-5 h-5 text-[#c5a572]" />
                <span className="text-sm text-white font-medium">{lib.nombre}</span>
              </button>
            ))}
          </div>
        </div>

        {/* COLUMNA DERECHA: CONTENIDO DE LA CARPETA */}
        <div className="md:col-span-3 space-y-4">
          {selectedLib ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Folder className="w-6 h-6 text-[#c5a572]" />
                <h2 className="text-2xl text-white font-display">Carpeta: {selectedLib.nombre}</h2>
              </div>

              {/* FORMULARIO PARA AGREGAR MOLDE */}
              <div className="card-glass p-5 rounded-xl border border-[#c5a572]/30 space-y-4">
                
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  {/* BOTÓN GIGANTE PARA SUBIR FOTO */}
                  <div className="flex-1 w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:bg-zinc-900 transition-colors relative overflow-hidden">
                      {fotoPreview ? (
                        <img src={fotoPreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                      ) : null}
                      
                      <div className="relative z-10 flex flex-col items-center">
                        {isScanning ? (
                          <Loader2 className="w-8 h-8 text-[#c5a572] animate-spin mb-2" />
                        ) : (
                          <Camera className="w-8 h-8 text-[#c5a572] mb-2" />
                        )}
                        <span className="text-sm font-medium text-white">
                          {isScanning ? "Leyendo con Gemini..." : "Tomar Foto o Subir Imagen"}
                        </span>
                        <span className="text-xs text-zinc-400 mt-1">Haz clic aquí</span>
                      </div>
                      
                      <input type="file" accept="image/*" onChange={handleScan} className="hidden" disabled={isScanning} />
                    </label>
                  </div>

                  {/* NÚMERO DEL MOLDE */}
                  <div className="w-full md:w-1/3">
                    <label className="text-xs text-zinc-400 mb-2 block">Número del Molde</label>
                    <Input 
                      placeholder="Ej. 45, 102..." 
                      value={numero} 
                      onChange={(e) => setNumero(e.target.value)} 
                      className="bg-zinc-950 border-zinc-800 h-12 text-lg" 
                    />
                  </div>
                </div>

                {/* CAJA DE TEXTO EDITABLE */}
                <div>
                  <label className="text-xs text-zinc-400 mb-2 block">Texto / Descripción (Editable)</label>
                  <textarea 
                    placeholder="El texto de la foto aparecerá aquí. Si no subes foto, puedes escribir directamente..."
                    value={texto} 
                    onChange={(e) => setTexto(e.target.value)}
                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-md p-3 text-sm text-zinc-300 focus:border-[#c5a572] font-mono"
                  />
                </div>

                <Button onClick={guardarMolde} className="w-full bg-[#c5a572] hover:bg-[#b08d5b] text-black font-semibold h-12">
                  <Save className="w-4 h-4 mr-2" /> Guardar Molde en esta Carpeta
                </Button>
              </div>

              {/* LISTA DE MOLDES GUARDADOS */}
              <div className="grid gap-3 mt-6">
                {moldes.map(m => (
                  <div key={m.id} className="card-glass p-4 rounded-xl border border-white/5 flex gap-4">
                    <div className="w-16 h-16 bg-[#c5a572]/10 rounded-lg flex items-center justify-center shrink-0 border border-[#c5a572]/30">
                      <span className="text-[#c5a572] font-bold text-lg">{m.numero}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">{m.texto}</p>
                    </div>
                  </div>
                ))}
                {moldes.length === 0 && (
                  <div className="text-zinc-500 text-center py-10 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
                    Esta carpeta está vacía. ¡Sube una foto o escribe un molde arriba!
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-zinc-500 card-glass rounded-2xl border border-white/10">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Selecciona una carpeta de la izquierda o crea una nueva para empezar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}