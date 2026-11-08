import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function Moldes() {
  const [libraries, setLibraries] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null); // null = viendo carpetas
  const [molds, setMolds] = useState([]);
  const [search, setSearch] = useState("");
  
  // Estados para crear carpeta
  const [newLibName, setNewLibName] = useState("");
  const [showNewLib, setShowNewLib] = useState(false);
  
  // Estados para el Modal de Molde (Crear/Editar)
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = creando uno nuevo
  const [numero, setNumero] = useState("");
  const [texto, setTexto] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadLibraries = async () => {
    try {
      const r = await api.get("/api/libraries");
      setLibraries(r.data);
    } catch (error) {
      showToast("Error al cargar carpetas", "error");
    }
  };

  useEffect(() => { loadLibraries(); }, []);

  const loadMolds = async () => {
    if (!selectedLib) return;
    try {
      const r = await api.get(`/api/libraries/${selectedLib.id}/molds`);
      setMolds(r.data);
    } catch (error) {
      showToast("Error al cargar moldes", "error");
    }
  };

  useEffect(() => { loadMolds(); }, [selectedLib]);

  // --- CREAR CARPETA ---
  const handleCreateLibrary = async () => {
    if (!newLibName.trim()) return;
    try {
      await api.post("/api/libraries", { nombre: newLibName });
      setNewLibName("");
      setShowNewLib(false);
      await loadLibraries();
      showToast("Carpeta creada", "success");
    } catch (error) {
      showToast("Error al crear carpeta", "error");
    }
  };

  // --- CREAR O EDITAR MOLDE ---
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
      const r = await api.post("/api/molds/scan", formData, { headers: { "Content-Type": "multipart/form-data" } });
      if (r.data?.texto) {
        setTexto(r.data.texto);
        showToast("Texto extraído", "success");
      }
    } catch (error) {
      showToast("Error al escanear imagen", "error");
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!numero.trim()) return showToast("Escribe un número o nombre", "error");
    
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/molds/${editing.id}`, { numero, texto });
        showToast("Molde actualizado", "success");
      } else {
        if (!selectedLib) throw new Error("No hay carpeta seleccionada");
        await api.post("/api/molds", { libreria_id: selectedLib.id, numero, texto });
        showToast("Molde guardado", "success");
      }
      await loadMolds();
      closeModal();
    } catch (error) {
      showToast("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que quieres borrar este molde?")) return;
    try {
      await api.delete(`/api/molds/${id}`);
      await loadMolds();
      showToast("Molde borrado", "success");
    } catch (error) {
      showToast("Error al borrar", "error");
    }
  };

  // --- BÚSQUEDA GLOBAL ---
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

  // ====== ESTILOS ======
  const s = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px", fontFamily: "sans-serif", paddingBottom: "100px" },
    header: { marginBottom: "20px" },
    title: { fontSize: "28px", fontFamily: "serif", color: "#fff", margin: "0 0 5px 0" },
    subtitle: { color: "#888", fontSize: "14px", margin: 0 },
    
    searchBar: { width: "100%", padding: "12px 15px", borderRadius: "10px", border: "1px solid #333", background: "#151515", color: "#fff", marginBottom: "20px", boxSizing: "border-box", fontSize: "16px" },
    
    // Botón Nueva Carpeta
    btnAddLib: { background: "transparent", color: "#d4af37", border: "1px dashed #d4af37", padding: "12px", borderRadius: "10px", width: "100%", cursor: "pointer", marginBottom: "20px", fontWeight: "bold" },
    inputNewLib: { width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #d4af37", background: "#151515", color: "#fff", marginBottom: "10px", boxSizing: "border-box" },

    // Grid de Carpetas y Moldes
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "15px" },
    folderCard: { background: "linear-gradient(145deg, #1a1a1a, #111)", border: "1px solid #333", borderRadius: "12px", padding: "20px 15px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", transition: "0.2s" },
    folderIcon: { fontSize: "30px", marginBottom: "10px" },
    
    // Grid de Moldes
    moldCard: { background: "#151515", border: "1px solid #222", borderRadius: "12px", padding: "15px", display: "flex", flexDirection: "column" },
    moldNum: { color: "#d4af37", fontWeight: "bold", fontSize: "18px", fontFamily: "serif", marginBottom: "8px" },
    moldText: { color: "#aaa", fontSize: "12px", whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", marginBottom: "15px" },
    moldActions: { display: "flex", gap: "8px", marginTop: "auto" },
    
    // Botones
    btnIcon: { background: "#222", border: "none", color: "#fff", padding: "6px", borderRadius: "6px", cursor: "pointer", flex: 1, fontSize: "12px" },
    btnDanger: { background: "#3a1a1a", border: "none", color: "#f0b0b0", padding: "6px", borderRadius: "6px", cursor: "pointer", flex: 1, fontSize: "12px" },
    
    // Botón flotante
    fab: { position: "fixed", bottom: "80px", right: "20px", width: "60px", height: "60px", borderRadius: "30px", background: "#d4af37", color: "#000", fontSize: "30px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 15px rgba(212, 175, 55, 0.4)", cursor: "pointer", zIndex: 90 },
    
    // Modal
    modalBg: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
    modal: { background: "#151515", padding: "20px", borderTopLeftRadius: "20px", borderTopRightRadius: "20px", width: "100%", maxWidth: "500px", borderTop: "1px solid #333" },
    label: { fontSize: "12px", color: "#888", marginBottom: "5px", display: "block", marginTop: "15px" },
    input: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box" },
    textarea: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", minHeight: "120px", boxSizing: "border-box", fontFamily: "inherit" },
    btnScan: { width: "100%", padding: "15px", borderRadius: "8px", border: "2px dashed #d4af37", background: "rgba(212,175,55,0.1)", color: "#d4af37", fontWeight: "bold", cursor: "pointer", marginTop: "15px", textAlign: "center" },
    btnSave: { width: "100%", padding: "15px", borderRadius: "8px", background: "#d4af37", color: "#000", fontWeight: "bold", border: "none", marginTop: "20px", cursor: "pointer" },
    btnCancel: { width: "100%", padding: "15px", borderRadius: "8px", background: "transparent", color: "#888", border: "none", marginTop: "10px", cursor: "pointer" },
    
    toast: { position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: "#d4af37", color: "#000", padding: "10px 20px", borderRadius: "20px", fontWeight: "bold", zIndex: 200, boxShadow: "0 4px 10px rgba(0,0,0,0.5)" }
  };

  return (
    <div style={s.page}>
      
      {/* HEADER */}
      <div style={s.header}>
        <h1 style={s.title}>{selectedLib ? selectedLib.nombre : "Mis Colecciones"}</h1>
        <p style={s.subtitle}>{selectedLib ? "Toca un molde para verlo o editarlo" : "Organiza tus moldes por carpetas"}</p>
      </div>

      {/* BUSCADOR GLOBAL */}
      <input 
        style={s.searchBar} 
        placeholder={selectedLib ? "Buscar en esta colección..." : "Buscar carpeta..."} 
        value={search} 
        onChange={(e) => setSearch(e.target.value)} 
      />

      {/* BOTÓN VOLVER (Si estamos dentro de una carpeta) */}
      {selectedLib && (
        <button 
          onClick={() => { setSelectedLib(null); setSearch(""); }} 
          style={{ background: "none", border: "none", color: "#d4af37", fontSize: "16px", padding: 0, marginBottom: "20px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
        >
          ← Volver a Colecciones
        </button>
      )}

      {/* VISTA 1: CARPETAS */}
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
                <button style={{ ...s.btnIcon, background: "#d4af37", color: "#000", padding: "10px" }} onClick={handleCreateLibrary}>Guardar</button>
                <button style={{ ...s.btnIcon, padding: "10px" }} onClick={() => setShowNewLib(false)}>Cancelar</button>
              </div>
            </div>
          )}

          <div style={s.grid}>
            {filteredLibs.map((lib) => (
              <div 
                key={lib.id} 
                style={s.folderCard}
                onClick={() => setSelectedLib(lib)}
              >
                <div style={s.folderIcon}>📁</div>
                <div style={{ fontWeight: "bold", color: "#eee" }}>{lib.nombre}</div>
              </div>
            ))}
          </div>
          {filteredLibs.length === 0 && <p style={{ color: "#666", textAlign: "center", marginTop: "30px" }}>No hay colecciones aquí.</p>}
        </>
      )}

      {/* VISTA 2: MOLDES DENTRO DE LA CARPETA */}
      {selectedLib && (
        <>
          <div style={s.grid}>
            {filteredMolds.map((molde) => (
              <div key={molde.id} style={s.moldCard}>
                <div style={s.moldNum}>{molde.numero}</div>
                <div style={s.moldText}>{molde.texto || "Sin texto"}</div>
                <div style={s.moldActions}>
                  <button style={s.btnIcon} onClick={() => openEditMoldModal(molde)}>✏️ Editar</button>
                  <button style={s.btnDanger} onClick={() => handleDelete(molde.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
          {filteredMolds.length === 0 && <p style={{ color: "#666", textAlign: "center", marginTop: "30px" }}>No hay moldes guardados aquí todavía.</p>}
        </>
      )}

      {/* BOTÓN FLOTANTE (Solo aparece si estás dentro de una carpeta) */}
      {selectedLib && (
        <button style={s.fab} onClick={openNewMoldModal}>+</button>
      )}

      {/* MODAL PARA ESCANEAR / EDITAR */}
      {modalOpen && (
        <div style={s.modalBg} onClick={closeModal}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#d4af37", margin: "0 0 15px 0", fontFamily: "serif" }}>
              {editing ? "Editar Molde" : "Nuevo Molde"}
            </h2>

            {!editing && (
              <div style={s.btnScan} onClick={() => fileInputRef.current?.click()}>
                {scanning ? "⏳ Extrayendo texto..." : "📷 Tomar Foto o Subir Imagen"}
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
              </div>
            )}

            <label style={s.label}>NÚMERO O NOMBRE</label>
            <input 
              style={s.input} 
              placeholder="Ej. 45, Perito 8x6..." 
              value={numero} 
              onChange={(e) => setNumero(e.target.value)} 
            />

            <label style={s.label}>TEXTO EXTRAÍDO (EDITABLE)</label>
            <textarea 
              style={s.textarea} 
              placeholder="El texto de la foto aparecerá aquí..." 
              value={texto} 
              onChange={(e) => setTexto(e.target.value)} 
            />

            <button style={s.btnSave} onClick={handleSave} disabled={saving || scanning}>
              {saving ? "Guardando..." : "💾 Guardar Molde"}
            </button>
            <button style={s.btnCancel} onClick={closeModal}>Cancelar</button>
          </div>
        </div>
      )}

      {toast && <div style={s.toast}>{toast.msg}</div>}
    </div>
  );
}