import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function Moldes() {
  const [libraries, setLibraries] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null);
  const [molds, setMolds] = useState([]);
  const [search, setSearch] = useState("");
  
  // Estados para el modal de molde
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ numero: "", tipo: "", carrera: "", medida: "", notas: "" });
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const loadLibraries = useCallback(async () => {
    try {
      const r = await api.get("/libraries");
      setLibraries(r.data);
    } catch { toast.error("Error al cargar carpetas"); }
  }, []);

  useEffect(() => { loadLibraries(); }, [loadLibraries]);

  const loadMolds = useCallback(async () => {
    if (!selectedLib) return;
    try {
      const r = await api.get(`/libraries/${selectedLib.id}/molds`);
      setMolds(r.data);
    } catch { toast.error("Error al cargar moldes"); }
  }, [selectedLib]);

  useEffect(() => { loadMolds(); }, [selectedLib, loadMolds]);

  // --- ACCIONES DE MOLDES ---
  const openNewModal = () => {
    setEditing(null);
    setFormData({ numero: "", tipo: "", carrera: "", medida: "", notas: "" });
    setModalOpen(true);
  };

  const openEditModal = (molde) => {
    setEditing(molde);
    setFormData({
      numero: molde.numero || "",
      tipo: molde.tipo || "",
      carrera: molde.carrera || "",
      medida: molde.medida || "",
      notas: molde.notas || "",
    });
    setModalOpen(true);
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
        setFormData({
          numero: d.numero || "",
          tipo: d.tipo || "",
          carrera: d.carrera || "",
          medida: d.medida || "",
          notas: d.notas || "",
        });
        toast.success("Datos extraídos. Puedes corregirlos antes de guardar.");
      }
    } catch { toast.error("Error al escanear imagen"); } 
    finally { setScanning(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.numero.trim()) return toast.error("El número es obligatorio");
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/molds/${editing.id}`, formData);
        toast.success("Molde actualizado");
      } else {
        await api.post("/molds", { libreria_id: selectedLib.id, ...formData });
        toast.success("Molde creado correctamente");
      }
      await loadMolds();
      setModalOpen(false);
    } catch { toast.error("Error al guardar"); } 
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Borrar este molde?")) return;
    try {
      await api.delete(`/molds/${id}`);
      await loadMolds();
      toast.success("Molde borrado");
    } catch { toast.error("Error al borrar"); }
  };

  // Filtro local
  const filteredMolds = useMemo(() => {
    const q = search.toLowerCase();
    return molds.filter(m => 
      (m.numero || "").toLowerCase().includes(q) ||
      (m.tipo || "").toLowerCase().includes(q) ||
      (m.carrera || "").toLowerCase().includes(q) ||
      (m.medida || "").toLowerCase().includes(q)
    );
  }, [molds, search]);

  // --- ESTILOS DE TABLA ---
  const s = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px", fontFamily: "sans-serif", paddingBottom: "100px" },
    title: { fontSize: "28px", fontFamily: "serif", color: "#fff", margin: "0 0 5px 0" },
    searchBar: { width: "100%", padding: "15px", borderRadius: "10px", border: "1px solid #333", background: "#151515", color: "#fff", marginBottom: "20px", boxSizing: "border-box", fontSize: "16px" },
    btnPrimary: { background: "#d4af37", color: "#000", border: "none", padding: "12px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" },
    btnSecondary: { background: "#222", color: "#fff", border: "1px solid #444", padding: "12px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" },
    tableWrapper: { overflowX: "auto", background: "#111", borderRadius: "12px", border: "1px solid #333" },
    table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
    th: { padding: "15px", borderBottom: "1px solid #333", color: "#888", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" },
    td: { padding: "15px", borderBottom: "1px solid #222", fontSize: "14px", color: "#ddd" },
    badge: { background: "#222", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", color: "#d4af37" },
    actionBtn: { background: "none", border: "none", cursor: "pointer", fontSize: "16px", marginRight: "10px" },
    modalBg: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" },
    modal: { background: "#151515", padding: "25px", borderRadius: "16px", width: "100%", maxWidth: "600px", border: "1px solid #333", maxHeight: "90vh", overflowY: "auto" },
    label: { fontSize: "12px", color: "#aaa", marginBottom: "6px", display: "block", marginTop: "15px", fontWeight: "bold" },
    input: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box", fontSize: "15px" },
    row: { display: "flex", gap: "15px" },
    col: { flex: 1 },
    btnScan: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px dashed #d4af37", background: "rgba(212,175,55,0.05)", color: "#d4af37", fontWeight: "bold", cursor: "pointer", marginBottom: "20px", textAlign: "center" },
  };

  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={s.title}>{selectedLib ? selectedLib.nombre : "Mis Colecciones"}</h1>
          <p style={{ color: "#888", fontSize: "14px", margin: 0 }}>{selectedLib ? "Listado de moldes" : "Selecciona una carpeta"}</p>
        </div>
        {selectedLib && (
          <button style={s.btnPrimary} onClick={openNewModal}>+ Nuevo Molde</button>
        )}
      </div>

      {/* BUSCADOR */}
      <input 
        style={s.searchBar} 
        placeholder={selectedLib ? "Buscar por número, tipo, carrera..." : "Buscar carpeta..."} 
        value={search} 
        onChange={(e) => setSearch(e.target.value)} 
      />

      {/* VOLVER */}
      {selectedLib && (
        <button 
          onClick={() => { setSelectedLib(null); setSearch(""); }} 
          style={{ background: "none", border: "none", color: "#d4af37", fontSize: "16px", padding: 0, marginBottom: "20px", cursor: "pointer" }}
        >
          ← Volver a Colecciones
        </button>
      )}

      {/* VISTA: CARPETAS */}
      {!selectedLib && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "15px" }}>
          {libraries.map((lib) => (
            <div key={lib.id} style={{ background: "#151515", border: "1px solid #333", borderRadius: "12px", padding: "20px", cursor: "pointer", textAlign: "center" }} onClick={() => setSelectedLib(lib)}>
              <div style={{ fontSize: "30px", marginBottom: "10px" }}>📁</div>
              <div style={{ fontWeight: "bold" }}>{lib.nombre}</div>
            </div>
          ))}
        </div>
      )}

      {/* VISTA: TABLA DE MOLDES DENTRO DE LA CARPETA */}
      {selectedLib && (
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>N° Molde</th>
                <th style={s.th}>Tipo</th>
                <th style={s.th}>Carrera / Diseño</th>
                <th style={s.th}>Medida</th>
                <th style={s.th}>Notas</th>
                <th style={s.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredMolds.map((m) => (
                <tr key={m.id}>
                  <td style={s.td}><span style={s.badge}>{m.numero}</span></td>
                  <td style={s.td}>{m.tipo || "-"}</td>
                  <td style={s.td}>{m.carrera || "-"}</td>
                  <td style={s.td}>{m.medida || "-"}</td>
                  <td style={s.td}>{m.notas || "-"}</td>
                  <td style={s.td}>
                    <button style={s.actionBtn} onClick={() => openEditModal(m)}>✏️</button>
                    <button style={s.actionBtn} onClick={() => handleDelete(m.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMolds.length === 0 && <p style={{ textAlign: "center", padding: "20px", color: "#666" }}>No hay moldes. Crea uno nuevo.</p>}
        </div>
      )}

      {/* MODAL DE CREACIÓN / EDICIÓN */}
      {modalOpen && (
        <div style={s.modalBg} onClick={() => setModalOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#d4af37", margin: "0 0 15px 0" }}>{editing ? "Editar Molde" : "Nuevo Molde"}</h2>
            
            {!editing && (
              <div style={s.btnScan} onClick={() => fileInputRef.current?.click()}>
                {scanning ? "⏳ Extrayendo..." : "📷 Escanear Foto (Opcional)"}
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
              </div>
            )}

            <form onSubmit={handleSave}>
              <div style={s.row}>
                <div style={s.col}>
                  <label style={s.label}>Número de Molde</label>
                  <input style={s.input} required placeholder="Ej. 45" value={formData.numero} onChange={(e) => setFormData({...formData, numero: e.target.value})} />
                </div>
                <div style={s.col}>
                  <label style={s.label}>Tipo de Joya</label>
                  <input style={s.input} placeholder="Ej. Anillo, Dije..." value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value})} />
                </div>
              </div>

              <label style={s.label}>Carrera / Diseño</label>
              <input style={s.input} placeholder="Ej. Perito Contador Octagonal" value={formData.carrera} onChange={(e) => setFormData({...formData, carrera: e.target.value})} />

              <div style={s.row}>
                <div style={s.col}>
                  <label style={s.label}>Medida</label>
                  <input style={s.input} placeholder="Ej. 10x8" value={formData.medida} onChange={(e) => setFormData({...formData, medida: e.target.value})} />
                </div>
                <div style={s.col}>
                  <label style={s.label}>Notas</label>
                  <input style={s.input} placeholder="Ej. Aníbal González" value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "25px" }}>
                <button type="submit" style={{ ...s.btnPrimary, flex: 1 }} disabled={saving}>{saving ? "Guardando..." : "💾 Guardar Molde"}</button>
                <button type="button" style={{ ...s.btnSecondary, flex: 1 }} onClick={() => setModalOpen(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}