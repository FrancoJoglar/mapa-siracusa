import { useState } from "react";
import { useTuberias } from "../hooks/useTuberias";
import { useEquipos } from "../hooks/useEquipos";
import { useAuth } from "../context/AuthContext";

const s: React.CSSProperties = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13 };
const btnSm: React.CSSProperties = { padding: "4px 10px", background: "none", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnPrimary: React.CSSProperties = { padding: "6px 14px", border: "none", borderRadius: 4, background: "#1565c0", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 };

export default function AdminTuberias() {
  const { isAdmin } = useAuth();
  const { tuberias, loading, error, createTuberia, deleteTuberia } = useTuberias();
  const { equipos } = useEquipos();
  const [filtroEquipo, setFiltroEquipo] = useState("");
  const [showForm, setShowForm] = useState(false);

  if (loading) return <p style={{ padding: 24, color: "#666" }}>Cargando...</p>;
  if (error) return <p style={{ padding: 24, color: "#c62828" }}>Error: {error}</p>;

  const eqMap = Object.fromEntries(equipos.map(e => [e.id, e.codigo]));
  const filtered = tuberias.filter(t => !filtroEquipo || t.equipo_id === filtroEquipo);

  return (
    <div style={{ maxWidth: "95%", margin: "24px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Tuberías ({filtered.length})</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={filtroEquipo} onChange={e => setFiltroEquipo(e.target.value)} style={s}>
            <option value="">Todos los equipos</option>
            {equipos.map(e => <option key={e.id} value={e.id}>Equipo {e.codigo}</option>)}
          </select>
          {isAdmin && <button onClick={() => setShowForm(true)} style={btnPrimary}>+ Nueva Tubería</button>}
        </div>
      </div>

      {showForm && (
        <div style={{ marginBottom: 16, padding: 16, background: "#f5f5f5", borderRadius: 8 }}>
          <h4 style={{ margin: "0 0 8px" }}>Nueva Tubería</h4>
          <NuevaTuberiaForm equipos={equipos} onSave={async (d) => { await createTuberia(d); setShowForm(false); }} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: "#f5f5f5" }}>
          <th style={thStyle}>Código</th><th style={thStyle}>Equipo</th><th style={thStyle}>Nivel</th>
          <th style={thStyle}>Material</th><th style={thStyle}>Ø mm</th><th style={thStyle}>Nombre</th>
          <th style={thStyle}>Geom</th><th style={{ ...thStyle, width: 120 }}>Acciones</th>
        </tr></thead>
        <tbody>
          {filtered.map(t => (
            <tr key={t.id}>
              <td style={tdStyle}><strong>{t.codigo}</strong></td>
              <td style={tdStyle}>{eqMap[t.equipo_id] || "-"}</td>
              <td style={tdStyle}>{t.nivel}</td>
              <td style={tdStyle}>{t.material || "-"}</td>
              <td style={tdStyle}>{t.diametro_mm ?? "-"}</td>
              <td style={tdStyle}>{t.nombre || "-"}</td>
              <td style={tdStyle}>{t.geojson ? "✅" : "❌"}</td>
              <td style={tdStyle}>
                {isAdmin && <button onClick={() => { if (confirm(`Eliminar ${t.codigo}?`)) deleteTuberia(t.id); }} style={{ ...btnSm, color: "#c62828" }}>Eliminar</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NuevaTuberiaForm({ equipos, onSave, onCancel }: { equipos: any[]; onSave: (d: any) => Promise<void>; onCancel: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [equipoId, setEquipoId] = useState(equipos[0]?.id || "");
  const [nivel, setNivel] = useState<"matriz" | "submatriz">("matriz");
  const [material, setMaterial] = useState("");
  const [diametro, setDiametro] = useState("");
  const [nombre, setNombre] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await onSave({ codigo, equipo_id: equipoId, nivel, material: material || null, diametro_mm: diametro ? Number(diametro) : null, nombre: nombre || null });
    setBusy(false);
  };

  const inputStyle: React.CSSProperties = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13, width: "100%", boxSizing: "border-box" };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div><label style={{ fontSize: 12, color: "#666" }}>Código *</label>
          <input value={codigo} onChange={e => setCodigo(e.target.value)} required style={inputStyle} placeholder="M-E6-1" /></div>
        <div><label style={{ fontSize: 12, color: "#666" }}>Equipo</label>
          <select value={equipoId} onChange={e => setEquipoId(e.target.value)} style={inputStyle}>
            {equipos.map(e => <option key={e.id} value={e.id}>Equipo {e.codigo}</option>)}
          </select></div>
        <div><label style={{ fontSize: 12, color: "#666" }}>Nivel</label>
          <select value={nivel} onChange={e => setNivel(e.target.value as any)} style={inputStyle}>
            <option value="matriz">Matriz</option><option value="submatriz">Submatriz</option>
          </select></div>
        <div><label style={{ fontSize: 12, color: "#666" }}>Material</label>
          <input value={material} onChange={e => setMaterial(e.target.value)} style={inputStyle} placeholder="PVC" /></div>
        <div><label style={{ fontSize: 12, color: "#666" }}>Diámetro (mm)</label>
          <input type="number" value={diametro} onChange={e => setDiametro(e.target.value)} style={inputStyle} /></div>
        <div><label style={{ fontSize: 12, color: "#666" }}>Nombre</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} placeholder="Matriz principal" /></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} style={btnPrimary}>{busy ? "Guardando..." : "Guardar"}</button>
        <button type="button" onClick={onCancel} style={{ ...btnSm, background: "white" }}>Cancelar</button>
      </div>
    </form>
  );
}

const thStyle: React.CSSProperties = { padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #ddd", fontWeight: 600, fontSize: 12 };
const tdStyle: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #eee" };
