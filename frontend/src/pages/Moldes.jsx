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

  // Barra de progreso simulada
  useEffect(() => {
    let interval;
    if (scanning) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 95 ? 95 : prev + Math.floor(Math.random() * 10) + 1));
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

  // Edición en línea: guarda el cambio de una celda al presionar Enter
  const handleInlineEdit = async (id, field, value) => {
    try {
      await api.put(`/molds/${id}`, { [field]: value });
      setMolds(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
      toast.success("Cambio guardado", { duration: 1000 });
    } catch {
      toast.error("Error al guardar el cambio");
    }
  };

  const exportToPDF = () => {
    if (!selectedLib) return;
    const doc = new jsPDF();
    doc.text(`Listado de Moldes: ${selectedLib.nombre}`, 14, 16);
    const tableData = filteredMolds.map(m => [m.numero, m.tipo, m.carrera, m.medida, m.notas]);
    doc.autoTable({
      head: [['N° Molde', 'Tipo', 'Carrera / Diseño', 'Medida', 'Notas']],
      body: tableData,
      startY: 22,
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 2: { cellWidth: 60 } } // más ancho para la carrera
    });
    doc.save(`Moldes_${selectedLib.nombre}.pdf`);
    toast.success("PDF descargado");
  };

  const filteredMolds = useMemo(() => {
    const q = search.toLowerCase();
    return molds.filter(m => 
      (m.numero || "").toLowerCase().includes(q) ||
      (m.tipo || "").toLowerCase().includes(q) ||
      (m.carrera || "").toLowerCase().includes(q) ||
      (m.medida || "").toLowerCase().includes(q)
    );
  }, [molds, search]);

  // --- ESTILOS MEJORADOS ---
  const s = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px", fontFamily: "sans-serif", paddingBottom: "100px" },
    title: { fontSize: "28px", fontFamily: "serif", color: "#fff", margin: "0 0 5px 0" },
    searchBar: { width: "100%", padding: "15px", borderRadius: "10px", border: "1px solid #333", background: "#151515", color: "#fff", marginBottom: "20px", boxSizing: "border-box", fontSize: "16px" },
    btnPrimary: { background: "#d4af37", color: "#000", border: "none", padding: "12px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" },
    btnSecondary: { background: "#222", color: "#fff", border: "1px solid #444", padding: "12px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" },
    
    // Tabla más legible
    tableWrapper: { overflowX: "auto", background: "#111", borderRadius: "12px", border: "1px solid #333" },
    table: { width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "700px" },
    th: { padding: "12px 10px", borderBottom: "1px solid #333", color: "#d4af37", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" },
    td: { padding: "10px", borderBottom: "1px solid #222", fontSize: "14px", color: "#ddd", verticalAlign: "top" },
    editableCell: { cursor: "pointer", padding: "8px", borderRadius: "4px", "&:hover": { background: "#222" } },
    
    // Modal tipo ficha técnica
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
    
    // Ficha técnica (Description List)
    dl: { display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 15px", margin: "10px 0", alignItems: "start" },
    dt: { color: "#d4af37", fontWeight: "bold", fontSize: "13px", textAlign: "right", paddingTop: "12px" },
    dd: { margin: 0, fontSize: "15px", color: "#fff" },
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
          <p style={{ color: "#888", fontSize: "14px", margin: 0 }}>{selectedLib ? "Listado de moldes (Toca una celda para editar)" : "Selecciona una carpeta"}</p>
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
                <th style={s.th}>N°</th>
                <th style={s.th}>Tipo</th>
                <th style={s.th}>Carrera / Diseño</th>
                <th style={s.th}>Medida</th>
                <th style={s.th}>Notas</th>
                <th style={s.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredMolds.map((m) => (
                <tr key={m.id} style={s.tr}>
                  {/* Celdas editables */}
                  <td style={{ ...s.td, ...s.editableCell }} contentEditable suppressContentEditableWarning onBlur={(e) => handleInlineEdit(m.id, 'numero', e.target.innerText)}>
                    <span style={{ background: "#333", padding: "4px 8px", borderRadius: "4px", fontSize: "13px", color: "#d4af37", fontWeight: "bold" }}>{m.numero}</span>
                  </td>
                  <td style={{ ...s.td, ...s.editableCell }} contentEditable suppressContentEditableWarning onBlur={(e) => handleInlineEdit(m.id, 'tipo', e.target.innerText)}>
                    {m.tipo || "-"}
                  </td>
                  <td style={{ ...s.td, ...s.editableCell }} contentEditable suppressContentEditableWarning onBlur={(e) => handleInlineEdit(m.id, 'carrera', e.target.innerText)}>
                    {m.carrera || "-"}
                  </td>
                  <td style={{ ...s.td, ...s.editableCell }} contentEditable suppressContentEditableWarning onBlur={(e) => handleInlineEdit(m.id, 'medida', e.target.innerText)}>
                    {m.medida || "-"}
                  </td>
                  <td style={{ ...s.td, ...s.editableCell }} contentEditable suppressContentEditableWarning onBlur={(e) => handleInlineEdit(m.id, 'notas', e.target.innerText)}>
                    {m.notas || "-"}
                  </td>
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

      {/* MODAL CON FICHA TÉCNICA (Description List) */}
      {modalOpen && (
        <div style={s.modalBg} onClick={() => setModalOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#d4af37", margin: "0 0 15px 0" }}>{editing ? "Editar Molde" : "Nuevo Molde"}</h2>
            
            {!editing && (
              <div style={s.btnScan} onClick={() => !scanning && fileInputRef.current?.click()}>
                {scanning ? (
                  <><span className="spinner">⏳</span> Procesando imagen...<div style={s.progressBar}><div style={s.progressFill}></div></div></>
                ) : (
                  <>📷 Escanear Foto (Opcional)</>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} disabled={scanning} />
              </div>
            )}

            <form onSubmit={handleSave}>
              {/* Ficha técnica con Description List */}
              <dl style={s.dl}>
                <dt style={s.dt}>N° Molde</dt>
                <dd style={s.dd}>
                  <input style={s.input} required placeholder="Ej. 45, 212..." value={formData.numero} onChange={(e) => setFormData({...formData, numero: e.target.value})} />
                </dd>

                <dt style={s.dt}>Tipo</dt>
                <dd style={s.dd}>
                  <input style={s.input} placeholder="Ej. Anillo, Dije..." value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value})} />
                </dd>

                <dt style={s.dt}>Carrera / Diseño</dt>
                <dd style={s.dd}>
                  <textarea style={s.textarea} placeholder="Ej. Perito Contador Octagonal..." value={formData.carrera} onChange={(e) => setFormData({...formData, carrera: e.target.value})} />
                </dd>

                <dt style={s.dt}>Medida</dt>
                <dd style={s.dd}>
                  <input style={s.input} placeholder="Ej. 10x8" value={formData.medida} onChange={(e) => setFormData({...formData, medida: e.target.value})} />
                </dd>

                <dt style={s.dt}>Notas</dt>
                <dd style={s.dd}>
                  <input style={s.input} placeholder="Ej. Nombre del cliente..." value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} />
                </dd>
              </dl>

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