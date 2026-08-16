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
  onExportImage?: () => void;
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
  onExportImage,
}: Props) {
  const set = (k: keyof FiltrosCuartel, v: any) =>
    onChange({ ...filtros, [k]: v });

  const limpiar = () =>
    onChange({
      especie: "",
      variedad: "",
      anioDesde: null,
      anioHasta: null,
      equipos: [],
      sectores: [],
      jefeCampo: "",
    });

  const toggleEquipo = (eq: string) => {
    const current = filtros.equipos;
    const next = current.includes(eq)
      ? current.filter(e => e !== eq)
      : [...current, eq];
    set("equipos", next);
  };

  const toggleTodosEquipos = () => {
    if (filtros.equipos.length === equipos.length) {
      set("equipos", []);
    } else {
      set("equipos", [...equipos]);
    }
  };

  const toggleSector = (s: string) => {
    const current = filtros.sectores;
    const next = current.includes(s)
      ? current.filter(x => x !== s)
      : [...current, s];
    set("sectores", next);
  };

  const toggleTodosSectores = () => {
    if (filtros.sectores.length === sectores.length) {
      set("sectores", []);
    } else {
      set("sectores", [...sectores]);
    }
  };

  return (
    <div style={containerStyle}>
      {/* Row 1: Filtros generales */}
      <div style={filtersRow}>
        <select
          value={filtros.especie}
          onChange={(e) => set("especie", e.target.value)}
          style={selectStyle}
        >
          <option value="">Especie</option>
          {especies.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <select
          value={filtros.variedad}
          onChange={(e) => set("variedad", e.target.value)}
          style={selectStyle}
        >
          <option value="">Variedad</option>
          {variedades.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Año desde"
          value={filtros.anioDesde || ""}
          onChange={(e) => set("anioDesde", e.target.value ? Number(e.target.value) : null)}
          style={numberInputStyle}
        />
        <input
          type="number"
          placeholder="Año hasta"
          value={filtros.anioHasta || ""}
          onChange={(e) => set("anioHasta", e.target.value ? Number(e.target.value) : null)}
          style={numberInputStyle}
        />

        <select
          value={filtros.jefeCampo}
          onChange={(e) => set("jefeCampo", e.target.value)}
          style={selectStyle}
        >
          <option value="">Jefe de Campo</option>
          {jefes.map((j) => (
            <option key={j} value={j}>{j}</option>
          ))}
        </select>

        <button onClick={limpiar} style={btnStyle}>Limpiar</button>

        <div style={{ borderLeft: "1px solid #ddd", paddingLeft: 8, display: "flex", gap: 4 }}>
          <button onClick={onExportExcel} style={btnExportStyle} title="Exportar a Excel">Excel</button>
          <button onClick={onExportGeoJSON} style={btnExportStyle} title="Exportar a GeoJSON">GeoJSON</button>
          {onExportImage && <button onClick={onExportImage} style={btnExportStyle} title="Exportar como imagen">📷 Imagen</button>}
        </div>
      </div>

      {/* Row 2: Equipos y Sectores checkboxes */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
        {/* Equipos */}
        <div style={checkboxGroupStyle}>
          <div style={checkboxGroupHeaderStyle}>
            <strong>Equipos</strong>
            <span style={{ color: "#666", marginLeft: 4 }}>
              {filtros.equipos.length > 0 ? `${filtros.equipos.length}/${equipos.length}` : "Todos"}
            </span>
          </div>
          <div style={checkboxListStyle}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={filtros.equipos.length === 0}
                onChange={toggleTodosEquipos}
                style={checkboxInputStyle}
              />
              Todos
            </label>
            {equipos.map((eq) => (
              <label key={eq} style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={filtros.equipos.includes(eq)}
                  onChange={() => toggleEquipo(eq)}
                  style={checkboxInputStyle}
                />
                Equipo {eq}
              </label>
            ))}
          </div>
        </div>

        {/* Sectores */}
        <div style={checkboxGroupStyle}>
          <div style={checkboxGroupHeaderStyle}>
            <strong>Sectores</strong>
            <span style={{ color: "#666", marginLeft: 4 }}>
              {filtros.sectores.length > 0 ? `${filtros.sectores.length}/${sectores.length}` : "Todos"}
            </span>
          </div>
          <div style={checkboxListStyle}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={filtros.sectores.length === 0}
                onChange={toggleTodosSectores}
                style={checkboxInputStyle}
              />
              Todos
            </label>
            {sectores.map((s) => (
              <label key={s} style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={filtros.sectores.includes(s)}
                  onChange={() => toggleSector(s)}
                  style={checkboxInputStyle}
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Counter */}
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
  marginTop: 8,
};

const checkboxGroupStyle: React.CSSProperties = {
  flex: "1 1 300px",
  minWidth: 280,
};

const checkboxGroupHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: 4,
  fontSize: 12,
};

const checkboxListStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "2px 12px",
  maxHeight: 80,
  overflowY: "auto",
  padding: "4px 0",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  cursor: "pointer",
  fontSize: 11,
  whiteSpace: "nowrap",
};

const checkboxInputStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  cursor: "pointer",
};
