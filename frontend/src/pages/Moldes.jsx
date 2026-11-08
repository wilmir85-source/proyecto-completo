import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Folder, Plus, Search, Save, FileText, Upload, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Moldes() {
  const [librerias, setLibrerias] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null);
  const [moldes, setMoldes] = useState([]);
  
  // Estados para crear
  const [nuevaLib, setNuevaLib] = useState("");
  const [numero, setNumero] = useState("");
  const [texto, setTexto] = useState("");
  const [isScanning, setIsScanning] = useState(false);

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
    setBusqueda(""); // Limpiar buscador al entrar a carpeta
  };

  const handleScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsScanning(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post("/molds/scan", formData, { headers: { "Content-Type": "multipart/form-data" }});
      setTexto(data.texto);
      toast.success("Texto leído");
    } catch (error) {
      toast.error("Error al leer foto");
    } finally {
      setIsScanning(false);
    }
  };

  const guardarMolde = async () => {
    if (!numero.trim() || !texto.trim()) {
      toast.error("Ponle un número/nombre y el texto.");
      return;
    }
    await api.post("/molds", { libreria_id: selectedLib.id, numero, texto });
    setNumero("");
    setTexto("");
    loadMoldes(selectedLib.id);
    toast.success("Molde guardado en esta carpeta");
  };

  const buscar = async (e) => {
    const q = e.target.value;
    setBusqueda(q);
    if (!q) {
      setResultadosBusqueda([]);
      return;
    }
    const { data } = await api.get(`/molds/search?q=${q}`);
    setResultadosBusqueda(data);
  };

  return (
    <div className="p-5 md:p-12 max-w-6xl mx-auto pb-32">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-light text-white">Archivo de Moldes</h1>
        <p className="text-sm text-zinc-400">Crea carpetas para organizar tu inventario.</p>
      </header>

      {/* BUSCADOR GLOBAL */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input 
          placeholder="Buscar molde en TODAS las carpetas (Ej. Perito, 45, Zafiro...)" 
          value={busqueda} onChange={buscar} 
          className="pl-10 bg-zinc-900 border-[#c5a572]/50 h-14 text-lg" 
        />
        {/* Resultados de búsqueda flotantes */}
        {busqueda && resultadosBusqueda.length > 0 && (
          <div className="absolute top-16 left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
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
            <h2 className="text-sm uppercase tracking-widest text-[#c5a572] mb-2">Nueva Carpeta</h2>
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

        {/* COLUMNA DERECHA: MOLDES DE LA CARPETA */}
        <div className="md:col-span-3 space-y-4">
          {selectedLib ? (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-2xl text-white font-display">Carpeta: {selectedLib.nombre}</h2>
              </div>

              {/* Formulario para nuevo molde */}
              <div className="card-glass p-4 rounded-xl border border-white/10 space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="Número o Nombre (Ej. 45, Perito 8x6)" value={numero} onChange={(e) => setNumero(e.target.value)} className="bg-zinc-950 border-zinc-800 w-1/3" />
                  <div className="relative w-2/3">
                    <input type="file" onChange={handleScan} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isScanning}/>
                    <Button variant="outline" className="w-full border-zinc-700 text-zinc-300 justify-start">
                      {isScanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} 
                      {isScanning ? "Leyendo foto..." : "Subir Foto para leer (Opcional)"}
                    </Button>
                  </div>
                </div>
                <textarea 
                  placeholder="Texto del molde o descripción..."
                  value={texto} onChange={(e) => setTexto(e.target.value)}
                  className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-md p-3 text-sm text-zinc-300"
                />
                <Button onClick={guardarMolde} className="w-full bg-[#c5a572] text-black">
                  <Save className="w-4 h-4 mr-2" /> Guardar Molde en esta Carpeta
                </Button>
              </div>

              {/* Lista de moldes */}
              <div className="grid gap-3">
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
                {moldes.length === 0 && <div className="text-zinc-500 text-center py-6">Esta carpeta está vacía.</div>}
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-zinc-500 card-glass rounded-2xl border border-white/10">
              <Folder className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Selecciona una carpeta de la izquierda para ver o agregar moldes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}