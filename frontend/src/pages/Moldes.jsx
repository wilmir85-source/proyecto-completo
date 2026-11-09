import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function Moldes() {
  const [libraries, setLibraries] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null); 
  const [molds, setMolds] = useState([]);
  const [globalResults, setGlobalResults] = useState([]);
  const [search, setSearch] = useState("");
  
  const [newLibName, setNewLibName] = useState("");
  const [showNewLib, setShowNewLib] = useState(false);
  const [editingLib, setEditingLib] = useState(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); 
  
  // Estados separados para el formulario
  const [numero, setNumero] = useState("");
  const [tipo, setTipo] = useState("");
  const [carrera, setCarrera] = useState("");
  const [medida, setMedida] = useState("");
  const [notas, setNotas] = useState("");
  const [textoOriginal, setTextoOriginal] = useState(""); // Por si acaso
  
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const loadLibraries = useCallback(async () => {
    try {
      const r = await api.get("/libraries");
      setLibraries(r.data);
    } catch (error) { toast.error("Error al cargar carpetas"); }
  }, []);

  useEffect(() => { loadLibraries(); }, [loadLibraries]);

  const loadMolds = useCallback(async () => {
    if (!selectedLib) return;
    try {
      const r = await api.get(`/libraries/${selectedLib.id}/molds`);
      setMolds(r.data);
    } catch (error) { toast.error("Error al cargar moldes"); }
  }, [selectedLib]);

  useEffect(() => { loadMolds(); }, [selectedLib, loadMolds]);

  useEffect(() => {
    if (!selectedLib && search.trim() !== "") {
      const delay = setTimeout(async () => {
        try {
          const r = await api.get(`/molds/search?q=${search}`);
          setGlobalResults(r.data);
        } catch (error) { console.error(error); }
      }, 500);
      return () => clearTimeout(delay);
    } else { setGlobalResults([]); }
  }, [search, selectedLib]);

  const handleSaveLibrary = async () => {
    if (!newLibName.trim()) return toast.error("Escribe un nombre");
    try {
      if (editingLib) { await api.put(`/libraries/${editingLib.id}`, { nombre: newLibName }); }
      else { await api.post("/libraries", { nombre: newLibName }); }
      setNewLibName(""); setShowNewLib(false); setEditingLib(null); await loadLibraries();
      toast.success("Carpeta guardada");
    } catch (error) { toast.error("Error al guardar"); }
  };

  const handleDeleteLibrary = async (e, lib) => {
    e.stopPropagation();
    if (!window.confirm(`¿Borrar la carpeta "${lib.nombre}"?`)) return;
    try { await api.delete(`/libraries/${lib.id}`); await loadLibraries(); toast.success("Eliminada"); } catch (error) { toast.error("Error"); }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await api.post("/molds/scan", formData, { headers: { "Content-Type": "multipart/form-data" } });
      
      if (r.data?.datos) {
        const d = r.data.datos;
        setTipo(d.tipo_joya || ""); setCarrera(d.diseno_carrera || ""); 
        setMedida(d.medida || ""); setNumero(d.numero_molde || ""); setNotas(d.notas_adicionales || "");
        setTextoOriginal(JSON.stringify(d)); // Guardamos el JSON crudo por si acaso
        toast.success("Datos extraídos correctamente");
      }
    } catch (error) { toast.error("Error al escanear imagen"); } 
    finally { setScanning(false); }
  };

  const openNew = () => {
    setEditing(null); setNumero(""); setTipo(""); setCarrera(""); setMedida(""); setNotas(""); setTextoOriginal("");
    setModalOpen(true);
  };

  const openEdit = (molde) => {
    setEditing(molde); setNumero(molde.numero || ""); setTipo(molde.tipo_joya || ""); 
    setCarrera(molde.diseno_carrera || ""); setMedida(molde.medida || ""); setNotas(molde.notas_adicionales || ""); 
    setTextoOriginal(molde.texto || "");
    setModalOpen(true);
  };

  const handleSaveMold = async () => {
    if (!numero.trim()) return toast.error("Escribe un número o nombre");
    setSaving(true);
    
    // Creamos un texto "bonito" por si acaso el sistema viejo lo necesita
    const textoBonito = `• Tipo: ${tipo || "-"}\n• Carrera: ${carrera || "-"}\n• Medida: ${medida || "-"}\n• N° Molde: ${numero || "-"}\n• Notas: ${notas || "-"}`;

    const payload = {
      numero, texto: textoBonito,
      tipo_joya: tipo, diseno_carrera: carrera, medida: medida, numero_molde: numero, notas_adicionales: notas
    };

    try {
      if (editing) { await api.put(`/molds/${editing.id}`, payload); }
      else { await api.post("/molds", { libreria_id: selectedLib.id, ...payload }); }
      await loadMolds();
      setModalOpen(false);
      toast.success("Molde guardado");
    } catch (error) { toast.error("Error al guardar"); } 
    finally { setSaving(false); }
  };

  const handleDeleteMold = async (id, isGlobal = false) => {
    if (!window.confirm("¿Borrar este molde?")) return;
    try {
      await api.delete(`/molds/${id}`);
      if (isGlobal) setGlobalResults(globalResults.filter(m => m.id !== id));
      else await loadMolds();
      toast.success("Molde borrado");
    } catch (error) { toast.error("Error al borrar"); }
  };

  const filteredLibs = useMemo(() => {
    const q = search.toLowerCase();
    return libraries.filter((l) => (l.nombre || "").toLowerCase().includes(q));
  }, [libraries, search]);

  const filteredMolds = useMemo(() => {
    const q = search.toLowerCase();
    return molds.filter(
      (m) => (m.numero || "").toLowerCase().includes(q) || 
             (m.diseno_carrera || "").toLowerCase().includes(q) ||
             (m.texto || "").toLowerCase().includes(q)
    );
  }, [molds, search]);

  // --- ESTILOS ---
  const s = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px", fontFamily: "sans-serif", paddingBottom: "100px" },
    header: { marginBottom: "20px" },
    title: { fontSize: "28px", fontFamily: "serif", color: "#fff", margin: "0 0 5px 0" },
    subtitle: { color: "#888", fontSize: "14px", margin: 0 },
    searchBar: { width: "100%", padding: "15px", borderRadius: "10px", border: "1px solid #333", background: "#151515", color: "#fff", marginBottom: "20px", boxSizing: "border-box", fontSize: "16px" },
    btnAddLib: { background: "transparent", color: "#d4af37", border: "1px dashed #d4af37", padding: "12px", borderRadius: "10px", width: "100%", cursor: "pointer", marginBottom: "20px", fontWeight: "bold" },
    inputNewLib: { width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #d4af37", background: "#151515", color: "#fff", marginBottom: "10px", boxSizing: "border-box" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "15px" },
    folderCard: { background: "linear-gradient(145deg, #1a1a1a, #111)", border: "1px solid #333", borderRadius: "12px", padding: "20px 15px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative" },
    folderIcon: { fontSize: "30px", marginBottom: "10px" },
    folderActions: { position: "absolute", top: "8px", right: "8px", display: "flex", gap: "5px", opacity: 0.7 },
    moldCard: { background: "#151515", border: "1px solid #222", borderRadius: "12px", padding: "15px", display: "flex", flexDirection: "column" },
    moldNum: { color: "#d4af37", fontWeight: "bold", fontSize: "20px", fontFamily: "serif", marginBottom: "8px" },
    ficha: { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "15px" },
    fichaRow: { display: "flex", fontSize: "12px" },
    fichaLabel: { color: "#d4af37", width: "65px", fontWeight: "bold" },
    fichaValue: { color: "#ddd", flex: 1 },
    moldActions: { display: "flex", gap: "8px", marginTop: "auto" },
    btnIcon: { background: "#222", border: "none", color: "#fff", padding: "8px", borderRadius: "6px", cursor: "pointer", flex: 1, fontSize: "12px" },
    btnDanger: { background: "#3a1a1a", border: "none", color: "#f0b0b0", padding: "8px", borderRadius: "6px", cursor: "pointer", flex: 1, fontSize: "12px" },
    fab: { position: "fixed", bottom: "80px", right: "20px", width: "60px", height: "60px", borderRadius: "30px", background: "#d4af37", color: "#000", fontSize: "30px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 15px rgba(212, 175, 55, 0.4)", cursor: "pointer", zIndex: 90 },
    modalBg: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
    modal: { background: "#151515", padding: "25px 20px", borderTopLeftRadius: "20px", borderTopRightRadius: "20px", width: "100%", maxWidth: "500px", borderTop: "1px solid #333", maxHeight: "90vh", overflowY: "auto" },
    label: { fontSize: "12px", color: "#aaa", marginBottom: "4px", display: "block", marginTop: "12px", fontWeight: "bold" },
    input: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box", fontSize: "15px" },
    btnScan: { width: "100%", padding: "15px", borderRadius: "8px", border: "2px dashed #d4af37", background: "rgba(212,175,55,0.1)", color: "#d4af37", fontWeight: "bold", cursor: "pointer", marginTop: "10px", textAlign: "center" },
    btnSave: { width: "100%", padding: "16px", borderRadius: "8px", background: "#d4af37", color: "#000", fontWeight: "bold", border: "none", marginTop: "25px", cursor: "pointer", fontSize: "16px" },
    btnCancel: { width: "100%", padding: "16px", borderRadius: "8px", background: "transparent", color: "#888", border: "none", marginTop: "10px", cursor: "pointer", fontSize: "16px" }
  };

  // Componente para dibujar la ficha técnica en las tarjetas
  const RenderFicha = ({ molde }) => {
    if (!molde.tipo_joya && !molde.diseno_carrera && !molde.medida) {
      // Si es un molde viejo (antes de la actualización), mostramos el texto
      return <div style={{ fontSize: "13px", color: "#ddd", whiteSpace: "pre-wrap", marginBottom: "15px" }}>{molde.texto}</div>;
    }
    return (
      <div style={s.ficha}>
        <div style={s.fichaRow}><span style={s.fichaLabel}>Tipo:</span> <span style={s.fichaValue}>{molde.tipo_joya || "-"}</span></div>
        <div style={s.fichaRow}><span style={s.fichaLabel}>Carrera:</span> <span style={s.fichaValue}>{molde.diseno_carrera || "-"}</span></div>
        <div style={s.fichaRow}><span style={s.fichaLabel}>Medida:</span> <span style={s.fichaValue}>{molde.medida || "-"}</span></div>
        {molde.notas_adicionales && <div style={s.fichaRow}><span style={s.fichaLabel}>Notas:</span> <span style={s.fichaValue}>{molde.notas_adicionales}</span></div>}
      </div>
    );
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>{selectedLib ? selectedLib.nombre : "Mis Colecciones"}</h1>
        <p style={s.subtitle}>{selectedLib ? "Toca un molde para leerlo o editarlo" : "Organiza tus moldes por carpetas"}</p>
      </div>

      <input style={s.searchBar} placeholder={selectedLib ? "Buscar molde..." : "Buscar en TODAS las carpetas..."} value={search} onChange={(e) => setSearch(e.target.value)} />

      {selectedLib && (
        <button onClick={() => { setSelectedLib(null); setSearch(""); }} style={{ background: "none", border: "none", color: "#d4af37", fontSize: "16px", padding: 0, marginBottom: "20px", cursor: "pointer" }}>
          ← Volver a Colecciones
        </button>
      )}

      {!selectedLib && (
        <>
          {search.trim() === "" ? (
            <>
              {!showNewLib ? (
                <button style={s.btnAddLib} onClick={() => { setEditingLib(null); setNewLibName(""); setShowNewLib(true); }}>+ Nueva Colección</button>
              ) : (
                <div style={{ marginBottom: "20px" }}>
                  <input autoFocus style={s.inputNewLib} placeholder="Nombre..." value={newLibName} onChange={(e) => setNewLibName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveLibrary()} />
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button style={{ ...s.btnIcon, background: "#d4af37", color: "#000", padding: "12px" }} onClick={handleSaveLibrary}>Guardar</button>
                    <button style={{ ...s.btnIcon, padding: "12px" }} onClick={() => setShowNewLib(false)}>Cancelar</button>
                  </div>
                </div>
              )}
              <div style={s.grid}>
                {filteredLibs.map((lib) => (
                  <div key={lib.id} style={s.folderCard} onClick={() => setSelectedLib(lib)}>
                    <div style={s.folderIcon}>📁</div>
                    <div style={{ fontWeight: "bold", color: "#eee", fontSize: "15px" }}>{lib.nombre}</div>
                    <div style={s.folderActions}>
                      <button onClick={(e) => { e.stopPropagation(); setEditingLib(lib); setNewLibName(lib.nombre); setShowNewLib(true); }} style={{ background: "none", border: "none", color: "#d4af37", cursor: "pointer" }}>✏️</button>
                      <button onClick={(e) => handleDeleteLibrary(e, lib)} style={{ background: "none", border: "none", color: "#f0b0b0", cursor: "pointer" }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={s.grid}>
              {globalResults.map((molde) => (
                <div key={molde.id} style={s.moldCard}>
                  <div style={s.moldNum}>{molde.numero}</div>
                  <div style={{ fontSize: "11px", color: "#d4af37", marginBottom: "5px" }}>📁 {molde.nombre_libreria}</div>
                  <RenderFicha molde={molde} />
                  <div style={s.moldActions}>
                    <button style={s.btnIcon} onClick={() => openEdit(molde)}>✏️ Editar</button>
                    <button style={s.btnDanger} onClick={() => handleDeleteMold(molde.id, true)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {selectedLib && (
        <>
          <div style={s.grid}>
            {filteredMolds.map((molde) => (
              <div key={molde.id} style={s.moldCard}>
                <div style={s.moldNum}>{molde.numero}</div>
                <RenderFicha molde={molde} />
                <div style={s.moldActions}>
                  <button style={s.btnIcon} onClick={() => openEdit(molde)}>✏️ Editar</button>
                  <button style={s.btnDanger} onClick={() => handleDeleteMold(molde.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
          {filteredMolds.length === 0 && <p style={{ color: "#666", textAlign: "center", marginTop: "30px" }}>No hay moldes aquí.</p>}
        </>
      )}

      {selectedLib && <button style={s.fab} onClick={openNew}>+</button>}

      {modalOpen && (
        <div style={s.modalBg} onClick={() => setModalOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#d4af37", margin: "0 0 10px 0", fontFamily: "serif", fontSize: "24px" }}>
              {editing ? "Editar Ficha" : "Nuevo Molde"}
            </h2>

            {!editing && (
              <div style={s.btnScan} onClick={() => fileInputRef.current?.click()}>
                {scanning ? "⏳ Extrayendo texto..." : "📷 Escanear Foto con IA"}
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
              </div>
            )}

            <label style={s.label}>NÚMERO DE MOLDE</label>
            <input style={s.input} placeholder="Ej. 45, 212..." value={numero} onChange={(e) => setNumero(e.target.value)} />

            <label style={s.label}>TIPO DE JOYA</label>
            <input style={s.input} placeholder="Ej. Anillo, Dije..." value={tipo} onChange={(e) => setTipo(e.target.value)} />

            <label style={s.label}>CARRERA / DISEÑO</label>
            <input style={s.input} placeholder="Ej. Perito Contador Octagonal..." value={carrera} onChange={(e) => setCarrera(e.target.value)} />

            <label style={s.label}>MEDIDA</label>
            <input style={s.input} placeholder="Ej. 10x8..." value={medida} onChange={(e) => setMedida(e.target.value)} />

            <label style={s.label}>NOTAS ADICIONALES</label>
            <input style={s.input} placeholder="Ej. Nombre del cliente, fecha..." value={notas} onChange={(e) => setNotas(e.target.value)} />

            <button style={s.btnSave} onClick={handleSaveMold} disabled={saving || scanning}>
              {saving ? "Guardando..." : "💾 Guardar Ficha"}
            </button>
            <button style={s.btnCancel} onClick={() => setModalOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}