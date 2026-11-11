import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function Moldes() {
  const [libraries, setLibraries] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null);
  const [molds, setMolds] = useState([]);
  const [search, setSearch] = useState("");
  
  // Filtro de tipo (por si lo usas)
  const [filterType, setFilterType] = useState("TODOS");

  // Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({ numero: "", tipo: "", carrera: "", medida: "", notas: "" });
  
  // --- ESTADO PARA EL MODO LOTE (LISTA EXTRAÍDA) ---
  const [batchMoldes, setBatchMoldes] = useState([]);
  const [batchOpen, setBatchOpen] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0); // <--- BARRA DE PROGRESO
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

  const openNewModal = () => {
    setEditing(null);
    setFormData({ numero: "", tipo: "", carrera: "", medida: "", notas: "" });
    setIsEditMode(true);
    setModalOpen(true);
  };

  const openViewModal = (molde) => {
    setEditing(molde);
    setFormData({ numero: molde.numero || "", tipo: molde.tipo || "", carrera: molde.carrera || "", medida: molde.medida || "", notas: molde.notas || "" });
    setIsEditMode(false);
    setModalOpen(true);
  };

  // --- ESCANEAR FOTO (MODO LOTE) ---
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await api.post("/molds/scan", formData, { headers: { "Content-Type": "multipart/form-data" } });
      
      if (r.data?.moldes && r.data.moldes.length > 0) {
        setBatchMoldes(r.data.moldes);
        setBatchOpen(true);
        toast.success(`¡Se encontraron ${r.data.moldes.length} moldes!`);
      } else {
        toast.error("No se detectaron moldes en la imagen.");
      }
    } catch { toast.error("Error al escanear. Intenta de nuevo."); } 
    finally { 
      setScanning(false); 
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveBatch = async () => {
    setSaving(true);
    try {
      for (const molde of batchMoldes) {
        if (molde.numero.trim()) {
          await api.post("/molds", { libreria_id: selectedLib.id, ...molde });
        }
      }
      toast.success("¡Todos los moldes guardados!");
      setBatchOpen(false);
      setBatchMoldes([]);
      await loadMolds();
    } catch {
      toast.error("Error al guardar el lote");
    } finally { setSaving(false); }
  };

  const updateBatchItem = (index, field, value) => {
    const nuevos = [...batchMoldes];
    nuevos[index][field] = value;
    setBatchMoldes(nuevos);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.numero.trim()) return toast.error("El número es obligatorio");
    setSaving(true);
    try {
      if (editing) await api.put(`/molds/${editing.id}`, formData);
      else await api.post("/molds", { libreria_id: selectedLib.id, ...formData });
      await loadMolds();
      setModalOpen(false);
      toast.success("Molde guardado");
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

  const exportToPDF = () => { window.print(); };

  const filteredMolds = useMemo(() => {
    const q = search.toLowerCase();
    return molds.filter(m => {
      const matchSearch = (m.numero || "").toLowerCase().includes(q) || 
                          (m.tipo || "").toLowerCase().includes(q) ||
                          (m.carrera || "").toLowerCase().includes(q) || 
                          (m.medida || "").toLowerCase().includes(q);
      
      // Si tienes filtros de tipo, aquí se aplican
      let matchType = true;
      if (filterType !== "TODOS") {
        // Ejemplo simple: si el tipo incluye la palabra (ANILLO, DIJE, etc.)
        matchType = (m.tipo || "").toUpperCase().includes(filterType);
      }

      return matchSearch && matchType;
    });
  }, [molds, search, filterType]);

  const s = {
    page: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px", fontFamily: "sans-serif", paddingBottom: "100px" },
    title: { fontSize: "28px", fontFamily: "serif", color: "#fff", margin: "0 0 5px 0" },
    searchBar: { width: "100%", padding: "15px", borderRadius: "10px", border: "1px solid #333", background: "#151515", color: "#fff", marginBottom: "20px", boxSizing: "border-box", fontSize: "16px" },
    btnPrimary: { background: "#d4af37", color: "#000", border: "none", padding: "12px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" },
    btnSecondary: { background: "#222", color: "#fff", border: "1px solid #444", padding: "12px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" },
    listContainer: { display: "flex", flexDirection: "column", gap: "10px" },
    listCard: { background: "#151515", border: "1px solid #333", borderRadius: "10px", padding: "15px", display: "flex", alignItems: "center", gap: "15px", cursor: "pointer" },
    listBadge: { background: "#333", color: "#d4af37", fontWeight: "bold", fontSize: "16px", padding: "8px 12px", borderRadius: "8px", minWidth: "50px", textAlign: "center" },
    listContent: { flex: 1, display: "flex", flexDirection: "column", gap: "4px" },
    listTitle: { fontSize: "15px", fontWeight: "bold", color: "#fff" },
    listSub: { fontSize: "13px", color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" },
    listAction: { background: "none", border: "none", color: "#f0b0b0", fontSize: "18px", cursor: "pointer" },
    modalBg: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "10px" },
    modal: { background: "#151515", padding: "20px", borderRadius: "16px", width: "100%", maxWidth: "600px", border: "1px solid #333", maxHeight: "95vh", overflowY: "auto", display: "flex", flexDirection: "column" },
    readContainer: { background: "#0a0a0a", border: "1px solid #222", borderRadius: "8px", padding: "15px", marginBottom: "15px" },
    readLabel: { fontSize: "12px", color: "#d4af37", textTransform: "uppercase", marginBottom: "5px", display: "block" },
    readValue: { fontSize: "16px", color: "#fff", whiteSpace: "pre-wrap" },
    label: { fontSize: "12px", color: "#aaa", marginBottom: "6px", display: "block", marginTop: "15px", fontWeight: "bold" },
    input: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box", fontSize: "15px" },
    textarea: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box", fontSize: "15px", minHeight: "80px", resize: "vertical" },
    row: { display: "flex", gap: "15px" },
    col: { flex: 1 },
    
    // ESTILOS DE LA BARRA DE PROGRESO
    btnScan: { width: "100%", padding: "15px", borderRadius: "8px", border: "1px dashed #d4af37", background: scanning ? "rgba(212,175,55,0.2)" : "rgba(212,175,55,0.05)", color: "#d4af37", fontWeight: "bold", cursor: scanning ? "wait" : "pointer", marginBottom: "20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" },
    progressBar: { width: "100%", height: "6px", background: "#333", borderRadius: "3px", marginTop: "5px", overflow: "hidden" },
    progressFill: { height: "100%", background: "#d4af37", width: `${progress}%`, transition: "width 0.3s ease" },
  };

  return (
    <div style={s.page}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { position: absolute; left: 0; top: 0; width: 100%; color: black; background: white; padding: 20px; }
          .no-print { display: none !important; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; color: #000; font-size: 12px; }
          th { background-color: #f0f0f0; }
        }
      `}</style>

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={s.title}>{selectedLib ? selectedLib.nombre : "Mis Colecciones"}</h1>
          <p style={{ color: "#888", fontSize: "14px", margin: 0 }}>{selectedLib ? "Catálogo de Moldes" : "Selecciona una carpeta"}</p>
        </div>
        {selectedLib && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button style={s.btnSecondary} onClick={exportToPDF}>📄 PDF</button>
            <button style={s.btnPrimary} onClick={openNewModal}>+ Nuevo</button>
          </div>
        )}
      </div>

      <input className="no-print" style={s.searchBar} placeholder="Buscar por número, tipo, carrera..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {selectedLib && (
        <button className="no-print" onClick={() => { setSelectedLib(null); setSearch(""); }} style={{ background: "none", border: "none", color: "#d4af37", fontSize: "16px", padding: 0, marginBottom: "20px", cursor: "pointer" }}>
          ← Volver a Colecciones
        </button>
      )}

      {!selectedLib && (
        <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "15px" }}>
          {libraries.map((lib) => (
            <div key={lib.id} style={{ background: "#151515", border: "1px solid #333", borderRadius: "12px", padding: "20px", cursor: "pointer", textAlign: "center" }} onClick={() => setSelectedLib(lib)}>
              <div style={{ fontSize: "30px", marginBottom: "10px" }}>📁</div>
              <div style={{ fontWeight: "bold" }}>{lib.nombre}</div>
            </div>
          ))}
        </div>
      )}

      {selectedLib && (
        <div className="no-print" style={s.listContainer}>
          
          {/* BOTÓN DE ESCANEO CON BARRA DE PROGRESO */}
          <div style={s.btnScan} onClick={() => !scanning && fileInputRef.current?.click()}>
            {scanning ? (
              <>
                <span>⏳ Extrayendo lista de la hoja...</span>
                <div style={s.progressBar}>
                  <div style={s.progressFill}></div>
                </div>
              </>
            ) : (
              <span>📷 Escanear Hoja (Lote)</span>
            )}
            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} disabled={scanning} />
          </div>

          {/* FILTROS (Opcionales, se ven en tu foto) */}
          <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "10px" }}>
            {["TODOS", "ANILLO", "DIJE", "PLANCHA"].map(f => (
               <button key={f} onClick={() => setFilterType(f)} style={{ background: filterType === f ? "#d4af37" : "#151515", color: filterType === f ? "#000" : "#fff", border: "1px solid #333", padding: "8px 16px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>
                 {f}
               </button>
            ))}
          </div>

          {filteredMolds.map((m) => (
            <div key={m.id} style={s.listCard} onClick={() => openViewModal(m)}>
              <div style={s.listBadge}>{m.numero}</div>
              <div style={s.listContent}>
                <div style={s.listTitle}>{m.tipo || "Sin tipo"} {m.medida ? `(${m.medida})` : ""}</div>
                <div style={s.listSub}>{m.carrera || "Sin diseño"}</div>
                {m.notas && <div style={{ fontSize: "11px", color: "#d4af37", marginTop: "2px" }}>✍️ {m.notas}</div>}
              </div>
              <button style={s.listAction} onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* --- MODAL MODO LOTE (REVISAR LISTA EXTRAÍDA) --- */}
      {batchOpen && (
        <div className="no-print" style={s.modalBg}>
          <div style={s.modal}>
            <h2 style={{ color: "#d4af37", marginBottom: "15px" }}>Revisar Lista ({batchMoldes.length} moldes)</h2>
            <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "20px" }}>Revisa los datos extraídos. Puedes corregirlos antes de guardarlos todos.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {batchMoldes.map((m, idx) => (
                <div key={idx} style={{ background: "#0a0a0a", padding: "15px", borderRadius: "8px", border: "1px solid #333" }}>
                  <div style={s.row}>
                    <div style={s.col}>
                      <label style={s.label}>N° Molde</label>
                      <input style={s.input} value={m.numero} onChange={(e) => updateBatchItem(idx, 'numero', e.target.value)} />
                    </div>
                    <div style={s.col}>
                      <label style={s.label}>Tipo</label>
                      <input style={s.input} value={m.tipo} onChange={(e) => updateBatchItem(idx, 'tipo', e.target.value)} />
                    </div>
                  </div>
                  <label style={s.label}>Carrera</label>
                  <input style={s.input} value={m.carrera} onChange={(e) => updateBatchItem(idx, 'carrera', e.target.value)} />
                  <div style={s.row}>
                    <div style={s.col}>
                      <label style={s.label}>Medida</label>
                      <input style={s.input} value={m.medida} onChange={(e) => updateBatchItem(idx, 'medida', e.target.value)} />
                    </div>
                    <div style={s.col}>
                      <label style={s.label}>Notas</label>
                      <input style={s.input} value={m.notas} onChange={(e) => updateBatchItem(idx, 'notas', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px", position: "sticky", bottom: 0, background: "#151515", paddingTop: "10px" }}>
              <button onClick={saveBatch} disabled={saving} style={{ ...s.btnPrimary, flex: 1 }}>
                {saving ? "Guardando..." : `💾 Guardar los ${batchMoldes.length} Moldes`}
              </button>
              <button onClick={() => setBatchOpen(false)} style={{ ...s.btnSecondary, flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INDIVIDUAL (LECTURA / EDICIÓN) */}
      {modalOpen && (
        <div className="no-print" style={s.modalBg} onClick={() => setModalOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ color: "#d4af37", margin: 0 }}>{editing ? (isEditMode ? "Editar Molde" : "Detalles del Molde") : "Nuevo Molde"}</h2>
              {editing && !isEditMode && (
                <button style={{ ...s.btnPrimary, padding: "8px 12px", fontSize: "12px" }} onClick={() => setIsEditMode(true)}>✏️ Editar</button>
              )}
            </div>
            
            {!isEditMode && editing ? (
              <div>
                <div style={s.readContainer}>
                  <span style={s.readLabel}>Número</span>
                  <div style={{ ...s.readValue, fontSize: "24px", color: "#d4af37", fontWeight: "bold" }}>{formData.numero}</div>
                </div>
                <div style={s.readContainer}><span style={s.readLabel}>Tipo</span><div style={s.readValue}>{formData.tipo || "-"}</div></div>
                <div style={s.readContainer}><span style={s.readLabel}>Carrera / Diseño</span><div style={s.readValue}>{formData.carrera || "-"}</div></div>
                <div style={s.row}>
                  <div style={{...s.readContainer, flex: 1}}><span style={s.readLabel}>Medida</span><div style={s.readValue}>{formData.medida || "-"}</div></div>
                  <div style={{...s.readContainer, flex: 1}}><span style={s.readLabel}>Notas</span><div style={s.readValue}>{formData.notas || "-"}</div></div>
                </div>
                <button style={{ ...s.btnSecondary, width: "100%", marginTop: "20px" }} onClick={() => setModalOpen(false)}>Cerrar</button>
              </div>
            ) : (
              <form onSubmit={handleSave}>
                <div style={s.row}>
                  <div style={s.col}><label style={s.label}>Número</label><input style={s.input} required value={formData.numero} onChange={(e) => setFormData({...formData, numero: e.target.value})} /></div>
                  <div style={s.col}><label style={s.label}>Tipo</label><input style={s.input} value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value})} /></div>
                </div>
                <label style={s.label}>Carrera / Diseño</label>
                <textarea style={s.textarea} value={formData.carrera} onChange={(e) => setFormData({...formData, carrera: e.target.value})} />
                <div style={s.row}>
                  <div style={s.col}><label style={s.label}>Medida</label><input style={s.input} value={formData.medida} onChange={(e) => setFormData({...formData, medida: e.target.value})} /></div>
                  <div style={s.col}><label style={s.label}>Notas</label><input style={s.input} value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} /></div>
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "25px" }}>
                  <button type="submit" style={{ ...s.btnPrimary, flex: 1 }} disabled={saving}>{saving ? "Guardando..." : "💾 Guardar"}</button>
                  <button type="button" style={{ ...s.btnSecondary, flex: 1 }} onClick={() => editing ? setIsEditMode(false) : setModalOpen(false)}>Cancelar</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}