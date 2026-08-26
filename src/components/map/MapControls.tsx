import { useState } from "react";

interface Props {
  // Vista
  vista: "cuarteles" | "sectores";
  onVistaChange: (v: "cuarteles" | "sectores") => void;
  // Capas
  mostrarEdif: boolean;
  onToggleEdif: () => void;
  mostrarUnidades: boolean;
  onToggleUnidades: () => void;
  // Herramientas
  satelite: boolean;
  onToggleSatelite: () => void;
  medir: boolean;
  onToggleMedir: () => void;
  showCuartelLabels: boolean;
  onToggleLabels: () => void;
  // Equipos
  equiposActivo: boolean;
  onToggleEquipos: () => void;
  equiposExpandido: boolean;
  onToggleExpandido: () => void;
  mostrarValvulas: boolean;
  onToggleValvulas: () => void;
  mostrarSubmatrices: boolean;
  onToggleSubmatrices: () => void;
  mostrarMatrices: boolean;
  onToggleMatrices: () => void;
  mostrarImpulsiones: boolean;
  onToggleImpulsiones: () => void;
  mostrarAntenas: boolean;
  onToggleAntenas: () => void;
  mostrarSondas: boolean;
  onToggleSondas: () => void;
  onExportImage?: () => void;
}

export default function MapControls({
  vista, onVistaChange,
  mostrarEdif, onToggleEdif,
  mostrarUnidades, onToggleUnidades,
  satelite, onToggleSatelite,
  medir, onToggleMedir,
  showCuartelLabels, onToggleLabels,
  equiposActivo, onToggleEquipos,
  equiposExpandido, onToggleExpandido,
  mostrarValvulas, onToggleValvulas,
  mostrarSubmatrices, onToggleSubmatrices,
  mostrarMatrices, onToggleMatrices,
  mostrarImpulsiones, onToggleImpulsiones,
  mostrarAntenas, onToggleAntenas,
  mostrarSondas, onToggleSondas,
  onExportImage,
}: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="leaflet-top leaflet-right" style={{ top: 10, zIndex: 1000 }}>
      {/* Toggle button */}
      {!open && (
        <button onClick={(e) => { e.stopPropagation(); setOpen(true); }} style={{ ...toggleBtn, pointerEvents: "auto" }} title="Mostrar controles">
          ☰
        </button>
      )}

      {/* Panel */}
      {open && (
        <div style={{ ...panelStyle, pointerEvents: "auto" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderBottom: "1px solid #eee" }}>
            <span style={{ fontWeight: 600, fontSize: 12 }}>Controles</span>
            <button onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 14, color: "#999" }}>✕</button>
          </div>

          {/* Vista */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Vista</div>
            <div style={{ display: "flex", gap: 0, borderRadius: 4, overflow: "hidden", border: "1px solid #ccc" }}>
            <button onClick={(e) => { e.stopPropagation(); onVistaChange("cuarteles"); }} style={{ ...tabBtn, background: vista === "cuarteles" ? "#1565c0" : "#fff", color: vista === "cuarteles" ? "#fff" : "#333" }}>Cuarteles</button>
            <button onClick={(e) => { e.stopPropagation(); onVistaChange("sectores"); }} style={{ ...tabBtn, background: vista === "sectores" ? "#1565c0" : "#fff", color: vista === "sectores" ? "#fff" : "#333" }}>Sectores</button>
            </div>
          </div>

          {/* Capas */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Capas</div>
            <Checkbox label="Edificaciones" checked={mostrarEdif} onChange={onToggleEdif} color="#e65100" />
            <Checkbox label="Unidades de Riego" checked={mostrarUnidades} onChange={onToggleUnidades} color="#2e7d32" />
          </div>

          {/* Herramientas */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Herramientas</div>
            <Checkbox label="Satélite" checked={satelite} onChange={onToggleSatelite} color="#1565c0" />
            <Checkbox label="Medir" checked={medir} onChange={onToggleMedir} color="#2e7d32" />
            <Checkbox label="Nombres" checked={showCuartelLabels} onChange={onToggleLabels} color="#1565c0" />
          </div>

          {/* Equipos de Riego */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Checkbox label="Equipos de Riego" checked={equiposActivo} onChange={onToggleEquipos} color="#37474f" />
              {equiposActivo && (
                <button onClick={(e) => { e.stopPropagation(); onToggleExpandido(); }} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 10, color: "#666" }}>
                  {equiposExpandido ? "▾" : "▸"}
                </button>
              )}
            </div>
            {equiposActivo && equiposExpandido && (
              <div style={{ paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2 }}>
                <Checkbox label="Válvulas" checked={mostrarValvulas} onChange={onToggleValvulas} color="#ef5350" small />
                <Checkbox label="Submatrices" checked={mostrarSubmatrices} onChange={onToggleSubmatrices} color="#e65100" small />
                <Checkbox label="Matrices" checked={mostrarMatrices} onChange={onToggleMatrices} color="#1565c0" small />
                <Checkbox label="Impulsiones" checked={mostrarImpulsiones} onChange={onToggleImpulsiones} color="#2e7d32" small />
                <Checkbox label="Antenas" checked={mostrarAntenas} onChange={onToggleAntenas} color="#6a1b9a" small />
                <Checkbox label="Sondas" checked={mostrarSondas} onChange={onToggleSondas} color="#f9a825" small />
              </div>
            )}
          </div>

          {/* Exportar */}
          {onExportImage && (
            <div style={{ ...sectionStyle, borderBottom: "none" }}>
              <button onClick={(e) => { e.stopPropagation(); onExportImage(); }} style={{
                width: "100%", padding: "6px 0", borderRadius: 4, border: "1px solid #ccc",
                background: "#f5f5f5", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "#333",
              }}>📷 Exportar Mapa</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Checkbox({ label, checked, onChange, color, small }: { label: string; checked: boolean; onChange: () => void; color?: string; small?: boolean }) {
  return (
    <label onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: small ? "1px 0" : "2px 0", fontSize: small ? 11 : 12 }}>
      <input type="checkbox" checked={checked} onChange={onChange} onClick={(e) => e.stopPropagation()} style={{ width: small ? 13 : 14, height: small ? 13 : 14, cursor: "pointer" }} />
      {color && <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />}
      {label}
    </label>
  );
}

// Styles
const panelStyle: React.CSSProperties = {
  background: "#fff", borderRadius: 8, width: 200, maxHeight: "calc(100vh - 40px)", overflowY: "auto",
  boxShadow: "0 2px 12px rgba(0,0,0,0.15)", border: "1px solid #e0e0e0",
};
const toggleBtn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "#fff",
  cursor: "pointer", fontSize: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
};
const sectionStyle: React.CSSProperties = {
  padding: "6px 10px", borderBottom: "1px solid #f0f0f0",
};
const sectionTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 4,
};
const tabBtn: React.CSSProperties = {
  flex: 1, padding: "4px 0", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500,
};
