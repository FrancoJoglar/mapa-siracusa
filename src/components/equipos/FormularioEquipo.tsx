import { useState } from "react";
import { Equipo } from "../../lib/types";

interface Props {
  equipo: Equipo | null;
  onSave: (data: Partial<Equipo>) => Promise<void>;
  onCancel: () => void;
}

export default function FormularioEquipo({ equipo, onSave, onCancel }: Props) {
  const [codigo, setCodigo] = useState(equipo?.codigo || 0);
  const [nombre, setNombre] = useState(equipo?.nombre || "");
  const [descripcion, setDescripcion] = useState(equipo?.descripcion || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ codigo, nombre, descripcion });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ marginTop: 0 }}>
          {equipo ? "Editar Equipo" : "Nuevo Equipo"}
        </h3>
        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label>Código</label>
            <input
              type="number"
              value={codigo}
              onChange={(e) => setCodigo(Number(e.target.value))}
              required
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label>Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Equipo 1"
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label>Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onCancel} style={btnCancelStyle}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={btnSaveStyle}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 2000,
};
const modalStyle: React.CSSProperties = {
  background: "#fff",
  padding: 24,
  borderRadius: 8,
  width: 400,
  maxWidth: "90vw",
};
const fieldStyle: React.CSSProperties = { marginBottom: 12 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  border: "1px solid #ccc",
  borderRadius: 4,
  fontSize: 13,
  boxSizing: "border-box",
};
const btnCancelStyle: React.CSSProperties = {
  padding: "6px 14px",
  border: "1px solid #ccc",
  borderRadius: 4,
  background: "#f5f5f5",
  cursor: "pointer",
};
const btnSaveStyle: React.CSSProperties = {
  padding: "6px 14px",
  background: "#1565c0",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontWeight: 500,
};
