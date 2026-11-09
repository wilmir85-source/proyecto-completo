import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function Moldes() {
  const [libraries, setLibraries] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null);
  const [molds, setMolds] = useState([]);
  const [search, setSearch] = useState("");
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ numero: "", tipo: "", carrera: "", medida: "", notas: "" });
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  // --- CARGA DE DATOS ---
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

  // --- MANEJO DEL MODAL ---
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

  // --- SIMULACIÓN DE PROGRESO ---
  useEffect(() => {
    let interval;
    if (scanning) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return prev; // Se queda en 95% hasta que termine
          return prev + Math.floor(Math.random() * 10) + 1;
        });
      }, 300);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [scanning]);

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
        toast.success("Datos extraídos. Revisa y guarda.");
      }
    } catch { toast.error("Error al escanear. Intenta de nuevo."); } 
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

  // --- EXPORTAR A PDF ---
  const exportToPDF = () => {
    if (!selectedLib) return;
    const doc = new jsPDF();
    doc.text(`Listado de Moldes: ${selectedLib.nombre}`, 14, 16);
    const tableData = filteredMolds.map(m => [m.numero, m.tipo, m.carrera, m.medida, m.notas]);
    doc.autoTable({
      head: [['N° Molde', 'Tipo', 'Carrera / Diseño', 'Medida', 'Notas']],
      body: tableData,
      startY: 22,
      styles: { fontSize: 8 },
    });
    doc.save(`Moldes_${selectedLib.nombre}.pdf`);
    toast.success("PDF descargado");
  };

  // --- FILTRO DE BÚSQUEDA ---
  const filteredMolds = useMemo(() => {
    const q = search.toLowerCase();
    return molds.filter(m => 
      (m.numero || "").toLowerCase().includes(q) ||
      (m.tipo || "").toLowerCase().includes(q) ||
      (m.carrera || "").toLowerCase().includes(q) ||
      (m.medida || "").toLowerCase().includes(q)
    );
  }, [molds, search]);

  // --- ESTILOS ---
  const s = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px", fontFamily: "sans-serif", paddingBottom: "100px" },
    title: { fontSize: "28px", fontFamily: "serif", color: "#fff", margin: "0 0 5px 0" },
    searchBar: { width: "100%", padding: "15px", borderRadius: "10px", border: "1px solid #333", background: "#151515", color: "#fff", marginBottom: "20px", boxSizing: "border-box", fontSize: "16px" },
    btnPrimary: { background: "#d4af37", color: "#000", border: "none", padding: "12px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" },
    btnSecondary: { background: "#222", color: "#fff", border: "1px solid #444", padding: "12px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" },
    tableWrapper: { overflowX: "auto", background: "#111", borderRadius: "12px", border: "1px solid #333" },
    table: { width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "600px" },
    th: { padding: "15px", borderBottom: "1px solid #333", color: "#d4af37", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" },
    td: { padding: "15px", borderBottom: "1px solid #222", fontSize: "14px", color: "#ddd" },
    badge: { background: "#333", padding: "4px 8px", borderRadius: "4px", fontSize: "13px", color: "#d4af37", fontWeight: "bold" },
    actionBtn: { background: "none", border: "none", cursor: "pointer", fontSize: "18px", marginRight: "10px" },
    // MODAL RESPONSIVE (pantalla completa en móvil)
    modalBg: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "10px" },
    modal: { background: "#151515", padding: "20px", borderRadius: "16px", width: "100%", maxWidth: "700px", border: "1px solid #333", maxHeight: "95vh", overflowY: "auto", display: "flex", flexDirection: "column" },
    label: { fontSize: "12px", color: "#aaa", marginBottom: "6px", display: "block", marginTop: "15px", fontWeight: "bold" },
    input: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box", fontSize: "15px" },
    textarea: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box", fontSize: "15px", minHeight: "120px", resize: "vertical", fontFamily: "inherit" },
    row: { display: "flex", gap: "15px" },
    col: { flex: 1 },
    btnScan: { width: "100%", padding: "15px", borderRadius: "8px", border: "1px dashed #d4af37", background: scanning ? "rgba(212,175,55,0.2)" : "rgba(212,175,55,0.05)", color: "#d4af37", fontWeight: "bold", cursor: scanning ? "wait" : "pointer", marginBottom: "20px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "10px", transition: "0.3s" },
    progressBar: { width: "100%", height: "6px", background: "#333", borderRadius: "3px", marginTop: "10px", overflow: "hidden" },
    progressFill: { height: "100%", background: "#d4af37", width: `${progress}%`, transition: "width 0.3s ease" },
    // EDICIÓN EN LÍNEA
    editableCell: { cursor: "pointer", padding: "8px", borderRadius: "4px", "&:hover": { background: "#222" } },
  };

  return (
    <div style={s.page}>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spinner { animation: spin 1s linear infinite; display: inline-block; }
        tr:hover { background-color: #1a1a1a; }
        .editable-cell:hover { background-color: #222; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={s.title}>{selectedLib ? selectedLib.nombre : "Mis Colecciones"}</h1>
          <p style={{ color: "#888", fontSize: "14px", margin: 0 }}>{selectedLib ? "Listado de moldes (Toca una fila para editar)" : "Selecciona una carpeta"}</p>
        </div>
        {selectedLib && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button style={s.btnSecondary} onClick={exportToPDF}>📄 PDF</button>
            <button style={s.btnPrimary} onClick={openNewModal}>+ Nuevo Molde</button>
          </div>
        )}
      </div>

      <input 
        style={s.searchBar} 
        placeholder={selectedLib ? "Buscar por número, tipo, carrera..." : "Buscar carpeta..."} 
        value={search} 
        onChange={(e) => setSearch(e.target.value)} 
      />

      {selectedLib && (
        <button 
          onClick={() => { setSelectedLib(null); setSearch(""); }} 
          style={{ background: "none", border: "none", color: "#d4af37", fontSize: "16px", padding: 0, marginBottom: "20px", cursor: "pointer" }}
        >
          ← Volver a Colecciones
        </button>
      )}

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
                <tr key={m.id} style={s.tr} onClick={() => openEditModal(m)}>
                  <td style={s.td}><span style={s.badge}>{m.numero}</span></td>
                  <td style={s.td}>{m.tipo || "-"}</td>
                  <td style={s.td}>{m.carrera || "-"}</td>
                  <td style={s.td}>{m.medida || "-"}</td>
                  <td style={s.td}>{m.notas || "-"}</td>
                  <td style={s.td}>
                    <button style={s.actionBtn} onClick={(e) => { e.stopPropagation(); openEditModal(m); }}>✏️</button>
                    <button style={s.actionBtn} onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMolds.length === 0 && <p style={{ textAlign: "center", padding: "20px", color: "#666" }}>No hay moldes. Crea uno nuevo con el botón de arriba.</p>}
        </div>
      )}

      {modalOpen && (
        <div style={s.modalBg} onClick={() => setModalOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#d4af37", margin: "0 0 15px 0" }}>{editing ? "Editar Molde" : "Nuevo Molde"}</h2>
            
            {!editing && (
              <div style={s.btnScan} onClick={() => !scanning && fileInputRef.current?.click()}>
                {scanning ? (
                  <>
                    <span className="spinner">⏳</span> Procesando imagen...
                    <div style={s.progressBar}>
                      <div style={s.progressFill}></div>
                    </div>
                  </>
                ) : (
                  <>📷 Escanear Foto (Opcional)</>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} disabled={scanning} />
              </div>
            )}

            <form onSubmit={handleSave}>
              <div style={s.row}>
                <div style={s.col}>
                  <label style={s.label}>Número de Molde</label>
                  <input style={s.input} required placeholder="Ej. 45, 212..." value={formData.numero} onChange={(e) => setFormData({...formData, numero: e.target.value})} />
                </div>
                <div style={s.col}>
                  <label style={s.label}>Tipo de Joya</label>
                  <input style={s.input} placeholder="Ej. Anillo, Dije..." value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value})} />
                </div>
              </div>

              <label style={s.label}>Carrera / Diseño</label>
              <textarea style={s.textarea} placeholder="Ej. Perito Contador Octagonal..." value={formData.carrera} onChange={(e) => setFormData({...formData, carrera: e.target.value})} />

              <div style={s.row}>
                <div style={s.col}>
                  <label style={s.label}>Medida</label>
                  <input style={s.input} placeholder="Ej. 10x8" value={formData.medida} onChange={(e) => setFormData({...formData, medida: e.target.value})} />
                </div>
                <div style={s.col}>
                  <label style={s.label}>Notas Adicionales</label>
                  <input style={s.input} placeholder="Ej. Nombre del cliente..." value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "25px" }}>
                <button type="submit" style={{ ...s.btnPrimary, flex: 1 }} disabled={saving || scanning}>
                  {saving ? "Guardando..." : "💾 Guardar Ficha"}
                </button>
                <button type="button" style={{ ...s.btnSecondary, flex: 1 }} onClick={() => setModalOpen(false)}>Cerrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}