import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { FileText, Trash2, FolderOpen, Loader2, Camera, Images, Pencil, Plus, Search, LayoutGrid, X } from "lucide-react";

export default function Moldes() {
  const [libraries, setLibraries] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null);
  const [molds, setMolds] = useState([]);
  const [search, setSearch] = useState("");
  
  const [customCategories, setCustomCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("TODOS");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const [newLibName, setNewLibName] = useState("");
  const [showNewLib, setShowNewLib] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({ numero: "", tipo: "", carrera: "", medida: "", notas: "", foto_url: "" });
  
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchTitle, setBatchTitle] = useState("");
  const [batchMoldes, setBatchMoldes] = useState([]);
  
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSheet, setCurrentSheet] = useState(0);
  const [totalSheets, setTotalSheets] = useState(0);

  const singleFileRef = useRef(null);
  const multipleFileRef = useRef(null);
  const photoInputRef = useRef(null);

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

  const dynamicCategories = useMemo(() => {
    const tiposDeMoldes = molds.map(m => m.tipo?.toUpperCase()).filter(Boolean);
    const combinadas = new Set(["TODOS", ...tiposDeMoldes, ...customCategories.map(c => c.toUpperCase())]);
    return Array.from(combinadas);
  }, [molds, customCategories]);

  const handleCreateCategory = () => {
    if (!newCatName.trim()) return;
    setCustomCategories([...customCategories, newCatName.trim()]);
    setNewCatName("");
    setShowNewCat(false);
    toast.success("Categoría agregada");
  };

  const removeCategory = (cat, e) => {
    e.stopPropagation();
    if (cat === "TODOS") return;
    if (window.confirm(`¿Quitar la categoría "${cat}"?`)) {
      setCustomCategories(customCategories.filter(c => c !== cat));
      if (selectedCategory === cat) setSelectedCategory("TODOS");
    }
  };

  const handleCreateLibrary = async () => {
    if (!newLibName.trim()) return toast.error("Escribe un nombre");
    try {
      await api.post("/libraries", { nombre: newLibName });
      setNewLibName("");
      setShowNewLib(false);
      await loadLibraries();
      toast.success("Carpeta creada");
    } catch { toast.error("Error al crear"); }
  };

  const handleDeleteLibrary = async (e, lib) => {
    e.stopPropagation();
    if (!window.confirm(`¿Borrar carpeta "${lib.nombre}" y TODOS sus moldes?`)) return;
    try {
      await api.delete(`/libraries/${lib.id}`);
      toast.success("Carpeta eliminada");
      await loadLibraries();
    } catch { toast.error("Error al borrar"); }
  };

  const openNewModal = () => {
    setEditing(null);
    setFormData({ numero: "", tipo: selectedCategory !== "TODOS" ? selectedCategory : "", carrera: "", medida: "", notas: "", foto_url: "" });
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
      foto_url: molde.foto_url || ""
    });
    setIsEditMode(false);
    setModalOpen(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const r = await api.post("/molds/upload-photo", data, { headers: { "Content-Type": "multipart/form-data" } });
      if (r.data?.url) {
        setFormData(prev => ({ ...prev, foto_url: r.data.url }));
        toast.success("Foto subida correctamente");
      }
    } catch {
      toast.error("Error al subir la foto");
    } finally {
      setUploadingPhoto(false);
    }
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
        } else {
          toast.warning(`No se detectaron moldes en la foto ${i + 1}.`);
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
      toast.info("Ninguna foto arrojó resultados. Escribe uno a mano.");
      openNewModal();
    }

    if (singleFileRef.current) singleFileRef.current.value = "";
    if (multipleFileRef.current) multipleFileRef.current.value = "";
  };

  const saveBatch = async () => {
    setSaving(true);
    try {
      for (const molde of batchMoldes) {
        if (molde.numero.trim()) {
          const tipoFinal = molde.tipo || "General"; 
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

  const handleDeleteMold = async (id, e) => {
    if (e) e.stopPropagation();
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
      const matchType = selectedCategory === "TODOS" || (m.tipo || "").toUpperCase() === selectedCategory;
      return matchSearch && matchType;
    });
  }, [molds, search, selectedCategory]);

  const s = {
    page: { minHeight: "100vh", background: "transparent", color: "var(--m-text)", padding: "20px", fontFamily: "inherit", paddingBottom: "100px" },
    title: { fontSize: "28px", fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: "var(--m-text)", margin: "0 0 5px 0" },
    searchBox: { display: "flex", alignItems: "center", background: "var(--m-surface)", border: "1px solid var(--m-border)", borderRadius: "25px", padding: "10px 15px", gap: "10px", marginBottom: "20px" },
    searchInput: { flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--m-text)", fontSize: "16px" },
    btnPrimary: { background: "linear-gradient(135deg, #f0d391 0%, #d2ab62 50%, #b08033 100%)", color: "#23180a", border: "none", padding: "12px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" },
    btnSecondary: { background: "var(--m-surface-2)", color: "var(--m-text)", border: "1px solid var(--m-border)", padding: "12px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" },
    folderCard: { background: "var(--m-surface)", border: "1px solid var(--m-border)", borderRadius: "22px", padding: "24px 20px", cursor: "pointer", textAlign: "center", position: "relative", boxShadow: "var(--glass-shadow)" },
    folderDeleteBtn: { position: "absolute", top: "10px", right: "10px", background: "rgba(255,0,0,0.1)", border: "none", borderRadius: "50%", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--m-danger)", fontSize: "14px", cursor: "pointer" },
    catCarousel: { display: "flex", gap: "15px", overflowX: "auto", paddingBottom: "15px", marginBottom: "10px", scrollbarWidth: "none" },
    catItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", cursor: "pointer" },
    catCircle: (isActive) => ({
      width: "60px", height: "60px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      background: isActive ? "linear-gradient(135deg, #f0d391 0%, #d2ab62 50%, #b08033 100%)" : "var(--m-surface)",
      color: isActive ? "#23180a" : "var(--m-gold)",
      border: isActive ? "2px solid var(--m-gold)" : "1px solid var(--m-border)",
      transition: "all 0.2s", position: "relative"
    }),
    catName: { fontSize: "11px", fontWeight: "bold", textAlign: "center", maxWidth: "65px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    grid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" },
    productCard: { background: "var(--m-surface)", border: "1px solid var(--m-border)", borderRadius: "12px", overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", position: "relative" },
    productImg: { width: "100%", aspectRatio: "1", objectFit: "cover", background: "var(--m-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: "bold", color: "var(--m-muted)" },
    productInfo: { padding: "10px", display: "flex", flexDirection: "column", gap: "3px" },
    productNum: { color: "var(--m-gold)", fontWeight: "bold", fontSize: "14px" },
    productTitle: { fontSize: "12px", fontWeight: "bold", color: "var(--m-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    productSub: { fontSize: "11px", color: "var(--m-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    deleteBtn: { position: "absolute", top: "5px", right: "5px", background: "rgba(0,0,0,0.5)", borderRadius: "50%", padding: "4px", border: "none", color: "#fff", zIndex: 2 },
    
    // AQUI ESTA EL ARREGLO DEL MODAL PARA QUE NO SE TAPE CON EL MENU
    modalBg: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "var(--m-overlay)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "15px" },
    modal: { background: "var(--m-surface)", padding: "20px", borderRadius: "16px", width: "100%", maxWidth: "600px", border: "1px solid var(--m-border)", maxHeight: "85vh", display: "flex", flexDirection: "column" },
    modalScroll: { overflowY: "auto", flex: 1, paddingRight: "5px" },
    closeBtn: { background: "var(--m-surface-2)", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--m-text)" },

    readContainer: { background: "var(--m-inset)", border: "1px solid var(--m-border)", borderRadius: "8px", padding: "15px", marginBottom: "10px" },
    readLabel: { fontSize: "12px", color: "var(--m-gold)", textTransform: "uppercase", marginBottom: "5px", display: "block" },
    readValue: { fontSize: "16px", color: "var(--m-text)", whiteSpace: "pre-wrap" },
    label: { fontSize: "12px", color: "var(--m-muted)", marginBottom: "6px", display: "block", marginTop: "10px", fontWeight: "bold" },
    input: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--m-border)", background: "var(--m-inset)", color: "var(--m-text)", boxSizing: "border-box", fontSize: "15px" },
    textarea: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--m-border)", background: "var(--m-inset)", color: "var(--m-text)", boxSizing: "border-box", fontSize: "15px", minHeight: "80px", resize: "vertical" },
    row: { display: "flex", gap: "10px" },
    col: { flex: 1, minWidth: 0 },
    btnScanSingle: { flex: 1, padding: "12px", borderRadius: "8px", border: "1px dashed var(--m-gold)", background: scanning ? "rgba(212,175,55,0.1)" : "var(--m-surface)", color: "var(--m-gold)", fontWeight: "bold", cursor: "pointer", textAlign: "center", display: "flex", justifyContent: "center", alignItems: "center", gap: "5px" },
    btnScanMulti: { flex: 1, padding: "12px", borderRadius: "8px", border: "1px dashed var(--m-gold)", background: scanning ? "rgba(212,175,55,0.1)" : "var(--m-surface)", color: "var(--m-gold)", fontWeight: "bold", cursor: "pointer", textAlign: "center", display: "flex", justifyContent: "center", alignItems: "center", gap: "5px" },
    progressBar: { width: "100%", height: "6px", background: "var(--m-border)", borderRadius: "3px", marginTop: "5px", overflow: "hidden" },
    progressFill: { height: "100%", background: "linear-gradient(135deg, #f0d391 0%, #d2ab62 50%, #b08033 100%)", width: `${progress}%`, transition: "width 0.3s ease" },
    batchCard: { background: "var(--m-inset)", padding: "12px", borderRadius: "8px", border: "1px solid var(--m-border)", marginBottom: "10px" },
    btnAddLib: { background: "transparent", color: "var(--m-gold)", border: "1px dashed var(--m-gold)", padding: "15px", borderRadius: "10px", width: "100%", cursor: "pointer", marginBottom: "20px", fontWeight: "bold", fontSize: "16px" },
    inputNewLib: { width: "100%", padding: "15px", borderRadius: "10px", border: "1px solid var(--m-gold)", background: "var(--m-surface)", color: "var(--m-text)", marginBottom: "10px", boxSizing: "border-box", fontSize: "16px" },
    photoPreview: { width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "8px", marginTop: "10px", border: "1px solid var(--m-border)" },
    btnPhoto: { background: "var(--m-surface-2)", color: "var(--m-text)", border: "1px dashed var(--m-gold)", padding: "10px", borderRadius: "8px", cursor: "pointer", width: "100%", marginTop: "10px", display: "flex", justifyContent: "center", alignItems: "center", gap: "5px" },
    fab: { position: "fixed", bottom: "85px", right: "20px", background: "linear-gradient(135deg, #f0d391 0%, #d2ab62 50%, #b08033 100%)", color: "#23180a", width: "55px", height: "55px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 15px rgba(212,175,55,0.4)", zIndex: 50, border: "none" },
  };

  return (
    <div style={s.page}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <div>
          <h1 style={s.title}>{selectedLib ? selectedLib.nombre : "Mis Colecciones"}</h1>
          <p style={{ color: "var(--m-muted)", fontSize: "14px", margin: 0 }}>{selectedLib ? "Catálogo de Moldes" : "Selecciona o crea una carpeta"}</p>
        </div>
        {selectedLib && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button style={s.btnSecondary} onClick={() => window.print()}><FileText className="inline w-4 h-4 mr-1.5 -mt-0.5" />PDF</button>
          </div>
        )}
      </div>

      <div style={s.searchBox}>
        <Search className="w-5 h-5" style={{ color: "var(--m-muted)" }} />
        <input style={s.searchInput} placeholder="Buscar molde..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {selectedLib && (
        <button onClick={() => { setSelectedLib(null); setSearch(""); }} style={{ background: "none", border: "none", color: "var(--m-gold)", fontSize: "15px", padding: 0, marginBottom: "20px", cursor: "pointer", fontWeight: "bold" }}>
          ← Volver a Colecciones
        </button>
      )}

      {!selectedLib && (
        <>
          {!showNewLib ? (
            <button style={s.btnAddLib} onClick={() => setShowNewLib(true)}>
              + Nueva Colección / Cuaderno
            </button>
          ) : (
            <div style={{ marginBottom: "20px" }}>
              <input autoFocus style={s.inputNewLib} placeholder="Ej. Anillos, Dijes..." value={newLibName} onChange={(e) => setNewLibName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateLibrary()} />
              <div style={{ display: "flex", gap: "10px" }}>
                <button style={{ ...s.btnPrimary, flex: 1 }} onClick={handleCreateLibrary}>Guardar Carpeta</button>
                <button style={{ ...s.btnSecondary, flex: 1 }} onClick={() => { setShowNewLib(false); setNewLibName(""); }}>Cancelar</button>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "15px" }}>
            {libraries.map((lib) => (
              <div key={lib.id} style={s.folderCard} onClick={() => setSelectedLib(lib)}>
                <button style={s.folderDeleteBtn} onClick={(e) => handleDeleteLibrary(e, lib)}><Trash2 className="w-4 h-4" /></button>
                <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}><span className="nav-icon w-14 h-14 rounded-2xl flex items-center justify-center"><FolderOpen className="w-7 h-7" /></span></div>
                <div style={{ fontWeight: "bold" }}>{lib.nombre}</div>
              </div>
            ))}
            {libraries.length === 0 && !showNewLib && (
              <p style={{ color: "var(--m-muted)", gridColumn: "1 / -1", textAlign: "center", marginTop: "20px" }}>No hay carpetas creadas. Crea la primera arriba.</p>
            )}
          </div>
        </>
      )}

      {selectedLib && (
        <>
          {scanning ? (
            <div style={{ background: "var(--m-surface)", padding: "15px", borderRadius: "10px", border: "1px solid var(--m-border)", textAlign: "center", marginBottom: "20px" }}>
              <span style={{ color: "var(--m-gold)", fontWeight: "bold" }}><Loader2 className="inline animate-spin w-4 h-4 mr-1.5 -mt-0.5" />Procesando hoja {currentSheet} de {totalSheets} ({progress}%)</span>
              <div style={s.progressBar}><div style={s.progressFill}></div></div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <div style={s.btnScanSingle} onClick={() => singleFileRef.current?.click()}>
                <Camera className="inline w-4 h-4 mr-1.5 -mt-0.5" />1 Hoja
                <input type="file" accept="image/*" ref={singleFileRef} style={{ display: "none" }} onChange={(e) => processFiles(Array.from(e.target.files))} />
              </div>
              <div style={s.btnScanMulti} onClick={() => multipleFileRef.current?.click()}>
                <Images className="inline w-4 h-4 mr-1.5 -mt-0.5" />Varias Hojas
                <input type="file" accept="image/*" multiple ref={multipleFileRef} style={{ display: "none" }} onChange={(e) => processFiles(Array.from(e.target.files))} />
              </div>
            </div>
          )}

          <div style={s.catCarousel}>
            {dynamicCategories.map(cat => (
              <div key={cat} style={s.catItem} onClick={() => setSelectedCategory(cat)}>
                <div style={s.catCircle(selectedCategory === cat)}>
                  <LayoutGrid className="w-6 h-6" />
                  {cat !== "TODOS" && selectedCategory !== cat && (
                     <div onClick={(e) => removeCategory(cat, e)} style={{ position: "absolute", top: 0, right: 0, background: "var(--m-surface-2)", borderRadius: "50%", padding: "2px" }}>
                        <X className="w-3 h-3 text-red-500" />
                     </div>
                  )}
                </div>
                <span style={s.catName}>{cat}</span>
              </div>
            ))}
            
            <div style={s.catItem} onClick={() => setShowNewCat(true)}>
              <div style={{...s.catCircle(false), borderStyle: "dashed"}}>
                <Plus className="w-6 h-6" />
              </div>
              <span style={s.catName}>Nueva</span>
            </div>
          </div>

          {showNewCat && (
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <input autoFocus style={s.input} placeholder="Ej. Plancha, Dije..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()} />
              <button onClick={handleCreateCategory} style={s.btnPrimary}>OK</button>
              <button onClick={() => setShowNewCat(false)} style={s.btnSecondary}>X</button>
            </div>
          )}

          <div style={s.grid}>
            {filteredMolds.map((m) => (
              <div key={m.id} style={s.productCard} onClick={() => openViewModal(m)}>
                <button style={s.deleteBtn} onClick={(e) => handleDeleteMold(m.id, e)}><Trash2 className="w-4 h-4" /></button>
                
                {m.foto_url ? (
                  <img src={m.foto_url} alt={m.numero} style={s.productImg} />
                ) : (
                  <div style={s.productImg}>{m.numero}</div>
                )}
                
                <div style={s.productInfo}>
                  <span style={s.productNum}>#{m.numero} {m.medida ? `• ${m.medida}` : ""}</span>
                  <span style={s.productTitle}>{m.tipo || "Sin tipo"}</span>
                  <span style={s.productSub}>{m.carrera || "Sin diseño"}</span>
                </div>
              </div>
            ))}
          </div>
          
          {filteredMolds.length === 0 && (
            <p style={{ color: "var(--m-muted)", textAlign: "center", marginTop: "30px" }}>No hay moldes en esta categoría.</p>
          )}

          <button style={s.fab} onClick={openNewModal}><Plus className="w-6 h-6" /></button>
        </>
      )}

      {batchOpen && (
        <div style={s.modalBg}>
          <div style={s.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h2 style={{ color: "var(--m-gold)", margin: 0, fontSize: "20px" }}>Revisar Lista</h2>
              <button style={s.closeBtn} onClick={() => setBatchOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <div style={{ background: "var(--m-surface-2)", padding: "15px", borderRadius: "8px", marginBottom: "15px", borderLeft: "4px solid var(--m-gold)" }}>
              <label style={{ ...s.label, marginTop: 0 }}>Título de la Hoja</label>
              <input style={s.input} value={batchTitle} onChange={(e) => setBatchTitle(e.target.value)} placeholder="Ej. Anillo Graduación" />
            </div>

            <p style={{ color: "var(--m-muted)", fontSize: "14px", marginBottom: "15px" }}>Se encontraron <b>{batchMoldes.length}</b> moldes.</p>
            
            <div style={{ ...s.modalScroll, display: "flex", flexDirection: "column" }}>
              {batchMoldes.map((m, idx) => (
                <div key={idx} style={s.batchCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ color: "var(--m-gold)", fontWeight: "bold", fontSize: "12px" }}>MOLDE {idx + 1}</span>
                    <button onClick={() => setBatchMoldes(batchMoldes.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "var(--m-danger)", cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}>Quitar</button>
                  </div>
                  <div style={s.row}>
                    <div style={s.col}><label style={s.label}>N°</label><input style={s.input} value={m.numero} onChange={(e) => updateBatchItem(idx, 'numero', e.target.value)} /></div>
                    <div style={s.col}><label style={s.label}>Medida</label><input style={s.input} value={m.medida} onChange={(e) => updateBatchItem(idx, 'medida', e.target.value)} placeholder="Ej. 10x8" /></div>
                  </div>
                  <label style={s.label}>Tipo</label>
                  <input style={s.input} value={m.tipo} onChange={(e) => updateBatchItem(idx, 'tipo', e.target.value)} placeholder="Ej. Anillo..." />
                  <label style={s.label}>Carrera / Diseño</label>
                  <textarea style={{...s.textarea, minHeight: "60px"}} value={m.carrera} onChange={(e) => updateBatchItem(idx, 'carrera', e.target.value)} />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "15px", paddingTop: "10px", borderTop: "1px solid var(--m-border)" }}>
              <button onClick={saveBatch} disabled={saving} style={{ ...s.btnPrimary, flex: 2, padding: "15px" }}>
                {saving ? "Guardando..." : `Guardar ${batchMoldes.length} Moldes`}
              </button>
              <button onClick={() => setBatchOpen(false)} style={{ ...s.btnSecondary, flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div style={s.modalBg} onClick={() => setModalOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            
            {/* BARRA SUPERIOR CON BOTÓN DE CERRAR (X) SIEMPRE VISIBLE */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexShrink: 0 }}>
              <h2 style={{ color: "var(--m-gold)", margin: 0, fontSize: "20px" }}>{editing ? (isEditMode ? "Editar Molde" : "Detalles") : "Nuevo Molde"}</h2>
              <button style={s.closeBtn} onClick={() => setModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            
            {/* CONTENEDOR CON SCROLL INTERNO */}
            <div style={s.modalScroll}>
              {!isEditMode && editing ? (
                <div>
                  {formData.foto_url && <img src={formData.foto_url} alt="Molde" style={s.photoPreview} />}
                  <div style={{...s.readContainer, marginTop: formData.foto_url ? "15px" : "0"}}>
                    <span style={s.readLabel}>Número</span>
                    <div style={{ ...s.readValue, fontSize: "24px", color: "var(--m-gold)", fontWeight: "bold" }}>{formData.numero}</div>
                  </div>
                  <div style={s.readContainer}><span style={s.readLabel}>Tipo</span><div style={s.readValue}>{formData.tipo || "-"}</div></div>
                  <div style={s.readContainer}><span style={s.readLabel}>Carrera / Diseño</span><div style={s.readValue}>{formData.carrera || "-"}</div></div>
                  <div style={s.row}>
                    <div style={{...s.readContainer, flex: 1}}><span style={s.readLabel}>Medida</span><div style={s.readValue}>{formData.medida || "-"}</div></div>
                    <div style={{...s.readContainer, flex: 1}}><span style={s.readLabel}>Notas</span><div style={s.readValue}>{formData.notas || "-"}</div></div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                    <button style={{ ...s.btnPrimary, flex: 1 }} onClick={() => setIsEditMode(true)}><Pencil className="inline w-4 h-4 mr-1.5 -mt-0.5" />Editar</button>
                    <button style={{ ...s.btnSecondary, flex: 1 }} onClick={() => setModalOpen(false)}>Cerrar</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSave}>
                  <label style={s.label}>Foto del Molde (Opcional)</label>
                  {formData.foto_url && <img src={formData.foto_url} alt="Molde" style={s.photoPreview} />}
                  <button type="button" style={s.btnPhoto} onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                    {uploadingPhoto ? "Subiendo foto..." : "Subir / Cambiar foto"}
                  </button>
                  <input type="file" accept="image/*" ref={photoInputRef} style={{ display: "none" }} onChange={handlePhotoUpload} disabled={uploadingPhoto} />

                  <div style={s.row}>
                    <div style={s.col}><label style={s.label}>Número</label><input style={s.input} required value={formData.numero} onChange={(e) => setFormData({...formData, numero: e.target.value})} /></div>
                    <div style={s.col}><label style={s.label}>Tipo</label><input style={s.input} value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value})} placeholder="Anillo, Dije..." /></div>
                  </div>
                  <label style={s.label}>Carrera / Diseño</label>
                  <textarea style={s.textarea} value={formData.carrera} onChange={(e) => setFormData({...formData, carrera: e.target.value})} />
                  <div style={s.row}>
                    <div style={s.col}><label style={s.label}>Medida</label><input style={s.input} value={formData.medida} onChange={(e) => setFormData({...formData, medida: e.target.value})} /></div>
                    <div style={s.col}><label style={s.label}>Notas</label><input style={s.input} value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} /></div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", marginTop: "25px" }}>
                    <button type="submit" style={{ ...s.btnPrimary, flex: 1 }} disabled={saving || uploadingPhoto}>{saving ? "..." : "Guardar"}</button>
                    <button type="button" style={{ ...s.btnSecondary, flex: 1 }} onClick={() => editing ? setIsEditMode(false) : setModalOpen(false)}>Cancelar</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}