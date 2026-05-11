import { FiltrosCuartel } from "../../lib/types";

interface Props {
  filtros: FiltrosCuartel;
  onChange: (f: FiltrosCuartel) => void;
  especies: string[];
  variedades: string[];
  equipos: string[];
  sectores: string[];
  jefes: string[];
  totalCuarteles: number;
  totalSuperficie: number;
  cuartelesFiltrados: number;
  onExportExcel: () => void;
  onExportGeoJSON: () => void;
}

export default function BarraFiltros({
  filtros,
  onChange,
  especies,
  variedades,
  equipos,
  sectores,
  jefes,
  cuartelesFiltrados,
  totalCuarteles,
  totalSuperficie,
  onExportExcel,
  onExportGeoJSON,
}: Props) {
  const set = (k: keyof FiltrosCuartel, v: string | number | null) =>
    onChange({ ...filtros, [k]: v });

  const limpiar = () =>
    onChange({
      especie: "",
      variedad: "",
      anioDesde: null,
      anioHasta: null,
      equipo: "",
      sector: "",
      jefeCampo: "",
    });

  return (
    <div style={containerStyle}>
      <div style={filtersRow}>
        <select
          value={filtros.especie}
          onChange={(e) => set("especie", e.target.value)}
          style={selectStyle}
        >
          <option value="">Especie</option>
          {especies.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>

        <select
          value={filtros.variedad}
          onChange={(e) => set("variedad", e.target.value)}
          style={selectStyle}
        >
          <option value="">Variedad</option>
          {variedades.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Año desde"
          value={filtros.anioDesde || ""}
          onChange={(e) =>
            set("anioDesde", e.target.value ? Number(e.target.value) : null)
          }
          style={numberInputStyle}
        />
        <input
          type="number"
          placeholder="Año hasta"
          value={filtros.anioHasta || ""}
          onChange={(e) =>
            set("anioHasta", e.target.value ? Number(e.target.value) : null)
          }
          style={numberInputStyle}
        />

        <select
          value={filtros.equipo}
          onChange={(e) => set("equipo", e.target.value)}
          style={selectStyle}
        >
          <option value="">Equipo</option>
          {equipos.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>

        <select
          value={filtros.sector}
          onChange={(e) => set("sector", e.target.value)}
          style={selectStyle}
        >
          <option value="">Sector</option>
          {sectores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={filtros.jefeCampo}
          onChange={(e) => set("jefeCampo", e.target.value)}
          style={selectStyle}
        >
          <option value="">Jefe de Campo</option>
          {jefes.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>

        <button onClick={limpiar} style={btnStyle}>
          Limpiar
        </button>

        <div style={{ borderLeft: "1px solid #ddd", paddingLeft: 8, display: "flex", gap: 4 }}>
          <button onClick={onExportExcel} style={btnExportStyle} title="Exportar a Excel">
            Excel
          </button>
          <button onClick={onExportGeoJSON} style={btnExportStyle} title="Exportar a GeoJSON">
            GeoJSON
          </button>
        </div>
      </div>

      <div style={counterStyle}>
        Mostrando {cuartelesFiltrados} de {totalCuarteles} cuarteles ·{" "}
        {totalSuperficie.toLocaleString("es-CL", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}{" "}
        ha
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  padding: "10px 16px",
  borderBottom: "1px solid #ddd",
  zIndex: 1000,
};

const filtersRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 8,
};

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 13,
  background: "#fff",
  minWidth: 120,
};

const numberInputStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 13,
  width: 90,
};

const btnStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  border: "1px solid #ccc",
  background: "#f5f5f5",
  cursor: "pointer",
  fontSize: 13,
};

const btnExportStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid #c8e6c9",
  background: "#e8f5e9",
  color: "#2e7d32",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
};

const counterStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: "#444",
};
