import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: API });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const norm = (s) =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function Moldes() {
  const [libraries, setLibraries] = useState([]);
  const [selectedLib, setSelectedLib] = useState(null);
  const [molds, setMolds] = useState([]);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [numero, setNumero] = useState("");
  const [texto, setTexto] = useState("");

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    api.get("/api/libraries")
      .then((r) => {
        setLibraries(r.data);
        if (r.data.length && !selectedLib) setSelectedLib(r.data[0]);
      })
      .catch(() => showToast("No se pudieron cargar las carpetas", "error"));
  }, []);

  useEffect(() => {
    if (!selectedLib) return;
    api.get(`/api/libraries/${selectedLib.id}/molds`)
      .then((r) => setMolds(r.data))
      .catch(() => showToast("No se pudieron cargar los moldes", "error"));
  }, [selectedLib]);

  const filteredMolds = useMemo(() => {
    const q = norm(search).trim();
    if (!q) return molds;
    return molds.filter(
      (m) => norm(m.numero).includes(q) || norm(m.texto).includes(q)
    );
  }, [molds, search]);

  const reloadMolds = async () => {
    if (!selectedLib) return;
    const r = await api.get(`/api/libraries/${selectedLib.id}/molds`);
    setMolds(r.data);
  };

  const openNewModal = () => {
    setEditing(null);
    setNumero("");
    setTexto("");
    setModalOpen(true);
  };

  const openEditModal = (molde) => {
    setEditing(molde);
    setNumero(molde.numero || "");
    setTexto(molde.texto || "");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving || scanning) return;
    setModalOpen(false);
    setEditing(null);
    setNumero("");
    setTexto("");
  };

  const handleScanClick = () => fileInputRef.current?.click();

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
        setEditing(null);
        setNumero("");
        setTexto(r.data.texto);
        setModalOpen(true);
        showToast("Texto extraído. Revísalo y guarda.", "success");
      } else {
        showToast("No se detectó texto en la imagen", "error");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Error al escanear la imagen";
      showToast(msg, "error");
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!numero.trim()) {
      showToast("Falta el número del molde", "error");
      return;
    }
    if (!selectedLib) {
      showToast("Selecciona una carpeta primero", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/molds/${editing.id}`, { numero, texto });
        showToast("Molde actualizado", "success");
      } else {
        await api.post("/api/molds", {
          libreria_id: selectedLib.id,
          numero,
          texto,
        });
        showToast("Molde guardado", "success");
      }
      await reloadMolds();
      closeModal();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Error al guardar";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (molde) => {
    if (!confirm(`¿Borrar el molde "${molde.numero}"?`)) return;
    try {
      await api.delete(`/api/molds/${molde.id}`);
      await reloadMolds();
      showToast("Molde borrado", "success");
    } catch {
      showToast("Error al borrar", "error");
    }
  };

  const handlePdf = (molde) => {
    const token = localStorage.getItem("token");
    const url = `${API}/api/molds/${molde.id}/pdf${token ? `?token=${token}` : ""}`;
    window.open(url, "_blank");
  };

  const styles = {
    page: {
      minHeight: "100vh",
      background: "radial-gradient(1200px 600px at 20% 0%, #1a1712 0%, #0b0b0d 60%, #08080a 100%)",
      color: "#e9e6df",
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: "32px 24px 64px",
    },
    header: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      flexWrap: "wrap", gap: 16, marginBottom: 24,
    },
    title: {
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: 34, letterSpacing: 1, margin: 0,
      background: "linear-gradient(90deg,#e5c88a,#c9a961)",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    },
    btnGold: {
      background: "linear-gradient(135deg,#d4af37,#b8912b)",
      color: "#1a1408", border: "none", padding: "12px 20px",
      borderRadius: 10, fontWeight: 700, cursor: "pointer",
      boxShadow: "0 6px 20px rgba(212,175,55,0.25)",
    },
    btnGhost: {
      background: "transparent", color: "#d4af37",
      border: "1px solid rgba(212,175,55,0.5)", padding: "12px 20px",
      borderRadius: 10, fontWeight: 600, cursor: "pointer",
    },
    search: {
      width: "100%", maxWidth: 480, padding: "12px 16px",
      background: "#151515", border: "1px solid #262626",
      borderRadius: 10, color: "#e9e6df", outline: "none",
    },
    libBar: {
      display: "flex", gap: 8, flexWrap: "wrap", margin: "18px 0",
    },
    libChip: (active) => ({
      padding: "8px 14px", borderRadius: 999, cursor: "pointer",
      fontSize: 13, fontWeight: 600,
      background: active ? "rgba(212,175,55,0.15)" : "#141414",
      color: active ? "#e5c88a" : "#8a8a8a",
      border: active ? "1px solid rgba(212,175,55,0.6)" : "1px solid #222",
    }),
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      gap: 16, marginTop: 20,
    },
    card: {
      background: "linear-gradient(180deg,#131313,#0e0e10)",
      border: "1px solid #232323", borderRadius: 14,
      padding: 18, cursor: "pointer",
      transition: "all .18s ease",
      display: "flex", flexDirection: "column", gap: 10,
    },
    cardNum: {
      fontSize: 20, fontWeight: 700, color: "#e5c88a",
      fontFamily: "'Cormorant Garamond', serif",
    },
    cardText: {
      fontSize: 13, color: "#9a9488", whiteSpace: "pre-wrap",
      maxHeight: 120, overflow: "hidden",
    },
    cardActions: {
      display: "flex", gap: 8, marginTop: "auto", paddingTop: 8,
    },
    iconBtn: {
      background: "#1a1a1a", border: "1px solid #2a2a2a",
      color: "#c9a961", padding: "6px 10px",
      borderRadius: 8, cursor: "pointer", fontSize: 12,
    },
    iconBtnDanger: {
      background: "#1a1a1a", border: "1px solid #3a1f1f",
      color: "#e08b8b", padding: "6px 10px",
      borderRadius: 8, cursor: "pointer", fontSize: 12,
    },
    modalBackdrop: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(4px)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
    },
    modal: {
      background: "linear-gradient(180deg,#161616,#0f0f11)",
      border: "1px solid #2a2a2a", borderRadius: 16,
      padding: 24, width: "100%", maxWidth: 560,
      boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
    },
    label: { fontSize: 12, color: "#8a8a8a", marginBottom: 6, display: "block" },
    input: {
      width: "100%", padding: "10px 12px", background: "#0e0e0e",
      border: "1px solid #262626", borderRadius: 8,
      color: "#e9e6df", outline: "none", fontSize: 14,
      boxSizing: "border-box",
    },
    textarea: {
      width: "100%", minHeight: 160, padding: "10px 12px",
      background: "#0e0e0e", border: "1px solid #262626",
      borderRadius: 8, color: "#e9e6df", outline: "none",
      fontSize: 14, resize: "vertical", fontFamily: "inherit",
      boxSizing: "border-box",
    },
    modalActions: {
      display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18,
    },
    toast: (type) => ({
      position: "fixed", bottom: 24, right: 24,
      background: type === "error" ? "#3a1a1a" : type === "success" ? "#1a3a24" : "#1a1a1a",
      color: type === "error" ? "#f0b0b0" : type === "success" ? "#a8f0c0" : "#e9e6df",
      border: "1px solid " + (type === "error" ? "#5a2a2a" : type === "success" ? "#2a5a3a" : "#333"),
      padding: "12px 18px", borderRadius: 10, fontSize: 14,
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)", zIndex: 200,
    }),
    empty: {
      textAlign: "center", color: "#6a6a6a", padding: "60px 20px", fontSize: 14,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Gestión de Moldes</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={styles.btnGhost} onClick={handleScanClick} disabled={scanning}>
            {scanning ? "Escaneando..." : "📷 Escanear foto"}
          </button>
          <button style={styles.btnGold} onClick={openNewModal}>
            + Nuevo molde
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      <input
        style={styles.search}
        placeholder="Buscar por número o texto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={styles.libBar}>
        {libraries.map((lib) => (
          <div
            key={lib.id}
            style={styles.libChip(selectedLib?.id === lib.id)}
            onClick={() => setSelectedLib(lib)}
          >
            {lib.nombre}
          </div>
        ))}
        {!libraries.length && (
          <span style={{ color: "#6a6a6a", fontSize: 13 }}>
            No hay carpetas todavía.
          </span>
        )}
      </div>

      {filteredMolds.length === 0 ? (
        <div style={styles.empty}>
          {search
            ? "Ningún molde coincide con tu búsqueda."
            : "Esta carpeta está vacía. Escanea una foto o crea un molde."}
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredMolds.map((molde) => (
            <div
              key={molde.id}
              style={styles.card}
              onClick={() => openEditModal(molde)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(212,175,55,0.5)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#232323";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={styles.cardNum}>{molde.numero}</div>
              <div style={styles.cardText}>{molde.texto || "(sin texto)"}</div>
              <div style={styles.cardActions}>
                <button
                  style={styles.iconBtn}
                  onClick={(e) => { e.stopPropagation(); handlePdf(molde); }}
                >
                  PDF
                </button>
                <button
                  style={styles.iconBtnDanger}
                  onClick={(e) => { e.stopPropagation(); handleDelete(molde); }}
                >
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div style={styles.modalBackdrop} onClick={closeModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ ...styles.title, fontSize: 24, marginBottom: 18 }}>
              {editing ? "Editar molde" : "Nuevo molde"}
            </h2>

            <label style={styles.label}>Número</label>
            <input
              style={styles.input}
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ej. 042"
            />

            <label style={{ ...styles.label, marginTop: 14 }}>Texto</label>
            <textarea
              style={styles.textarea}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Contenido del molde..."
            />

            <div style={styles.modalActions}>
              <button style={styles.btnGhost} onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
              <button style={styles.btnGold} onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editing ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={styles.toast(toast.type)}>{toast.msg}</div>}
    </div>
  );
}