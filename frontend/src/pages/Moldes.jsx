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
  
  // Estados para el Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false); // Controla si estamos leyendo o editando
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

  // --- ABRIR MODAL ---
  const openNewModal = () => {
    setEditing(null);
    setFormData({ numero: "", tipo: "", carrera: "", medida: "", notas: "" });
    setIsEditMode(true); // En uno nuevo, abrimos directo en edición
    setModalOpen(true);
  };

  const openViewModal = (molde) => {
    setEditing(molde);
    setFormData({
      numero: molde.numero || "",
      tipo: molde.tipo || "",
      carrera: molde.carrera || "",
      medida: molde.medida || "",
      notas: molde.notas || "",
    });
    setIsEditMode(false); // Abrimos en modo LECTURA
    setModalOpen(true);
  };

  // --- BARRA DE PROGRESO SIMULADA ---
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

  // --- EXPORTAR A PDF (CON MANEJO DE ERRORES) ---
  const exportToPDF = () => {
    try {
      if (!selectedLib) return;
      const doc = new jsPDF();
      doc.text(`Listado de Moldes: ${selectedLib.nombre}`, 14, 16);
      const tableData = filteredMolds.map(m => [m.numero, m.tipo, m.carrera, m.medida, m.notas]);
      
      if (typeof doc.autoTable === "function") {
        doc.autoTable({
          head: [['N° Molde', 'Tipo', 'Carrera / Diseño', 'Medida', 'Notas']],
          body: tableData,
          startY: 22,
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: { 2: { cellWidth: 70 } }
        });
      } else {
        toast.error("Error: Falta instalar jspdf-autotable");
        return;
      }
      doc.save(`Moldes_${selectedLib.nombre}.pdf`);
      toast.success("PDF descargado");
    } catch (error) {
      console.error(error);
      toast.error("Error al generar PDF. Revisa la consola.");
    }
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

  // --- ESTILOS ---
  const s = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px", fontFamily: "sans-serif", paddingBottom: "100px" },
    title: { fontSize: "28px", fontFamily: "serif", color: "#fff", margin: "0 0 5px 0" },
    searchBar: { width: "100%", padding: "15px", borderRadius: "10px", border: "1px solid #333", background: "#151515", color: "#fff", marginBottom: "20px", boxSizing: "border-box", fontSize: "16px" },
    btnPrimary: { background: "#d4af37", color: "#000", border: "none", padding: "12px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" },
    btnSecondary: { background: "#222", color: "#fff", border: "1px solid #444", padding: "12px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" },
    
    // LISTA TIPO SPOTIFY (Tarjetas verticales)
    listContainer: { display: "flex", flexDirection: "column", gap: "10px" },
    listCard: { background: "#151515", border: "1px solid #333", borderRadius: "10px", padding: "15px", display: "flex", alignItems: "center", gap: "15px", cursor: "pointer", transition: "0.2s" },
    listBadge: { background: "#333", color: "#d4af37", fontWeight: "bold", fontSize: "16px", padding: "8px 12px", borderRadius: "8px", minWidth: "50px", textAlign: "center" },
    listContent: { flex: 1, display: "flex", flexDirection: "column", gap: "4px" },
    listTitle: { fontSize: "15px", fontWeight: "bold", color: "#fff" },
    listSub: { fontSize: "13px", color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" },
    listAction: { background: "none", border: "none", color: "#f0b0b0", fontSize: "18px", cursor: "pointer" },

    // MODAL DE LECTURA/EDICIÓN
    modalBg: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "10px" },
    modal: { background: "#151515", padding: "20px", borderRadius: "16px", width: "100%", maxWidth: "600px", border: "1px solid #333", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column" },
    
    // ESTILOS DE LECTURA
    readContainer: { background: "#0a0a0a", border: "1px solid #222", borderRadius: "8px", padding: "15px", marginBottom: "15px" },
    readLabel: { fontSize: "12px", color: "#d4af37", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "5px", display: "block" },
    readValue: { fontSize: "16px", color: "#fff", lineHeight: "1.5", whiteSpace: "pre-wrap" },
    
    // ESTILOS DE EDICIÓN
    label: { fontSize: "12px", color: "#aaa", marginBottom: "6px", display: "block", marginTop: "15px", fontWeight: "bold" },
    input: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box", fontSize: "15px" },
    textarea: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box", fontSize: "15px", minHeight: "100px", resize: "vertical", fontFamily: "inherit" },
    row: { display: "flex", gap: "15px" },
    col: { flex: 1 },
    
    btnScan: { width: "100%", padding: "15px", borderRadius: "8px", border: "1px dashed #d4af37", background: scanning ? "rgba(212,175,55,0.2)" : "rgba(212,175,55,0.05)", color: "#d4af37", fontWeight: "bold", cursor: scanning ? "wait" : "pointer", marginBottom: "20px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "10px", transition: "0.3s" },
    progressBar: { width: "100%", height: "6px", background: "#333", borderRadius: "3px", marginTop: "10px", overflow: "hidden" },
    progressFill: { height: "100%", background: "#d4af37", width: `${progress}%`, transition: "width 0.3s ease" },
  };

  return (
    <div style={s.page}>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spinner { animation: spin 1s linear infinite; display: inline-block; }
        .list-card:hover { border-color: #d4af37; background-color: #1a1a1a; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={s.title}>{selectedLib ? selectedLib.nombre : "Mis Colecciones"}</h1>
          <p style={{ color: "#888", fontSize: "14px", margin: 0 }}>{selectedLib ? "Toca un molde para LEER o editar" : "Selecciona una carpeta"}</p>
        </div>
        {selectedLib && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button style={s.btnSecondary} onClick={exportToPDF}>📄 PDF</button>
            <button style={s.btnPrimary} onClick={openNewModal}>+ Nuevo</button>
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

      {/* LISTA TIPO SPOTIFY (En lugar de la tabla) */}
      {selectedLib && (
        <div style={s.listContainer}>
          {filteredMolds.map((m) => (
            <div key={m.id} style={s.listCard} className="list-card" onClick={() => openViewModal(m)}>
              <div style={s.listBadge}>{m.numero}</div>
              <div style={s.listContent}>
                <div style={s.listTitle}>{m.tipo || "Sin tipo"}</div>
                <div style={s.listSub}>{m.carrera || "Sin diseño"}</div>
              </div>
              <button style={s.listAction} onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}>🗑️</button>
            </div>
          ))}
          {filteredMolds.length === 0 && <p style={{ textAlign: "center", padding: "20px", color: "#666" }}>No hay moldes. Crea uno nuevo.</p>}
        </div>
      )}

      {/* MODAL: LECTURA Y EDICIÓN */}
      {modalOpen && (
        <div style={s.modalBg} onClick={() => setModalOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ color: "#d4af37", margin: 0 }}>{editing ? (isEditMode ? "Editar Molde" : "Detalles del Molde") : "Nuevo Molde"}</h2>
              {editing && !isEditMode && (
                <button style={{ ...s.btnPrimary, padding: "8px 12px", fontSize: "12px" }} onClick={() => setIsEditMode(true)}>✏️ Editar</button>
              )}
            </div>
            
            {/* SI ESTAMOS CREANDO UNO NUEVO, MOSTRAMOS EL BOTÓN DE ESCANEAR */}
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

            {/* MODO LECTURA (Ficha técnica bonita) */}
            {!isEditMode && editing ? (
              <div>
                <div style={s.readContainer}>
                  <span style={s.readLabel}>Número de Molde</span>
                  <div style={{ ...s.readValue, fontSize: "24px", color: "#d4af37", fontWeight: "bold" }}>{formData.numero}</div>
                </div>
                <div style={s.readContainer}>
                  <span style={s.readLabel}>Tipo de Joya</span>
                  <div style={s.readValue}>{formData.tipo || "-"}</div>
                </div>
                <div style={s.readContainer}>
                  <span style={s.readLabel}>Carrera / Diseño</span>
                  <div style={s.readValue}>{formData.carrera || "-"}</div>
                </div>
                <div style={s.row}>
                  <div style={{...s.readContainer, flex: 1}}>
                    <span style={s.readLabel}>Medida</span>
                    <div style={s.readValue}>{formData.medida || "-"}</div>
                  </div>
                  <div style={{...s.readContainer, flex: 1}}>
                    <span style={s.readLabel}>Notas</span>
                    <div style={s.readValue}>{formData.notas || "-"}</div>
                  </div>
                </div>
                <button style={{ ...s.btnSecondary, width: "100%", marginTop: "20px" }} onClick={() => setModalOpen(false)}>Cerrar</button>
              </div>
            ) : (
              
              /* MODO EDICIÓN */
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
                  {editing && (
                    <button type="button" style={{ ...s.btnSecondary, flex: 1 }} onClick={() => setIsEditMode(false)}>Cancelar Edición</button>
                  )}
                  {!editing && (
                    <button type="button" style={{ ...s.btnSecondary, flex: 1 }} onClick={() => setModalOpen(false)}>Cerrar</button>
                  )}
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}