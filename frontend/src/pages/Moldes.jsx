import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function Moldes() {
  const [libraries, setLibraries] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null);
  const [molds, setMolds] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("TODOS");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({ numero: "", tipo: "", carrera: "", medida: "", notas: "" });
  
  // --- ESTADO PARA REVISIÓN DE LISTA ---
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchTitle, setBatchTitle] = useState("");
  const [batchMoldes, setBatchMoldes] = useState([]);
  
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSheet, setCurrentSheet] = useState(0);
  const [totalSheets, setTotalSheets] = useState(0);

  const singleFileRef = useRef(null);
  const multipleFileRef = useRef(null);

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

  // --- BORRAR UNA CARPETA COMPLETA ---
  const handleDeleteLibrary = async (e, lib) => {
    e.stopPropagation(); // Evita que se abra la carpeta al tocar el basurero
    if (!window.confirm(`¿Estás seguro de borrar la carpeta "${lib.nombre}"?\n\n¡Se borrarán TODOS los moldes que tenga adentro!`)) return;
    try {
      await api.delete(`/libraries/${lib.id}`);
      toast.success("Carpeta y moldes eliminados");
      await loadLibraries();
    } catch {
      toast.error("Error al borrar la carpeta");
    }
  };

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

  const processFiles = async (files) => {
    if (files.length === 0) return;

    setScanning(true);
    setTotalSheets(files.length);
    setCurrentSheet(1);
    setProgress(0);
    
    let allExtractedMolds = [];
    let mainTitle = "";

    for (let i = 0; i < files.length; i++) {
      setCurrentSheet(i + 1);
      setProgress(Math.round(((i) / files.length) * 100));

      try {
        const formData = new FormData();
        formData.append("file", files[i]);
        
        const r = await api.post("/molds/scan", formData, { headers: { "Content-Type": "multipart/form-data" } });
        
        if (r.data?.moldes && r.data.moldes.length > 0) {
          allExtractedMolds = [...allExtractedMolds, ...r.data.moldes];
          if (!mainTitle && r.data.titulo) mainTitle = r.data.titulo;
        }
      } catch (error) {
        toast.error(`Error al leer la foto ${i + 1}`);
      }
    }

    setProgress(100);
    setScanning(false);

    if (allExtractedMolds.length > 0) {
      setBatchTitle(mainTitle);
      setBatchMoldes(allExtractedMolds);
      setBatchOpen(true);
      toast.success(`¡Se extrajeron ${allExtractedMolds.length} moldes!`);
    } else {
      toast.error("No se detectaron moldes.");
    }

    if (singleFileRef.current) singleFileRef.current.value = "";
    if (multipleFileRef.current) multipleFileRef.current.value = "";
  };

  const handleSingleFile = (e) => processFiles(Array.from(e.target.files));
  const handleMultipleFiles = (e) => processFiles(Array.from(e.target.files));

  const saveBatch = async () => {
    setSaving(true);
    try {
      for (const molde of batchMoldes) {
        if (molde.numero.trim()) {
          const tipoFinal = molde.tipo || batchTitle;
          await api.post("/molds", { libreria_id: selectedLib.id, ...molde, tipo: tipoFinal });
        }
      }
      toast.success("¡Lista guardada exitosamente!");
      setBatchOpen(false);
      setBatchMoldes([]);
      await loadMolds();
    } catch {
      toast.error("Error al guardar");
    } finally { setSaving(false); }
  };

  const updateBatchItem = (index, field, value) => {
    const nuevos = [...batchMoldes];
    nuevos[index][field] = value;
    setBatchMoldes(nuevos);
  };

  const removeBatchItem = (index) => {
    setBatchMoldes(batchMoldes.filter((_, i) => i !== index));
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
    } catch { toast.error("Error al guardar"); } 
    finally { setSaving(false); }
  };

  const handleDeleteMold = async (id) => {
    if (!window.confirm("¿Borrar este molde?")) return;
    try {
      await api.delete(`/molds/${id}`);
      await loadMolds();
    } catch { toast.error("Error al borrar"); }
  };

  const filteredMolds = useMemo(() => {
    const q = search.toLowerCase();
    return molds.filter(m => {
      const matchSearch = (m.numero || "").toLowerCase().includes(q) || (m.tipo || "").toLowerCase().includes(q) || (m.carrera || "").toLowerCase().includes(q);
      let matchType = filterType === "TODOS" || (m.tipo || "").toUpperCase().includes(filterType);
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
    modalBg: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.95)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "10px" },
    modal: { background: "#151515", padding: "20px", borderRadius: "16px", width: "100%", maxWidth: "800px", border: "1px solid #333", maxHeight: "95vh", overflowY: "auto", display: "flex", flexDirection: "column" },
    readContainer: { background: "#0a0a0a", border: "1px solid #222", borderRadius: "8px", padding: "15px", marginBottom: "15px" },
    readLabel: { fontSize: "12px", color: "#d4af37", textTransform: "uppercase", marginBottom: "5px", display: "block" },
    readValue: { fontSize: "16px", color: "#fff", whiteSpace: "pre-wrap" },
    label: { fontSize: "12px", color: "#aaa", marginBottom: "6px", display: "block", marginTop: "15px", fontWeight: "bold" },
    input: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box", fontSize: "15px" },
    textarea: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "#0a0a0a", color: "#fff", boxSizing: "border-box", fontSize: "15px", minHeight: "80px", resize: "vertical" },
    row: { display: "flex", gap: "15px" },
    col: { flex: 1 },
    btnScanSingle: { flex: 1, padding: "12px", borderRadius: "8px", border: "1px dashed #d4af37", background: scanning ? "rgba(212,175,55,0.1)" : "rgba(212,175,55,0.05)", color: "#d4af37", fontWeight: "bold", cursor: "pointer", textAlign: "center", display: "flex", justifyContent: "center", alignItems: "center", gap: "5px" },
    btnScanMulti: { flex: 1, padding: "12px", borderRadius: "8px", border: "1px dashed #d4af37", background: scanning ? "rgba(212,175,55,0.1)" : "rgba(212,175,55,0.05)", color: "#d4af37", fontWeight: "bold", cursor: "pointer", textAlign: "center", display: "flex", justifyContent: "center", alignItems: "center", gap: "5px" },
    progressBar: { width: "100%", height: "6px", background: "#333", borderRadius: "3px", marginTop: "5px", overflow: "hidden" },
    progressFill: { height: "100%", background: "#d4af37", width: `${progress}%`, transition: "width 0.3s ease" },
    
    // NUEVO ESTILO PARA LAS CARPETAS CON BOTÓN DE BORRAR
    folderCard: { background: "#151515", border: "1px solid #333", borderRadius: "12px", padding: "20px", cursor: "pointer", textAlign: "center", position: "relative" },
    folderDeleteBtn: { position: "absolute", top: "10px", right: "10px", background: "rgba(255,0,0,0.1)", border: "none", borderRadius: "50%", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", color: "#f0b0b0", fontSize: "14px", cursor: "pointer" },
  };

  return (
    <div style={s.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={s.title}>{selectedLib ? selectedLib.nombre : "Mis Colecciones"}</h1>
          <p style={{ color: "#888", fontSize: "14px", margin: 0 }}>{selectedLib ? "Catálogo de Moldes" : "Selecciona una carpeta"}</p>
        </div>
        {selectedLib && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button style={s.btnSecondary} onClick={() => window.print()}>📄 PDF</button>
            <button style={s.btnPrimary} onClick={openNewModal}>+ Nuevo</button>
          </div>
        )}
      </div>

      <input style={s.searchBar} placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {selectedLib && (
        <button onClick={() => { setSelectedLib(null); setSearch(""); }} style={{ background: "none", border: "none", color: "#d4af37", fontSize: "16px", padding: 0, marginBottom: "20px", cursor: "pointer" }}>
          ← Volver a Colecciones
        </button>
      )}

      {/* VISTA 1: CARPETAS CON BOTÓN DE BORRAR */}
      {!selectedLib && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "15px" }}>
          {libraries.map((lib) => (
            <div key={lib.id} style={s.folderCard} onClick={() => setSelectedLib(lib)}>
              {/* BOTÓN DE BORRAR CARPETA */}
              <button style={s.folderDeleteBtn} onClick={(e) => handleDeleteLibrary(e, lib)} title="Borrar carpeta entera">
                🗑️
              </button>
              
              <div style={{ fontSize: "30px", marginBottom: "10px" }}>📁</div>
              <div style={{ fontWeight: "bold" }}>{lib.nombre}</div>
            </div>
          ))}
        </div>
      )}

      {/* VISTA 2: DENTRO DE LA CARPETA */}
      {selectedLib && (
        <div style={s.listContainer}>
          
          {scanning ? (
            <div style={{ background: "#151515", padding: "15px", borderRadius: "10px", border: "1px solid #333", textAlign: "center", marginBottom: "20px" }}>
              <span style={{ color: "#d4af37", fontWeight: "bold" }}>⏳ Procesando hoja {currentSheet} de {totalSheets}...</span>
              <div style={s.progressBar}><div style={s.progressFill}></div></div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <div style={s.btnScanSingle} onClick={() => singleFileRef.current?.click()}>
                📷 1 Hoja
                <input type="file" accept="image/*" ref={singleFileRef} style={{ display: "none" }} onChange={handleSingleFile} />
              </div>
              <div style={s.btnScanMulti} onClick={() => multipleFileRef.current?.click()}>
                📸 Varias Hojas
                <input type="file" accept="image/*" multiple ref={multipleFileRef} style={{ display: "none" }} onChange={handleMultipleFiles} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "10px" }}>
            {["TODOS", "ANILLO", "DIJE", "PLANCHA"].map(f => (
               <button key={f} onClick={() => setFilterType(f)} style={{ background: filterType === f ? "#d4af37" : "#151515", color: filterType === f ? "#000" : "#fff", border: "1px solid #333", padding: "8px 16px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap" }}>
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
              <button style={s.listAction} onClick={(e) => { e.stopPropagation(); handleDeleteMold(m.id); }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* --- MODAL: REVISIÓN DE LISTA --- */}
      {batchOpen && (
        <div style={s.modalBg}>
          <div style={s.modal}>
            <div style={{ background: "#222", padding: "15px", borderRadius: "8px", marginBottom: "20px", borderLeft: "4px solid #d4af37" }}>
              <label style={{ ...s.label, marginTop: 0 }}>Título de la Hoja (Opcional)</label>
              <input style={s.input} value={batchTitle} onChange={(e) => setBatchTitle(e.target.value)} placeholder="Ej. Anillo Graduación de Mujer" />
            </div>

            <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "15px" }}>Se encontraron <b>{batchMoldes.length}</b> moldes. Revisa la lista antes de guardar.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 2fr 70px 40px", gap: "8px", padding: "0 10px", color: "#888", fontSize: "11px", fontWeight: "bold" }}>
                <span>NÚMERO</span>
                <span>TIPO</span>
                <span>CARRERA / DISEÑO</span>
                <span>MEDIDA</span>
                <span></span>
              </div>
              {batchMoldes.map((m, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "80px 1fr 2fr 70px 40px", gap: "8px", background: "#0a0a0a", padding: "8px", borderRadius: "6px", border: "1px solid #222", alignItems: "center" }}>
                  <input style={{ ...s.input, padding: "8px" }} value={m.numero} onChange={(e) => updateBatchItem(idx, 'numero', e.target.value)} />
                  <input style={{ ...s.input, padding: "8px" }} value={m.tipo} onChange={(e) => updateBatchItem(idx, 'tipo', e.target.value)} placeholder="Tipo"/>
                  <input style={{ ...s.input, padding: "8px" }} value={m.carrera} onChange={(e) => updateBatchItem(idx, 'carrera', e.target.value)} placeholder="Carrera"/>
                  <input style={{ ...s.input, padding: "8px" }} value={m.medida} onChange={(e) => updateBatchItem(idx, 'medida', e.target.value)} placeholder="Medida"/>
                  <button onClick={() => removeBatchItem(idx)} style={{ background: "none", border: "none", color: "#f0b0b0", cursor: "pointer", fontSize: "16px" }}>❌</button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px", position: "sticky", bottom: 0, background: "#151515", paddingTop: "10px" }}>
              <button onClick={saveBatch} disabled={saving} style={{ ...s.btnPrimary, flex: 2, padding: "15px" }}>
                {saving ? "Guardando..." : `💾 Guardar los ${batchMoldes.length} Moldes`}
              </button>
              <button onClick={() => setBatchOpen(false)} style={{ ...s.btnSecondary, flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INDIVIDUAL */}
      {modalOpen && (
        <div style={s.modalBg} onClick={() => setModalOpen(false)}>
          <div style={{...s.modal, maxWidth: "600px"}} onClick={(e) => e.stopPropagation()}>
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
                  <button type="submit" style={{ ...s.btnPrimary, flex: 1 }} disabled={saving}>{saving ? "..." : "💾 Guardar"}</button>
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