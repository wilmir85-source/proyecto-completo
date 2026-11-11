import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function Moldes() {
  const [libraries, setLibraries] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null);
  const [molds, setMolds] = useState([]);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("TODOS");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({ numero: "", tipo: "", carrera: "", medida: "", notas: "" });

  // --- NUEVOS ESTADOS PARA EL MODO LOTE ---
  const [batchMoldes, setBatchMoldes] = useState([]);
  const [batchOpen, setBatchOpen] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);
  const batchInputRef = useRef(null);

  // Carga de librerías
  const loadLibraries = useCallback(async () => {
    try {
      const r = await api.get("/libraries");
      setLibraries(Array.isArray(r.data) ? r.data : []);
    } catch {
      toast.error("Error al cargar carpetas");
    }
  }, []);

  useEffect(() => { loadLibraries(); }, [loadLibraries]);

  // Carga de moldes de la librería seleccionada
  const loadMolds = useCallback(async () => {
    if (!selectedLib) return;
    try {
      const r = await api.get(`/libraries/${selectedLib.id}/molds`);
      setMolds(Array.isArray(r.data) ? r.data : []);
    } catch {
      toast.error("Error al cargar moldes");
    }
  }, [selectedLib]);

  useEffect(() => { loadMolds(); }, [selectedLib, loadMolds]);

  const openNewModal = () => {
    setEditing(null);
    setFormData({ numero: "", tipo: "", carrera: "", medida: "", notas: "" });
    setIsEditMode(true);
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
    setIsEditMode(false);
    setModalOpen(true);
  };

  // Simulación animada de escaneo Gemini OCR
  useEffect(() => {
    let interval;
    if (scanning) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 95 ? 95 : prev + Math.floor(Math.random() * 12) + 2));
      }, 250);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [scanning]);

  // Manejo de lectura manuscrita con Gemini AI (OCR) - MODO INDIVIDUAL
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/molds/scan", fd, { headers: { "Content-Type": "multipart/form-data" } });
      
      if (r.data?.datos) {
        const d = r.data.datos;
        setFormData({
          numero: d.numero || "",
          tipo: d.tipo || "",
          carrera: d.carrera || "",
          medida: d.medida || "",
          notas: d.notas || "",
        });
        toast.success("✨ Manuscrito interpretado por Gemini");
      }
    } catch {
      toast.error("Error al escanear texto manuscrito");
    } finally {
      setScanning(false);
    }
  };

  // --- NUEVO: MANEJO DE LECTURA DE HOJA COMPLETA (MODO LOTE) ---
  const handleBatchFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/molds/scan", fd, { headers: { "Content-Type": "multipart/form-data" } });
      
      // Si el backend devuelve el arreglo "moldes"
      if (r.data?.moldes && r.data.moldes.length > 0) {
        setBatchMoldes(r.data.moldes);
        setBatchOpen(true);
        toast.success(`¡Se encontraron ${r.data.moldes.length} moldes en la hoja!`);
      } else {
        toast.error("No se detectaron moldes en la hoja. Intenta con una foto más clara.");
      }
    } catch {
      toast.error("Error al escanear la hoja completa");
    } finally {
      setScanning(false);
      if (batchInputRef.current) batchInputRef.current.value = "";
    }
  };

  // Guardar todos los moldes del lote
  const saveBatch = async () => {
    setSaving(true);
    try {
      let guardados = 0;
      for (const m of batchMoldes) {
        if (m.numero.trim()) {
          await api.post("/molds", { libreria_id: selectedLib.id, ...m });
          guardados++;
        }
      }
      toast.success(`¡${guardados} moldes guardados exitosamente!`);
      setBatchOpen(false);
      setBatchMoldes([]);
      await loadMolds();
    } catch {
      toast.error("Error al guardar el lote");
    } finally {
      setSaving(false);
    }
  };

  // Editar un elemento dentro del lote antes de guardar
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
      if (editing) {
        await api.put(`/molds/${editing.id}`, formData);
        toast.success("Molde actualizado");
      } else {
        await api.post("/molds", { libreria_id: selectedLib?.id, ...formData });
        toast.success("Molde guardado en biblioteca");
      }
      await loadMolds();
      setModalOpen(false);
    } catch {
      toast.error("Error al guardar en base de datos");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este molde del listado?")) return;
    try {
      await api.delete(`/molds/${id}`);
      await loadMolds();
      toast.success("Molde eliminado");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const exportToPDF = () => {
    window.print();
  };

  // Filtrado optimizado multi-campo
  const filteredMolds = useMemo(() => {
    const q = search.toLowerCase();
    return molds.filter((m) => {
      const matchesSearch =
        (m.numero || "").toLowerCase().includes(q) ||
        (m.tipo || "").toLowerCase().includes(q) ||
        (m.carrera || "").toLowerCase().includes(q) ||
        (m.medida || "").toLowerCase().includes(q);

      if (filterTag === "TODOS") return matchesSearch;
      return matchesSearch && (m.tipo || "").toUpperCase().includes(filterTag);
    });
  }, [molds, search, filterTag]);

  return (
    <div style={styles.page}>
      {/* ESTILOS GLOBALES DE ANIMACIÓN E IMPRESIÓN */}
      <style>{`
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 5px rgba(212,175,55,0.2); }
          50% { box-shadow: 0 0 15px rgba(212,175,55,0.6); }
          100% { box-shadow: 0 0 5px rgba(212,175,55,0.2); }
        }
        .spotify-card {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .spotify-card:hover {
          background: #1e1e1e !important;
          transform: translateY(-2px);
          border-color: #d4af37 !important;
        }
        .tag-chip {
          transition: all 0.2s ease;
        }
        .tag-chip:hover {
          background: #d4af37 !important;
          color: #000 !important;
        }
        @media print {
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { position: absolute; left: 0; top: 0; width: 100%; color: black; background: white; padding: 20px; }
          .no-print { display: none !important; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #333; padding: 10px; text-align: left; font-size: 12px; }
          th { background-color: #f2f2f2; font-weight: bold; }
        }
      `}</style>

      {/* HEADER SUPERIOR */}
      <div className="no-print" style={styles.header}>
        <div>
          <span style={styles.kicker}>Catálogo de Moldes CAD / Joyería</span>
          <h1 style={styles.title}>{selectedLib ? selectedLib.nombre : "Mis Colecciones"}</h1>
        </div>
        {selectedLib && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button style={styles.btnSecondary} onClick={exportToPDF}>📄 PDF</button>
            {/* NUEVO BOTÓN MODO LOTE */}
            <button style={styles.btnSecondary} onClick={() => batchInputRef.current?.click()} disabled={scanning}>
              {scanning ? "⏳ Leyendo hoja..." : "📷 Escanear Hoja"}
            </button>
            <input type="file" accept="image/*" ref={batchInputRef} style={{ display: "none" }} onChange={handleBatchFileChange} disabled={scanning} />
            
            <button style={styles.btnPrimary} onClick={openNewModal}>+ Nuevo Molde</button>
          </div>
        )}
      </div>

      {/* BARRA DE BÚSQUEDA TIPO SPOTIFY */}
      <div className="no-print" style={styles.searchSection}>
        <div style={styles.searchWrapper}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder={selectedLib ? "Buscar por número, tipo, carrera (ej. Perito, 13x13)..." : "Buscar en colecciones..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* VOLVER A COLECCIONES Y CHIPS DE FILTRADO */}
      {selectedLib && (
        <div className="no-print" style={styles.filterBar}>
          <button onClick={() => { setSelectedLib(null); setSearch(""); }} style={styles.btnBack}>
            ← Volver a Colecciones
          </button>
          <div style={styles.chipGroup}>
            {["TODOS", "ANILLO", "DIJE", "PLANCHA"].map((tag) => (
              <button
                key={tag}
                className="tag-chip"
                onClick={() => setFilterTag(tag)}
                style={{
                  ...styles.chip,
                  background: filterTag === tag ? "#d4af37" : "#1a1a1a",
                  color: filterTag === tag ? "#000" : "#888",
                  borderColor: filterTag === tag ? "#d4af37" : "#333",
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* VISTA 1: CARPETAS / COLECCIONES DE MOLDES */}
      {!selectedLib && (
        <div className="no-print" style={styles.gridFolders}>
          {libraries.map((lib) => (
            <div key={lib.id} style={styles.folderCard} className="spotify-card" onClick={() => setSelectedLib(lib)}>
              <div style={styles.folderCover}>
                <span style={{ fontSize: "36px" }}>📁</span>
              </div>
              <div style={styles.folderTitle}>{lib.nombre}</div>
              <div style={styles.folderSub}>Toca para abrir catálogo</div>
            </div>
          ))}
          {libraries.length === 0 && (
            <p style={{ color: "#666", gridColumn: "1/-1", textAlign: "center", padding: "40px" }}>
              No tienes carpetas creadas. Crea una desde tu panel general.
            </p>
          )}
        </div>
      )}

      {/* VISTA 2: LISTADO DE MOLDES ESTILO SPOTIFY TRACKLIST */}
      {selectedLib && (
        <div className="no-print" style={styles.trackList}>
          {filteredMolds.map((m) => (
            <div key={m.id} style={styles.trackCard} className="spotify-card" onClick={() => openViewModal(m)}>
              {/* Badge de Número de Molde (Tipo Portada de Álbum) */}
              <div style={styles.albumBadge}>
                <span style={styles.badgeNum}>#{m.numero}</span>
              </div>

              {/* Contenido Principal */}
              <div style={styles.trackDetails}>
                <div style={styles.trackTitle}>
                  {m.tipo || "Molde General"} <span style={styles.trackMeasure}>{m.medida ? `(${m.medida})` : ""}</span>
                </div>
                <div style={styles.trackSub}>{m.carrera || "Sin especificación de carrera"}</div>
                {m.notas && <div style={styles.trackNotes}>📝 {m.notas}</div>}
              </div>

              {/* Botón de Acción */}
              <button
                style={styles.btnDeleteTrack}
                title="Eliminar molde"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(m.id);
                }}
              >
                🗑️
              </button>
            </div>
          ))}

          {filteredMolds.length === 0 && (
            <div style={styles.emptyState}>
              <span style={{ fontSize: "40px", display: "block", marginBottom: "10px" }}>💍</span>
              No se encontraron moldes registrados en esta lista.
            </div>
          )}
        </div>
      )}

      {/* VISTA OCULTA DE IMPRESIÓN (PDF) */}
      {selectedLib && (
        <div id="print-section" style={{ display: "none" }}>
          <h2 style={{ borderBottom: "2px solid #000", paddingBottom: "10px" }}>LISTADO TÉCNICO DE MOLDES: {selectedLib.nombre}</h2>
          <table>
            <thead>
              <tr>
                <th>N° MOLDE</th>
                <th>TIPO</th>
                <th>CARRERA / DISEÑO</th>
                <th>MEDIDA</th>
                <th>NOTAS ADICIONALES</th>
              </tr>
            </thead>
            <tbody>
              {filteredMolds.map((m) => (
                <tr key={m.id}>
                  <td><strong>#{m.numero}</strong></td>
                  <td>{m.tipo || "-"}</td>
                  <td>{m.carrera || "-"}</td>
                  <td>{m.medida || "-"}</td>
                  <td>{m.notas || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ======================================================== */}
      {/* NUEVO MODAL: REVISIÓN DE LISTA EXTRAÍDA (MODO LOTE)      */}
      {/* ======================================================== */}
      {batchOpen && (
        <div className="no-print" style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <h2 style={{ color: "#d4af37", margin: 0, fontSize: "20px" }}>
                📋 Revisar {batchMoldes.length} Moldes Extraídos
              </h2>
            </div>
            
            <p style={{ color: "#aaa", fontSize: "13px", marginBottom: "15px" }}>
              Gemini leyó tu cuaderno. Revisa que los datos estén correctos antes de guardarlos todos en la base de datos.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "50vh", overflowY: "auto", paddingRight: "5px" }}>
              {batchMoldes.map((m, idx) => (
                <div key={idx} style={{ background: "#0a0a0c", padding: "12px", borderRadius: "8px", border: "1px solid #333" }}>
                  <div style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>N° Molde</label>
                      <input style={{ ...styles.input, padding: "8px" }} value={m.numero} onChange={(e) => updateBatchItem(idx, 'numero', e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Tipo</label>
                      <input style={{ ...styles.input, padding: "8px" }} value={m.tipo} onChange={(e) => updateBatchItem(idx, 'tipo', e.target.value)} />
                    </div>
                  </div>
                  <div style={{ marginBottom: "8px" }}>
                    <label style={styles.label}>Carrera / Diseño</label>
                    <input style={{ ...styles.input, padding: "8px" }} value={m.carrera} onChange={(e) => updateBatchItem(idx, 'carrera', e.target.value)} />
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Medida</label>
                      <input style={{ ...styles.input, padding: "8px" }} value={m.medida} onChange={(e) => updateBatchItem(idx, 'medida', e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Notas</label>
                      <input style={{ ...styles.input, padding: "8px" }} value={m.notas} onChange={(e) => updateBatchItem(idx, 'notas', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px", borderTop: "1px solid #333", paddingTop: "15px" }}>
              <button onClick={saveBatch} disabled={saving} style={{ ...styles.btnPrimary, flex: 1 }}>
                {saving ? "Guardando..." : `💾 Guardar los ${batchMoldes.length} Moldes`}
              </button>
              <button onClick={() => setBatchOpen(false)} style={{ ...styles.btnSecondary, flex: 1 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FICHA DE MOLDE (LECTURA Y EDICIÓN CON LECTOR OCR INDIVIDUAL) */}
      {modalOpen && (
        <div className="no-print" style={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={{ color: "#d4af37", margin: 0, fontSize: "20px" }}>
                {editing ? (isEditMode ? "✏️ Editar Ficha de Molde" : "🔍 Ficha Técnica del Molde") : "✨ Agregar Nuevo Molde"}
              </h2>
              {editing && !isEditMode && (
                <button style={styles.btnEditHeader} onClick={() => setIsEditMode(true)}>✏️ Editar</button>
              )}
            </div>

            {/* BOTÓN DE ESCANEO OCR INDIVIDUAL */}
            {!editing && (
              <div style={styles.scanBox} onClick={() => !scanning && fileInputRef.current?.click()}>
                {scanning ? (
                  <>
                    <div style={{ color: "#d4af37", fontWeight: "bold" }}>🤖 Gemini leyendo manuscrito...</div>
                    <div style={styles.progressTrack}>
                      <div style={{ ...styles.progressBarFill, width: `${progress}%` }} />
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "22px" }}>📷</span>
                    <span style={{ color: "#d4af37", fontWeight: "bold" }}>Escanear 1 solo molde</span>
                    <span style={{ color: "#666", fontSize: "12px" }}>Usa el botón "Escanear Hoja" para listas completas</span>
                  </>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} disabled={scanning} />
              </div>
            )}

            {/* MODO LECTURA SOLO VER */}
            {!isEditMode && editing ? (
              <div>
                <div style={styles.readCardLarge}>
                  <span style={styles.readLabel}>NÚMERO DE MOLDE DE FÁBRICA</span>
                  <div style={styles.readValBig}>#{formData.numero}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div style={styles.readCard}>
                    <span style={styles.readLabel}>TIPO DE JOYA</span>
                    <div style={styles.readVal}>{formData.tipo || "No especificado"}</div>
                  </div>
                  <div style={styles.readCard}>
                    <span style={styles.readLabel}>MEDIDA DE PLANCHA / PIEZA</span>
                    <div style={styles.readVal}>{formData.medida || "Sin medida"}</div>
                  </div>
                </div>

                <div style={styles.readCard}>
                  <span style={styles.readLabel}>CARRERA / MOTIVO DE GRADUACIÓN</span>
                  <div style={styles.readVal}>{formData.carrera || "No especificada"}</div>
                </div>

                {formData.notas && (
                  <div style={styles.readCard}>
                    <span style={styles.readLabel}>NOTAS ADICIONALES DE TALLER</span>
                    <div style={styles.readVal}>{formData.notas}</div>
                  </div>
                )}

                <button style={{ ...styles.btnSecondary, width: "100%", marginTop: "15px" }} onClick={() => setModalOpen(false)}>
                  Cerrar
                </button>
              </div>
            ) : (
              /* MODO FORMULARIO / EDICIÓN */
              <form onSubmit={handleSave}>
                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>N° Molde *</label>
                    <input style={styles.input} required placeholder="Ej. 45, 212..." value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Tipo de Joya</label>
                    <input style={styles.input} placeholder="Ej. Anillo, Dije, Plancha..." value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })} />
                  </div>
                </div>

                <label style={styles.label}>Carrera / Motivo de Graduación</label>
                <textarea style={styles.textarea} placeholder="Ej. Perito en Administración de Empresas..." value={formData.carrera} onChange={(e) => setFormData({ ...formData, carrera: e.target.value })} />

                <div style={styles.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Medida</label>
                    <input style={styles.input} placeholder="Ej. 13x13 mm, 10x8..." value={formData.medida} onChange={(e) => setFormData({ ...formData, medida: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Notas adicionales</label>
                    <input style={styles.input} placeholder="Ej. Cliente especial, bisel pulido..." value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <button type="submit" style={{ ...styles.btnPrimary, flex: 1 }} disabled={saving || scanning}>
                    {saving ? "Guardando..." : "💾 Guardar Molde"}
                  </button>
                  <button type="button" style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => (editing ? setIsEditMode(false) : setModalOpen(false))}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// OBJETO DE ESTILOS UNIFICADO (DARK SPOTIFY STYLE)
const styles = {
  page: { minHeight: "100vh", background: "#0c0c0e", color: "#f0f0f0", padding: "20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", paddingBottom: "80px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px", flexWrap: "wrap", gap: "10px" },
  kicker: { color: "#d4af37", fontSize: "11px", fontWeight: "bold", letterSpacing: "1.5px", textTransform: "uppercase" },
  title: { fontSize: "28px", fontWeight: "800", margin: "4px 0 0 0", color: "#ffffff" },
  
  btnPrimary: { background: "#d4af37", color: "#000", border: "none", padding: "12px 20px", borderRadius: "8px", fontWeight: "700", cursor: "pointer", fontSize: "14px" },
  btnSecondary: { background: "#1a1a1e", color: "#ccc", border: "1px solid #333", padding: "12px 18px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "14px" },

  searchSection: { marginBottom: "15px" },
  searchWrapper: { position: "relative", display: "flex", alignItems: "center" },
  searchIcon: { position: "absolute", left: "15px", color: "#666", fontSize: "16px" },
  searchInput: { width: "100%", padding: "14px 14px 14px 45px", borderRadius: "10px", border: "1px solid #222", background: "#141417", color: "#fff", fontSize: "15px", boxSizing: "border-box", outline: "none" },

  filterBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "10px", flexWrap: "wrap" },
  btnBack: { background: "none", border: "none", color: "#d4af37", fontSize: "14px", fontWeight: "bold", cursor: "pointer", padding: 0 },
  chipGroup: { display: "flex", gap: "8px", flexWrap: "wrap" },
  chip: { padding: "6px 14px", borderRadius: "20px", border: "1px solid #333", fontSize: "12px", fontWeight: "bold", cursor: "pointer" },

  gridFolders: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "15px" },
  folderCard: { background: "#141417", border: "1px solid #222", borderRadius: "12px", padding: "18px", cursor: "pointer", textAlign: "center" },
  folderCover: { width: "60px", height: "60px", background: "#1f1f24", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px auto" },
  folderTitle: { fontWeight: "700", fontSize: "15px", color: "#fff", marginBottom: "4px" },
  folderSub: { fontSize: "12px", color: "#666" },

  trackList: { display: "flex", flexDirection: "column", gap: "8px" },
  trackCard: { background: "#141417", border: "1px solid #222", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "15px", cursor: "pointer" },
  albumBadge: { width: "48px", height: "48px", background: "linear-gradient(135deg, #222, #111)", border: "1px solid #d4af37", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  badgeNum: { color: "#d4af37", fontWeight: "bold", fontSize: "14px" },
  trackDetails: { flex: 1, display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" },
  trackTitle: { fontSize: "15px", fontWeight: "bold", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  trackMeasure: { fontSize: "13px", color: "#d4af37", fontWeight: "normal" },
  trackSub: { fontSize: "13px", color: "#999", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  trackNotes: { fontSize: "12px", color: "#666", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  btnDeleteTrack: { background: "none", border: "none", fontSize: "16px", cursor: "pointer", padding: "8px", opacity: 0.7, flexShrink: 0 },

  emptyState: { textAlign: "center", padding: "40px", color: "#555", background: "#141417", borderRadius: "12px", border: "1px dashed #222" },

  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "15px" },
  modalBox: { background: "#141417", border: "1px solid #333", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "550px", maxHeight: "90vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  btnEditHeader: { background: "#d4af37", color: "#000", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" },

  scanBox: { border: "1px dashed #d4af37", background: "rgba(212,175,55,0.05)", borderRadius: "10px", padding: "16px", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginBottom: "20px" },
  progressTrack: { width: "100%", height: "4px", background: "#222", borderRadius: "2px", overflow: "hidden", marginTop: "8px" },
  progressBarFill: { height: "100%", background: "#d4af37", transition: "width 0.2s ease" },

  readCardLarge: { background: "#0a0a0c", border: "1px solid #26262a", borderRadius: "10px", padding: "15px", marginBottom: "12px" },
  readCard: { background: "#0a0a0c", border: "1px solid #26262a", borderRadius: "10px", padding: "12px", marginBottom: "12px" },
  readLabel: { fontSize: "11px", color: "#d4af37", fontWeight: "bold", letterSpacing: "1px", display: "block", marginBottom: "4px" },
  readValBig: { fontSize: "26px", color: "#fff", fontWeight: "bold" },
  readVal: { fontSize: "15px", color: "#e0e0e0" },

  formRow: { display: "flex", gap: "12px", marginBottom: "12px" },
  label: { fontSize: "12px", color: "#aaa", fontWeight: "bold", marginBottom: "6px", display: "block" },
  input: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #2a2a2e", background: "#0a0a0c", color: "#fff", fontSize: "14px", boxSizing: "border-box" },
  textarea: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #2a2a2e", background: "#0a0a0c", color: "#fff", fontSize: "14px", boxSizing: "border-box", minHeight: "80px", resize: "vertical", marginBottom: "12px" }
};