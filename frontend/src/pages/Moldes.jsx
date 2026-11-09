import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function Moldes() {
  const [libraries, setLibraries] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null); 
  const [molds, setMolds] = useState([]);
  const [globalResults, setGlobalResults] = useState([]); // Para el buscador global
  const [search, setSearch] = useState("");
  
  const [newLibName, setNewLibName] = useState("");
  const [showNewLib, setShowNewLib] = useState(false);
  const [editingLib, setEditingLib] = useState(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); 
  const [numero, setNumero] = useState("");
  const [texto, setTexto] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const loadLibraries = useCallback(async () => {
    try {
      const r = await api.get("/libraries");
      setLibraries(r.data);
    } catch (error) {
      toast.error("Error al cargar carpetas");
    }
  }, []);

  useEffect(() => { loadLibraries(); }, [loadLibraries]);

  const loadMolds = useCallback(async () => {
    if (!selectedLib) return;
    try {
      const r = await api.get(`/libraries/${selectedLib.id}/molds`);
      setMolds(r.data);
    } catch (error) {
      toast.error("Error al cargar moldes");
    }
  }, [selectedLib]);

  useEffect(() => { loadMolds(); }, [selectedLib, loadMolds]);

  // --- BUSCADOR GLOBAL ---
  useEffect(() => {
    if (!selectedLib && search.trim() !== "") {
      const delay = setTimeout(async () => {
        try {
          const r = await api.get(`/molds/search?q=${search}`);
          setGlobalResults(r.data);
        } catch (error) {
          console.error("Error búsqueda global");
        }
      }, 500);
      return () => clearTimeout(delay);
    } else {
      setGlobalResults([]);
    }
  }, [search, selectedLib]);

  const handleSaveLibrary = async () => {
    if (!newLibName.trim()) return toast.error("Escribe un nombre");
    try {
      if (editingLib) {
        await api.put(`/libraries/${editingLib.id}`, { nombre: newLibName });
        toast.success("Carpeta actualizada");
      } else {
        await api.post("/libraries", { nombre: newLibName });
        toast.success("Carpeta creada");
      }
      setNewLibName(""); setShowNewLib(false); setEditingLib(null);
      await loadLibraries();
    } catch (error) {
      toast.error("Error al guardar carpeta");
    }
  };

  const handleDeleteLibrary = async (e, lib) => {
    e.stopPropagation();
    if (!window.confirm(`¿Borrar la carpeta "${lib.nombre}" y todos sus moldes?`)) return;
    try {
      await api.delete(`/libraries/${lib.id}`);
      toast.success("Carpeta eliminada");
      await loadLibraries();
    } catch (error) {
      toast.error("Error al eliminar carpeta");
    }
  };

  const handleEditLibrary = (e, lib) => {
    e.stopPropagation();
    setEditingLib(lib); setNewLibName(lib.nombre); setShowNewLib(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await api.post("/molds/scan", formData, { headers: { "Content-Type": "multipart/form-data" } });
      
      // Soporta el backend nuevo (JSON) y el viejo (texto plano)
      if (r.data?.datos) {
        const d = r.data.datos;
        const textoFormateado = [
          `• Tipo: ${d.tipo_joya || "-"}`,
          `• Carrera/Diseño: ${d.diseno_carrera || "-"}`,
          `• Medida: ${d.medida || "-"}`,
          `• N° Molde: ${d.numero_molde || "-"}`,
          d.notas_adicionales ? `• Notas: ${d.notas_adicionales}` : null
        ].filter(Boolean).join("\n");
        setTexto(textoFormateado);
        if (d.numero_molde) setNumero(d.numero_molde);
      } else if (r.data?.texto) {
        setTexto(r.data.texto);
      }
      toast.success("Datos extraídos. Revisa y edita si es necesario.");
    } catch (error) {
      toast.error("Error al escanear imagen");
    } finally {
      setScanning(false);
    }
  };

  const handleSaveMold = async () => {
    if (!numero.trim()) return toast.error("Escribe un número o nombre");
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/molds/${editing.id}`, { numero, texto });
        toast.success("Molde actualizado");
      } else {
        if (!selectedLib) throw new Error("No hay carpeta seleccionada");
        await api.post("/molds", { libreria_id: selectedLib.id, numero, texto });
        toast.success(`Molde guardado en ${selectedLib.nombre}`);
      }
      await loadMolds();
      setModalOpen(false);
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMold = async (id, isGlobal = false) => {
    if (!window.confirm("¿Borrar este molde?")) return;
    try {
      await api.delete(`/molds/${id}`);
      if (isGlobal) {
        setGlobalResults(globalResults.filter(m => m.id !== id));
      } else {
        await loadMolds();
      }
      toast.success("Molde borrado");
    } catch (error) {
      toast.error("Error al borrar");
    }
  };

  // Filtros locales
  const filteredLibs = useMemo(() => {
    const q = search.toLowerCase();
    return libraries.filter((l) => (l.nombre || "").toLowerCase().includes(q));
  }, [libraries, search]);

  const filteredMolds = useMemo(() => {
    const q = search.toLowerCase();
    return molds.filter(
      (m) => (m.numero || "").toLowerCase().includes(q) || (m.texto || "").toLowerCase().includes(q)
    );
  }, [molds, search]);

  const s = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px", fontFamily: "sans-serif", paddingBottom: "100px" },
    header: { marginBottom: "20px" },
    title: { fontSize: "28px", fontFamily: "serif", color: "#fff", margin: "0 0 5px 0" },
    subtitle: { color: "#888", fontSize: "14px", margin: 0 },
    searchBar: { width: "100%", padding: "15px", borderRadius: "10px", border: "1px solid #333", background: "#151515", color: "#fff", marginBottom: "20px", boxSizing: "border-box", fontSize: "16px" },
    btnAddLib: { background: "transparent", color: "#d4af37", border: "1px dashed #d4af37", padding: "12px", borderRadius: "10px", width: "100%", cursor: "pointer", marginBottom: "20px", fontWeight: "bold" },
    inputNewLib: { width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #d4af37", background: "#151515", color: "#fff", marginBottom: "10px", boxSizing: "border-box" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "15px" },
    folderCard: { background: "linear-gradient(145deg, #1a1a1a, #111)", border: "1px solid #333", borderRadius: "12px", padding: "20px 15px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative", transition: "0.2s" },
    folderIcon: { fontSize: "30px", marginBottom: "10px" },
    folderActions: { position: "absolute", top: "8px", right: "8px", display: "flex", gap: "5px", opacity: 0.7 },
    moldCard: { background: "#151515", border: "1px solid #222", borderRadius: "12px", padding: "15px", display: "flex", flexDirection: "column" },
    moldNum: { color: "#d4af37", fontWeight: "bold", fontSize: "20px", fontFamily: "serif", marginBottom: "8px" },
    moldText: { color: "#ddd", fontSize: "13px", lineHeight: "1.5", whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", marginBottom: "15px", fontFamily: "monospace" },
    moldActions: { display: "flex", gap: "8px", marginTop: "auto" },
    btnIcon: { background: "#222", border: "none", color: "#fff", padding: "8px", borderRadius: "6px", cursor: "pointer", flex: 1, fontSize: "12px" },
    btnDanger: { background: "#3a1a1a", border: "none", color: "#f0b0b0", padding: "8px", borderRadius: "6px", cursor: "pointer", flex: 1, fontSize: "12px" },
    fab: { position: "fixed", bottom: "80px", right: "20px", width: "60px", height: "60px", borderRadius: "30px", background: "#d4af37", color: "#000", fontSize: "30px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 15px rgba(212, 175, 55, 0.4)", cursor: "pointer", zIndex: 90 },
    modalBg: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
    modal: { background: "#151515", padding: "25px 20px", borderTopLeftRadius: "20px", borderTopRightRadius: "20px", width: "100%", maxWidth: "500px", borderTop: "1px solid #333", maxHeight: "90vh", overflowY: "auto" },
    label: { fontSize: "13px", color: "#aaa", marginBottom: "8px", display: "block", marginTop: "15px", fontWeight: "bold" },
    input: { width: "100%", padding: "15px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box", fontSize: "16px" },
    textarea: { width: "100%", padding: "15px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", minHeight: "200px", boxSizing: "border-box", fontFamily: "monospace", fontSize: "15px", lineHeight: "1.6" },
    btnScan: { width: "100%", padding: "15px", borderRadius: "8px", border: "2px dashed #d4af37", background: "rgba(212,175,55,0.1)", color: "#d4af37", fontWeight: "bold", cursor: "pointer", marginTop: "15px", textAlign: "center" },
    btnSave: { width: "100%", padding: "16px", borderRadius: "8px", background: "#d4af37", color: "#000", fontWeight: "bold", border: "none", marginTop: "25px", cursor: "pointer", fontSize: "16px" },
    btnCancel: { width: "100%", padding: "16px", borderRadius: "8px", background: "transparent", color: "#888", border: "none", marginTop: "10px", cursor: "pointer", fontSize: "16px" }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>{selectedLib ? selectedLib.nombre : "Mis Colecciones"}</h1>
        <p style={s.subtitle}>{selectedLib ? "Toca un molde para leerlo o editarlo" : "Organiza tus moldes por carpetas o busca en todo"}</p>
      </div>

      <input 
        style={s.searchBar} 
        placeholder={selectedLib ? "Buscar en esta colección..." : "Buscar molde en TODAS las carpetas..."} 
        value={search} 
        onChange={(e) => setSearch(e.target.value)} 
      />

      {selectedLib && (
        <button 
          onClick={() => { setSelectedLib(null); setSearch(""); }} 
          style={{ background: "none", border: "none", color: "#d4af37", fontSize: "16px", padding: 0, marginBottom: "20px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
        >
          ← Volver a Colecciones
        </button>
      )}

      {/* VISTA 1: CARPETAS O BÚSQUEDA GLOBAL */}
      {!selectedLib && (
        <>
          {search.trim() === "" ? (
            // Mostrar carpetas
            <>
              {!showNewLib ? (
                <button style={s.btnAddLib} onClick={() => { setEditingLib(null); setNewLibName(""); setShowNewLib(true); }}>+ Nueva Colección</button>
              ) : (
                <div style={{ marginBottom: "20px" }}>
                  <input autoFocus style={s.inputNewLib} placeholder="Nombre de la carpeta..." value={newLibName} onChange={(e) => setNewLibName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveLibrary()} />
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button style={{ ...s.btnIcon, background: "#d4af37", color: "#000", padding: "12px" }} onClick={handleSaveLibrary}>{editingLib ? "Actualizar" : "Guardar"}</button>
                    <button style={{ ...s.btnIcon, padding: "12px" }} onClick={() => { setShowNewLib(false); setEditingLib(null); setNewLibName(""); }}>Cancelar</button>
                  </div>
                </div>
              )}

              <div style={s.grid}>
                {filteredLibs.map((lib) => (
                  <div key={lib.id} style={s.folderCard} onClick={() => setSelectedLib(lib)}>
                    <div style={s.folderIcon}>📁</div>
                    <div style={{ fontWeight: "bold", color: "#eee", fontSize: "15px" }}>{lib.nombre}</div>
                    <div style={s.folderActions}>
                      <button onClick={(e) => handleEditLibrary(e, lib)} style={{ background: "none", border: "none", color: "#d4af37", cursor: "pointer", fontSize: "14px" }}>✏️</button>
                      <button onClick={(e) => handleDeleteLibrary(e, lib)} style={{ background: "none", border: "none", color: "#f0b0b0", cursor: "pointer", fontSize: "14px" }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            // Mostrar resultados de búsqueda global
            <div style={s.grid}>
              {globalResults.map((molde) => (
                <div key={molde.id} style={s.moldCard}>
                  <div style={s.moldNum}>{molde.numero}</div>
                  <div style={{ fontSize: "11px", color: "#d4af37", marginBottom: "5px" }}>📁 {molde.nombre_libreria}</div>
                  <div style={s.moldText}>{molde.texto || "Sin texto"}</div>
                  <div style={s.moldActions}>
                    <button style={s.btnIcon} onClick={() => { setEditing(molde); setNumero(molde.numero || ""); setTexto(molde.texto || ""); setModalOpen(true); }}>✏️ Editar</button>
                    <button style={s.btnDanger} onClick={() => handleDeleteMold(molde.id, true)}>🗑️</button>
                  </div>
                </div>
              ))}
              {globalResults.length === 0 && <p style={{ color: "#666" }}>No se encontraron moldes con esa búsqueda.</p>}
            </div>
          )}
        </>
      )}

      {/* VISTA 2: MOLDES DENTRO DE UNA CARPETA */}
      {selectedLib && (
        <>
          <div style={s.grid}>
            {filteredMolds.map((molde) => (
              <div key={molde.id} style={s.moldCard}>
                <div style={s.moldNum}>{molde.numero}</div>
                <div style={s.moldText}>{molde.texto || "Sin texto"}</div>
                <div style={s.moldActions}>
                  <button style={s.btnIcon} onClick={() => { setEditing(molde); setNumero(molde.numero || ""); setTexto(molde.texto || ""); setModalOpen(true); }}>✏️ Leer / Editar</button>
                  <button style={s.btnDanger} onClick={() => handleDeleteMold(molde.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
          {filteredMolds.length === 0 && <p style={{ color: "#666", textAlign: "center", marginTop: "30px" }}>No hay moldes guardados aquí todavía.</p>}
        </>
      )}

      {selectedLib && (
        <button style={s.fab} onClick={() => { setEditing(null); setNumero(""); setTexto(""); setModalOpen(true); }}>+</button>
      )}

      {/* MODAL DE MOLDE */}
      {modalOpen && (
        <div style={s.modalBg} onClick={() => setModalOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#d4af37", margin: "0 0 15px 0", fontFamily: "serif", fontSize: "24px" }}>
              {editing ? "Detalles del Molde" : "Nuevo Molde"}
            </h2>

            {!editing && (
              <div style={s.btnScan} onClick={() => fileInputRef.current?.click()}>
                {scanning ? "⏳ Extrayendo texto..." : "📷 Tomar Foto o Subir Imagen"}
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
              </div>
            )}

            <label style={s.label}>NÚMERO O NOMBRE DEL MOLDE</label>
            <input style={s.input} placeholder="Ej. 45, Perito 8x6..." value={numero} onChange={(e) => setNumero(e.target.value)} />

            <label style={s.label}>TEXTO (EDITABLE)</label>
            <textarea style={s.textarea} placeholder="El texto aparecerá aquí..." value={texto} onChange={(e) => setTexto(e.target.value)} />

            <button style={s.btnSave} onClick={handleSaveMold} disabled={saving || scanning}>
              {saving ? "Guardando..." : "💾 Guardar en Base de Datos"}
            </button>
            <button style={s.btnCancel} onClick={() => setModalOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}