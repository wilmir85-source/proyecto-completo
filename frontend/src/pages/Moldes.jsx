import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "@/lib/api"; // <--- Conexión a tu base de datos
import { toast } from "sonner";

export default function Moldes() {
  const [libraries, setLibraries] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null); 
  const [molds, setMolds] = useState([]);
  const [search, setSearch] = useState("");
  
  const [newLibName, setNewLibName] = useState("");
  const [showNewLib, setShowNewLib] = useState(false);
  
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
      console.error(error);
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

  useEffect(() => { loadMolds(); }, [loadMolds]);

  const handleCreateLibrary = async () => {
    if (!newLibName.trim()) return;
    try {
      await api.post("/libraries", { nombre: newLibName });
      setNewLibName("");
      setShowNewLib(false);
      await loadLibraries();
      toast.success("Colección creada");
    } catch (error) {
      toast.error("Error al crear colección");
    }
  };

  const openNewMoldModal = () => {
    setEditing(null);
    setNumero("");
    setTexto("");
    setModalOpen(true);
  };

  const openEditMoldModal = (molde) => {
    setEditing(molde);
    setNumero(molde.numero || "");
    setTexto(molde.texto || "");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving || scanning) return;
    setModalOpen(false);
    setNumero("");
    setTexto("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await api.post("/molds/scan", formData, { headers: { "Content-Type": "multipart/form-data" } });
      if (r.data?.texto) {
        setTexto(r.data.texto);
        toast.success("Texto extraído con éxito");
      }
    } catch (error) {
      toast.error("Error al escanear imagen");
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!numero.trim()) return toast.error("Escribe un número o nombre para identificarlo");
    
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/molds/${editing.id}`, { numero, texto });
        toast.success("Molde actualizado");
      } else {
        if (!selectedLib) throw new Error("No hay colección seleccionada");
        await api.post("/molds", { libreria_id: selectedLib.id, numero, texto });
        toast.success("Molde guardado en la base de datos");
      }
      await loadMolds();
      closeModal();
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que quieres borrar este molde de la base de datos?")) return;
    try {
      await api.delete(`/molds/${id}`);
      await loadMolds();
      toast.success("Molde borrado");
    } catch (error) {
      toast.error("Error al borrar");
    }
  };

  const filteredMolds = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return molds;
    return molds.filter(
      (m) => (m.numero || "").toLowerCase().includes(q) || (m.texto || "").toLowerCase().includes(q)
    );
  }, [molds, search]);

  const filteredLibs = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return libraries;
    return libraries.filter((l) => (l.nombre || "").toLowerCase().includes(q));
  }, [libraries, search]);

  const s = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px", fontFamily: "sans-serif", paddingBottom: "100px" },
    header: { marginBottom: "20px" },
    title: { fontSize: "28px", fontFamily: "serif", color: "#fff", margin: "0 0 5px 0" },
    subtitle: { color: "#888", fontSize: "14px", margin: 0 },
    searchBar: { width: "100%", padding: "15px", borderRadius: "10px", border: "1px solid #333", background: "#151515", color: "#fff", marginBottom: "20px", boxSizing: "border-box", fontSize: "16px" },
    btnAddLib: { background: "transparent", color: "#d4af37", border: "1px dashed #d4af37", padding: "12px", borderRadius: "10px", width: "100%", cursor: "pointer", marginBottom: "20px", fontWeight: "bold" },
    inputNewLib: { width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #d4af37", background: "#151515", color: "#fff", marginBottom: "10px", boxSizing: "border-box" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "15px" },
    folderCard: { background: "linear-gradient(145deg, #1a1a1a, #111)", border: "1px solid #333", borderRadius: "12px", padding: "20px 15px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", transition: "0.2s" },
    folderIcon: { fontSize: "30px", marginBottom: "10px" },
    moldCard: { background: "#151515", border: "1px solid #222", borderRadius: "12px", padding: "15px", display: "flex", flexDirection: "column" },
    moldNum: { color: "#d4af37", fontWeight: "bold", fontSize: "20px", fontFamily: "serif", marginBottom: "8px" },
    // AQUI ESTA LA LETRA MAS GRANDE:
    moldText: { color: "#ddd", fontSize: "14px", lineHeight: "1.4", whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", marginBottom: "15px" },
    moldActions: { display: "flex", gap: "8px", marginTop: "auto" },
    btnIcon: { background: "#222", border: "none", color: "#fff", padding: "8px", borderRadius: "6px", cursor: "pointer", flex: 1, fontSize: "13px" },
    btnDanger: { background: "#3a1a1a", border: "none", color: "#f0b0b0", padding: "8px", borderRadius: "6px", cursor: "pointer", flex: 1, fontSize: "13px" },
    fab: { position: "fixed", bottom: "80px", right: "20px", width: "60px", height: "60px", borderRadius: "30px", background: "#d4af37", color: "#000", fontSize: "30px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 15px rgba(212, 175, 55, 0.4)", cursor: "pointer", zIndex: 90 },
    modalBg: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
    modal: { background: "#151515", padding: "25px 20px", borderTopLeftRadius: "20px", borderTopRightRadius: "20px", width: "100%", maxWidth: "500px", borderTop: "1px solid #333", maxHeight: "90vh", overflowY: "auto" },
    label: { fontSize: "13px", color: "#aaa", marginBottom: "8px", display: "block", marginTop: "15px", fontWeight: "bold" },
    input: { width: "100%", padding: "15px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box", fontSize: "16px" },
    textarea: { width: "100%", padding: "15px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", minHeight: "180px", boxSizing: "border-box", fontFamily: "inherit", fontSize: "16px", lineHeight: "1.5" },
    btnScan: { width: "100%", padding: "15px", borderRadius: "8px", border: "2px dashed #d4af37", background: "rgba(212,175,55,0.1)", color: "#d4af37", fontWeight: "bold", cursor: "pointer", marginTop: "15px", textAlign: "center" },
    btnSave: { width: "100%", padding: "16px", borderRadius: "8px", background: "#d4af37", color: "#000", fontWeight: "bold", border: "none", marginTop: "25px", cursor: "pointer", fontSize: "16px" },
    btnCancel: { width: "100%", padding: "16px", borderRadius: "8px", background: "transparent", color: "#888", border: "none", marginTop: "10px", cursor: "pointer", fontSize: "16px" }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>{selectedLib ? selectedLib.nombre : "Mis Colecciones"}</h1>
        <p style={s.subtitle}>{selectedLib ? "Toca un molde para leerlo o editarlo" : "Organiza tus moldes por carpetas"}</p>
      </div>

      <input 
        style={s.searchBar} 
        placeholder={selectedLib ? "Buscar por número o texto..." : "Buscar carpeta..."} 
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

      {!selectedLib && (
        <>
          {!showNewLib ? (
            <button style={s.btnAddLib} onClick={() => setShowNewLib(true)}>+ Nueva Colección</button>
          ) : (
            <div style={{ marginBottom: "20px" }}>
              <input 
                autoFocus
                style={s.inputNewLib} 
                placeholder="Ej. Anillos, Dijes..." 
                value={newLibName} 
                onChange={(e) => setNewLibName(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleCreateLibrary()}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                <button style={{ ...s.btnIcon, background: "#d4af37", color: "#000", padding: "12px" }} onClick={handleCreateLibrary}>Guardar</button>
                <button style={{ ...s.btnIcon, padding: "12px" }} onClick={() => setShowNewLib(false)}>Cancelar</button>
              </div>
            </div>
          )}

          <div style={s.grid}>
            {filteredLibs.map((lib) => (
              <div key={lib.id} style={s.folderCard} onClick={() => setSelectedLib(lib)}>
                <div style={s.folderIcon}>📁</div>
                <div style={{ fontWeight: "bold", color: "#eee", fontSize: "15px" }}>{lib.nombre}</div>
              </div>
            ))}
          </div>
          {filteredLibs.length === 0 && <p style={{ color: "#666", textAlign: "center", marginTop: "30px" }}>No hay colecciones aquí.</p>}
        </>
      )}

      {selectedLib && (
        <>
          <div style={s.grid}>
            {filteredMolds.map((molde) => (
              <div key={molde.id} style={s.moldCard}>
                <div style={s.moldNum}>{molde.numero}</div>
                <div style={s.moldText}>{molde.texto || "Sin texto"}</div>
                <div style={s.moldActions}>
                  <button style={s.btnIcon} onClick={() => openEditMoldModal(molde)}>✏️ Leer / Editar</button>
                  <button style={s.btnDanger} onClick={() => handleDelete(molde.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
          {filteredMolds.length === 0 && <p style={{ color: "#666", textAlign: "center", marginTop: "30px" }}>No hay moldes guardados aquí todavía.</p>}
        </>
      )}

      {selectedLib && (
        <button style={s.fab} onClick={openNewMoldModal}>+</button>
      )}

      {modalOpen && (
        <div style={s.modalBg} onClick={closeModal}>
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

            <label style={s.label}>TEXTO (LECTURA CLARA)</label>
            <textarea style={s.textarea} placeholder="El texto de la foto aparecerá aquí..." value={texto} onChange={(e) => setTexto(e.target.value)} />

            <button style={s.btnSave} onClick={handleSave} disabled={saving || scanning}>
              {saving ? "Guardando..." : "💾 Guardar en Base de Datos"}
            </button>
            <button style={s.btnCancel} onClick={closeModal}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}