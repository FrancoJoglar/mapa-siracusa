import { useState } from "react";
import { Cuartel, Sector } from "../../lib/types";
import EditorGeometria from "../ui/EditorGeometria";

interface Props {
  cuartel: Cuartel;
  sectores: Sector[];
  onSave: (data: Partial<Cuartel>) => Promise<void>;
  onUpdateGeometria: (geojson: any) => Promise<void>;
  onCancel: () => void;
}

export default function FormularioCuartel({
  cuartel,
  sectores,
  onSave,
  onUpdateGeometria,
  onCancel,
}: Props) {
  const [nombre, setNombre] = useState(cuartel.nombre);
  const [especie, setEspecie] = useState(cuartel.especie || "");
  const [variedad, setVariedad] = useState(cuartel.variedad || "");
  const [anio, setAnio] = useState(cuartel.anio_plantacion || 0);
  const [superficie, setSuperficie] = useState(cuartel.superficie_ha || 0);
  const [plantas, setPlantas] = useState(cuartel.plantas || 0);
  const [polinizante, setPolinizante] = useState(cuartel.polinizante || "");
  const [jefeCampo, setJefeCampo] = useState(cuartel.jefe_campo || "");
  const [centroCosto, setCentroCosto] = useState(cuartel.centro_costo || "");
  const [sectorIds, setSectorIds] = useState<string[]>(cuartel.sector_ids || []);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const toggleSector = (id: string) => {
    setSectorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        nombre,
        especie,
        variedad,
        anio_plantacion: anio || null,
        superficie_ha: superficie || null,
        plantas: plantas || null,
        polinizante,
        jefe_campo: jefeCampo,
        centro_costo: centroCosto,
        sector_ids: sectorIds,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ marginTop: 0 }}>Editar {cuartel.nombre}</h3>
        <form onSubmit={handleSubmit}>
          <Row>
            <Campo label="Nombre">
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                style={inputStyle}
              />
            </Campo>
            <Campo label="Especie">
              <select
                value={especie}
                onChange={(e) => setEspecie(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar...</option>
                <option value="Olivo">Olivo</option>
                <option value="Avellano (Plantación)">Avellano</option>
                <option value="Cerezos (Plantación)">Cerezo</option>
              </select>
            </Campo>
          </Row>
          <Row>
            <Campo label="Variedad">
              <input
                type="text"
                value={variedad}
                onChange={(e) => setVariedad(e.target.value)}
                style={inputStyle}
              />
            </Campo>
            <Campo label="Año Plantación">
              <input
                type="number"
                value={anio || ""}
                onChange={(e) => setAnio(Number(e.target.value))}
                style={inputStyle}
              />
            </Campo>
          </Row>
          <Row>
            <Campo label="Superficie (ha)">
              <input
                type="number"
                step="0.01"
                value={superficie || ""}
                onChange={(e) => setSuperficie(Number(e.target.value))}
                style={inputStyle}
              />
            </Campo>
            <Campo label="Plantas">
              <input
                type="number"
                value={plantas || ""}
                onChange={(e) => setPlantas(Number(e.target.value))}
                style={inputStyle}
              />
            </Campo>
          </Row>
          <Row>
            <Campo label="Polinizante">
              <input
                type="text"
                value={polinizante}
                onChange={(e) => setPolinizante(e.target.value)}
                style={inputStyle}
              />
            </Campo>
            <Campo label="Jefe de Campo">
              <input
                type="text"
                value={jefeCampo}
                onChange={(e) => setJefeCampo(e.target.value)}
                style={inputStyle}
              />
            </Campo>
          </Row>
          <Campo label="Centro de Costo">
            <input
              type="text"
              value={centroCosto}
              onChange={(e) => setCentroCosto(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </Campo>

          <Campo label="Sectores de Riego">
            <div
              style={{
                maxHeight: 150,
                overflowY: "auto",
                border: "1px solid #ccc",
                borderRadius: 4,
                padding: "6px 10px",
              }}
            >
              {sectores.map((s) => (
                <label
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 0",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sectorIds.includes(s.id)}
                    onChange={() => toggleSector(s.id)}
                  />
                  <strong>{s.codigo}</strong>
                  {s.descripcion ? ` — ${s.descripcion}` : ""}
                </label>
              ))}
              {sectores.length === 0 && (
                <p style={{ color: "#999", fontSize: 13 }}>
                  No hay sectores creados. Andá a la sección Sectores primero.
                </p>
              )}
            </div>
          </Campo>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "space-between",
              marginTop: 16,
            }}
          >
            <button type="button" onClick={() => setShowEditor(true)} style={btnEditorStyle}>
              Editar Poligono
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onCancel} style={btnCancelStyle}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={btnSaveStyle}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showEditor && (
        <EditorGeometria
          geojson={cuartel.geojson || null}
          onSave={async (gj) => {
            await onUpdateGeometria(gj);
            setShowEditor(false);
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 12 }}>{children}</div>;
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1, marginBottom: 12 }}>
      <label
        style={{
          display: "block",
          marginBottom: 4,
          fontSize: 12,
          fontWeight: 600,
          color: "#555",
        }}
      >
        {label}
      </label>
      {children}
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
  width: 600,
  maxWidth: "95vw",
  maxHeight: "90vh",
  overflowY: "auto",
};
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
const btnEditorStyle: React.CSSProperties = {
  padding: "6px 14px",
  background: "#fff3e0",
  color: "#e65100",
  border: "1px solid #ffcc80",
  borderRadius: 4,
  cursor: "pointer",
  fontWeight: 500,
  fontSize: 13,
};
