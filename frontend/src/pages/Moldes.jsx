import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";

// Ajusta esto si tu API está en otra dirección
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function Moldes() {
  const [libraries, setLibraries] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null);
  const [molds, setMolds] = useState([]);
  const [search, setSearch] = useState("");
  
  // Para crear carpeta
  const [newLibName, setNewLibName] = useState("");
  
  // Para el formulario de molde
  const [numero, setNumero] = useState("");
  const [texto, setTexto] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Para el modal de editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Cargar carpetas al iniciar
  const loadLibraries = async () => {
    try {
      const r = await api.get("/api/libraries");
      setLibraries(r.data);
      if (r.data.length > 0 && !selectedLib) {
        setSelectedLib(r.data[0]); // Selecciona la primera por defecto
      }
    } catch (error) {
      showToast("Error al cargar carpetas", "error");
    }
  };

  useEffect(() => {
    loadLibraries();
  }, []);

  // 2. Cargar moldes cuando cambia la carpeta seleccionada
  const loadMolds = async () => {
    if (!selectedLib) return;
    try {
      const r = await api.get(`/api/libraries/${selectedLib.id}/molds`);
      setMolds(r.data);
    } catch (error) {
      showToast("Error al cargar moldes", "error");
    }
  };

  useEffect(() => {
    loadMolds();
  }, [selectedLib]);

  // 3. Crear una nueva carpeta
  const handleCreateLibrary = async () => {
    if (!newLibName.trim()) return;
    try {
      const r = await api.post("/api/libraries", { nombre: newLibName });
      setNewLibName("");
      await loadLibraries();
      setSelectedLib(r.data); // Entra a la carpeta recién creada
      showToast("Carpeta creada", "success");
    } catch (error) {
      showToast("Error al crear carpeta", "error");
    }
  };

  // 4. Escanear foto con Gemini
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await api.post("/api/molds/scan", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
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

  // 5. Guardar molde (Nuevo)
  const handleSaveNew = async () => {
    if (!numero.trim()) return showToast("Falta el número", "error");
    if (!selectedLib) return showToast("Selecciona una carpeta", "error");
    
    setSaving(true);
    try {
      await api.post("/api/molds", {
        libreria_id: selectedLib.id,
        numero,
        texto,
      });
      setNumero("");
      setTexto("");
      await loadMolds();
      showToast("Molde guardado", "success");
    } catch (error) {
      showToast("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  // 6. Actualizar molde (Editar)
  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/api/molds/${editing.id}`, { numero, texto });
      await loadMolds();
      setModalOpen(false);
      showToast("Molde actualizado", "success");
    } catch (error) {
      showToast("Error al actualizar", "error");
    } finally {
      setSaving(false);
    }
  };

  // 7. Borrar molde
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

  const openEditModal = (molde) => {
    setEditing(molde);
    setNumero(molde.numero || "");
    setTexto(molde.texto || "");
    setModalOpen(true);
  };

  // Filtro de búsqueda
  const filteredMolds = useMemo(() => {
    const q = search.toLowerCase();
    return molds.filter(
      (m) => (m.numero || "").toLowerCase().includes(q) || (m.texto || "").toLowerCase().includes(q)
    );
  }, [molds, search]);


  // ====== ESTILOS BÁSICOS (Manteniendo tu tema oscuro) ======
  const s = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px", fontFamily: "sans-serif", paddingBottom: "80px" },
    title: { fontSize: "32px", fontFamily: "serif", color: "#fff", marginBottom: "5px" },
    subtitle: { color: "#888", fontSize: "14px", marginBottom: "20px" },
    inputSearch: { width: "100%", padding: "12px 15px", borderRadius: "10px", border: "1px solid #333", background: "#111", color: "#fff", marginBottom: "20px", boxSizing: "border-box" },
    box: { background: "#111", border: "1px solid #222", borderRadius: "12px", padding: "15px", marginBottom: "15px" },
    boxTitle: { fontSize: "12px", color: "#d4af37", fontWeight: "bold", marginBottom: "10px", letterSpacing: "1px" },
    row: { display: "flex", gap: "10px" },
    input: { flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff" },
    btnGold: { background: "#d4af37", color: "#000", border: "none", padding: "12px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
    folderBtn: (active) => ({ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "15px", borderRadius: "10px", marginBottom: "10px", background: active ? "#222" : "#111", border: active ? "1px solid #d4af37" : "1px solid #222", color: active ? "#d4af37" : "#fff", cursor: "pointer", textAlign: "left" }),
    uploadBox: { border: "2px dashed #444", borderRadius: "10px", padding: "30px", textAlign: "center", cursor: "pointer", marginBottom: "15px" },
    card: { background: "#111", border: "1px solid #222", borderRadius: "12px", padding: "15px", marginBottom: "10px" },
    cardNum: { color: "#d4af37", fontWeight: "bold", fontSize: "18px", marginBottom: "5px" },
    cardText: { color: "#aaa", fontSize: "14px", whiteSpace: "pre-wrap", marginBottom: "15px" },
    cardActions: { display: "flex", gap: "10px" },
    btnSmall: { padding: "8px 12px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", background: "#333", color: "#fff" },
    btnDanger: { padding: "8px 12px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", background: "#3a1a1a", color: "#f0b0b0" },
    modalBg: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
    modal: { background: "#111", padding: "20px", borderRadius: "15px", width: "90%", maxWidth: "400px", border: "1px solid #333" },
    toast: { position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", background: "#d4af37", color: "#000", padding: "10px 20px", borderRadius: "20px", fontWeight: "bold", zIndex: 200 }
  };

  return (
    <div style={s.page}>
      <h1 style={s.title}>Archivo de Moldes</h1>
      <p style={s.subtitle}>Organiza tu inventario por carpetas.</p>

      <input 
        style={s.inputSearch} 
        placeholder="Buscar en las carpetas..." 
        value={search} 
        onChange={(e) => setSearch(e.target.value)} 
      />

      {/* CREAR NUEVA CARPETA */}
      <div style={s.box}>
        <div style={s.boxTitle}>NUEVA CARPETA</div>
        <div style={s.row}>
          <input 
            style={s.input} 
            placeholder="Ej. Peritos, Dijes..." 
            value={newLibName} 
            onChange={(e) => setNewLibName(e.target.value)} 
          />
          <button style={s.btnGold} onClick={handleCreateLibrary}>+</button>
        </div>
      </div>

      {/* LISTA DE CARPETAS */}
      {libraries.map((lib) => (
        <button 
          key={lib.id} 
          style={s.folderBtn(selectedLib?.id === lib.id)}
          onClick={() => setSelectedLib(lib)}
        >
          📁 {lib.nombre}
        </button>
      ))}

      {/* CONTENIDO DE LA CARPETA SELECCIONADA */}
      {selectedLib ? (
        <div style={{ marginTop: "30px" }}>
          <h2 style={{ color: "#d4af37", fontFamily: "serif", marginBottom: "20px" }}>
            📁 {selectedLib.nombre}
          </h2>

          {/* FORMULARIO PARA AGREGAR MOLDE */}
          <div style={s.box}>
            <div style={s.uploadBox} onClick={() => fileInputRef.current?.click()}>
              {scanning ? "⏳ Extrayendo texto..." : "📷 Subir Foto (Escanear)"}
            </div>
            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />

            <div style={s.boxTitle}>NÚMERO O NOMBRE DEL MOLDE</div>
            <input style={{ ...s.input, width: "100%", marginBottom: "15px" }} placeholder="Ej. 45, Perito 8x6..." value={numero} onChange={(e) => setNumero(e.target.value)} />

            <div style={s.boxTitle}>TEXTO EXTRAÍDO (EDITABLE)</div>
            <textarea 
              style={{ ...s.input, width: "100%", minHeight: "100px", marginBottom: "15px" }} 
              placeholder="El texto de la foto aparecerá aquí..." 
              value={texto} 
              onChange={(e) => setTexto(e.target.value)} 
            />

            <button style={{ ...s.btnGold, width: "100%" }} onClick={handleSaveNew} disabled={saving}>
              {saving ? "Guardando..." : "💾 Guardar Molde en esta Carpeta"}
            </button>
          </div>

          {/* LISTA DE MOLDES */}
          <h3 style={{ color: "#888", marginTop: "20px" }}>Moldes guardados:</h3>
          {filteredMolds.length === 0 ? (
            <p style={{ color: "#555" }}>No hay moldes aquí todavía.</p>
          ) : (
            filteredMolds.map((molde) => (
              <div key={molde.id} style={s.card}>
                <div style={s.cardNum}>{molde.numero}</div>
                <div style={s.cardText}>{molde.texto}</div>
                <div style={s.cardActions}>
                  <button style={s.btnSmall} onClick={() => openEditModal(molde)}>✏️ Editar</button>
                  <button style={s.btnDanger} onClick={() => handleDelete(molde.id)}>🗑️ Borrar</button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <p style={{ color: "#888", textAlign: "center", marginTop: "30px" }}>Crea o selecciona una carpeta arriba.</p>
      )}

      {/* MODAL DE EDICIÓN */}
      {modalOpen && (
        <div style={s.modalBg} onClick={() => setModalOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#d4af37", marginBottom: "15px" }}>Editar Molde</h2>
            
            <div style={s.boxTitle}>NÚMERO</div>
            <input style={{ ...s.input, width: "100%", marginBottom: "15px" }} value={numero} onChange={(e) => setNumero(e.target.value)} />
            
            <div style={s.boxTitle}>TEXTO</div>
            <textarea style={{ ...s.input, width: "100%", minHeight: "120px", marginBottom: "15px" }} value={texto} onChange={(e) => setTexto(e.target.value)} />
            
            <div style={{ display: "flex", gap: "10px" }}>
              <button style={{ ...s.btnSmall, flex: 1 }} onClick={() => setModalOpen(false)}>Cancelar</button>
              <button style={{ ...s.btnGold, flex: 1 }} onClick={handleUpdate} disabled={saving}>
                {saving ? "..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={s.toast}>{toast.msg}</div>}
    </div>
  );
}