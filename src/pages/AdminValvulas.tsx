import { useState } from "react";
import { useValvulas } from "../hooks/useValvulas";
import { useAuth } from "../context/AuthContext";

const btnSm: React.CSSProperties = { padding: "4px 10px", background: "none", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnPrimary: React.CSSProperties = { padding: "6px 14px", border: "none", borderRadius: 4, background: "#1565c0", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 };

const TIPOS = ['transicion', 'purga', 'aire', 'compuerta', 'otro'];

export default function AdminValvulas() {
  const { isAdmin } = useAuth();
  const { valvulas, loading, error, createValvula, deleteValvula } = useValvulas();
  const [showForm, setShowForm] = useState(false);

  if (loading) return <p style={{ padding: 24, color: "#666" }}>Cargando...</p>;
  if (error) return <p style={{ padding: 24, color: "#c62828" }}>Error: {error}</p>;

  return (
    <div style={{ maxWidth: "95%", margin: "24px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Válvulas ({valvulas.length})</h2>
        {isAdmin && <button onClick={() => setShowForm(true)} style={btnPrimary}>+ Nueva Válvula</button>}
      </div>

      {showForm && (
        <div style={{ marginBottom: 16, padding: 16, background: "#f5f5f5", borderRadius: 8 }}>
          <h4 style={{ margin: "0 0 8px" }}>Nueva Válvula</h4>
          <NuevaValvulaForm onSave={async (d) => { await createValvula(d); setShowForm(false); }} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: "#f5f5f5" }}>
          <th style={thStyle}>Código</th><th style={thStyle}>Tipo</th><th style={thStyle}>Ø mm</th>
          <th style={thStyle}>Geom</th><th style={{ ...thStyle, width: 120 }}>Acciones</th>
        </tr></thead>
        <tbody>
          {valvulas.map(v => (
            <tr key={v.id}>
              <td style={tdStyle}><strong>{v.codigo}</strong></td>
              <td style={tdStyle}>{v.tipo}</td>
              <td style={tdStyle}>{v.diametro_mm ?? "-"}</td>
              <td style={tdStyle}>{v.geojson ? "✅" : "❌"}</td>
              <td style={tdStyle}>
                {isAdmin && <button onClick={() => { if (confirm(`Eliminar ${v.codigo}?`)) deleteValvula(v.id); }} style={{ ...btnSm, color: "#c62828" }}>Eliminar</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NuevaValvulaForm({ onSave, onCancel }: { onSave: (d: any) => Promise<void>; onCancel: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState("transicion");
  const [diametro, setDiametro] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await onSave({ codigo, tipo, diametro_mm: diametro ? Number(diametro) : null });
    setBusy(false);
  };

  const inputStyle: React.CSSProperties = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13, boxSizing: "border-box" };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div><label style={{ fontSize: 12, color: "#666" }}>Código *</label>
          <input value={codigo} onChange={e => setCodigo(e.target.value)} required style={inputStyle} placeholder="V-E6-1" /></div>
        <div><label style={{ fontSize: 12, color: "#666" }}>Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={inputStyle}>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select></div>
        <div><label style={{ fontSize: 12, color: "#666" }}>Diámetro (mm)</label>
          <input type="number" value={diametro} onChange={e => setDiametro(e.target.value)} style={inputStyle} /></div>
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
