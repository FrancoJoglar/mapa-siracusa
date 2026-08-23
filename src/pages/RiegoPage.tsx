import { useState, useMemo } from "react";
import { useRiego, SectorRiego } from "../hooks/useRiego";

type SortKey = keyof Pick<
  SectorRiego,
  "equipoCodigo" | "numero" | "especie" | "hectareas" | "kcAjustado" | "etcSemanal" | "reposicionMm" | "volumenM3"
>;

export default function RiegoPage() {
  const { resultados, resumen, clima, loading, error, refetch } = useRiego();
  const [filtroEspecie, setFiltroEspecie] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [filtroJefe, setFiltroJefe] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("reposicionMm");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const especies = useMemo(() => Array.from(new Set(resultados.map((r) => r.especie))).sort(), [resultados]);
  const jefes = useMemo(
    () => Array.from(new Set(resultados.flatMap((r) => r.jefeCampo?.split("/").map((j) => j.trim()) || []))).sort(),
    [resultados]
  );

  const filtrados = useMemo(() => {
    return resultados
      .filter((r) => !filtroEspecie || r.especie === filtroEspecie)
      .filter((r) => !filtroAccion || r.accion === filtroAccion)
      .filter((r) => !filtroJefe || r.jefeCampo?.includes(filtroJefe))
      .filter((r) => !busqueda || r.codigo.toLowerCase().includes(busqueda.toLowerCase()))
      .sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const d = sortDir === "asc" ? 1 : -1;
        if (typeof av === "string" || typeof bv === "string") {
          return String(av).localeCompare(String(bv)) * d;
        }
        return ((av as number) - (bv as number)) * d;
      });
  }, [resultados, filtroEspecie, filtroAccion, filtroJefe, busqueda, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (loading) return <CenterMsg msg="Calculando reposición de riego..." />;
  if (error) return <CenterMsg msg={`Error: ${error}`} />;

  return (
    <div style={{ maxWidth: "95%", margin: "24px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>💧 Reposición de Riego</h2>
          {clima && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666" }}>
              Consumo y lluvia entre el {clima.periodo.desde} y el {clima.periodo.hasta} · llovieron{" "}
              {clima.precipitacionSemanalMm.toFixed(1)} mm en ese período · ET0 {clima.et0Promedio.toFixed(2)} mm/día
              · fuente: Open-Meteo
            </p>
          )}
        </div>
        <button onClick={refetch} style={btnClear}>↻ Actualizar</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
        <SummaryCard label="Sectores totales" value={resumen.total} color="#333" />
        <SummaryCard label="A regar ahora" value={resumen.aRegar} color="#c62828" />
        <SummaryCard label="A monitorear" value={resumen.monitorear} color="#e08a00" />
        <SummaryCard label="Sin riego" value={resumen.sinRiego} color="#2e7d32" />
        <SummaryCard label="m³ de agua en total" value={resumen.volumenTotal.toLocaleString()} color="#1565c0" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
        <select value={filtroEspecie} onChange={(e) => setFiltroEspecie(e.target.value)} style={selectStyle}>
          <option value="">Todas las especies</option>
          {especies.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={filtroAccion} onChange={(e) => setFiltroAccion(e.target.value)} style={selectStyle}>
          <option value="">Todas las acciones</option>
          <option value="REGAR">💧 Regar</option>
          <option value="MONITOREAR">👀 Monitorear</option>
          <option value="SIN_REGAR">✅ Sin riego</option>
        </select>
        <select value={filtroJefe} onChange={(e) => setFiltroJefe(e.target.value)} style={selectStyle}>
          <option value="">Todos los jefes de campo</option>
          {jefes.map((j) => (
            <option key={j} value={j}>{j}</option>
          ))}
        </select>
        <input
          placeholder="Buscar sector..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={selectStyle}
        />
        <button
          onClick={() => { setFiltroEspecie(""); setFiltroAccion(""); setFiltroJefe(""); setBusqueda(""); }}
          style={btnClear}
        >
          ✖ Limpiar
        </button>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 6 }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th label="Equipo" active={sortKey === "equipoCodigo"} dir={sortDir} onClick={() => toggleSort("equipoCodigo")} />
              <Th label="Sector" active={sortKey === "numero"} dir={sortDir} onClick={() => toggleSort("numero")} />
              <Th label="Especie" active={sortKey === "especie"} dir={sortDir} onClick={() => toggleSort("especie")} />
              <th style={thStyle}>Variedad</th>
              <th style={thStyle}>Etapa</th>
              <Th label="Has" active={sortKey === "hectareas"} dir={sortDir} onClick={() => toggleSort("hectareas")} />
              <Th label="Kc" active={sortKey === "kcAjustado"} dir={sortDir} onClick={() => toggleSort("kcAjustado")} />
              <Th label="ETc sem." active={sortKey === "etcSemanal"} dir={sortDir} onClick={() => toggleSort("etcSemanal")} />
              <Th label="Reposición" active={sortKey === "reposicionMm"} dir={sortDir} onClick={() => toggleSort("reposicionMm")} />
              <Th label="Volumen" active={sortKey === "volumenM3"} dir={sortDir} onClick={() => toggleSort("volumenM3")} />
              <th style={thStyle}>Jefe</th>
              <th style={thStyle}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((r) => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.equipoCodigo}</td>
                <td style={tdStyle}>{r.codigo}</td>
                <td style={tdStyle}>{r.especie}</td>
                <td style={tdStyle}>{r.variedad}</td>
                <td style={tdStyle}>{r.etapa}</td>
                <td style={tdStyle}>{r.hectareas.toFixed(1)}</td>
                <td style={tdStyle}>{r.kcAjustado.toFixed(2)}</td>
                <td style={tdStyle}>{r.etcSemanal} mm</td>
                <td style={tdStyle}>{r.reposicionMm} mm</td>
                <td style={tdStyle}>{r.volumenM3.toLocaleString()} m³</td>
                <td style={tdStyle}>{r.jefeCampo}</td>
                <td style={tdStyle}><Badge accion={r.accion} /></td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={12} style={{ textAlign: "center", color: "#999", padding: 16 }}>Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "#999", marginTop: 8 }}>
        {filtrados.length} de {resultados.length} sectores · Volumen filtrado:{" "}
        {filtrados.reduce((a, r) => a + r.volumenM3, 0).toLocaleString()} m³
      </p>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "14px 12px", textAlign: "center", background: "#fafafa" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Th({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <th style={{ ...thStyle, cursor: "pointer", userSelect: "none" }} onClick={onClick}>
      {label}{active ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

function Badge({ accion }: { accion: SectorRiego["accion"] }) {
  const map = {
    REGAR: { bg: "#fdecea", color: "#c62828", label: "💧 Regar" },
    MONITOREAR: { bg: "#fff4e0", color: "#e08a00", label: "👀 Monitorear" },
    SIN_REGAR: { bg: "#e8f5e9", color: "#2e7d32", label: "✅ Sin riego" },
  } as const;
  const s = map[accion];
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

function CenterMsg({ msg }: { msg: string }) {
  return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}><p>{msg}</p></div>;
}

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const thStyle: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #ddd", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#555", background: "#f5f5f5", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #eee" };
const selectStyle: React.CSSProperties = { padding: "5px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 12, minWidth: 100 };
const btnClear: React.CSSProperties = { padding: "5px 10px", border: "1px solid #ccc", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 12 };
