import { useState, useMemo } from "react";
import { useRiego, SectorRiego } from "../hooks/useRiego";

type SortKey = keyof Pick<
  SectorRiego,
  "equipoCodigo" | "numero" | "especie" | "hectareas" | "fc" | "kcBase" | "kcAjustado" | "etcSemanal" | "reposicionMm" | "volumenM3"
>;

export default function RiegoPage() {
  const { resultados, resumen, clima, loading, error, refetch } = useRiego();
  const [filtroEspecie, setFiltroEspecie] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [filtroJefe, setFiltroJefe] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("reposicionMm");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showTutorial, setShowTutorial] = useState(false);

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
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowTutorial(!showTutorial)} style={btnTutorial}>
            {showTutorial ? "✕ Cerrar" : "📖 Cómo se calcula"}
          </button>
          <button onClick={refetch} style={btnClear}>↻ Actualizar</button>
        </div>
      </div>

      {/* Tutorial */}
      {showTutorial && <TutorialRiego />}

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
              <Th label="Fc" active={sortKey === "fc"} dir={sortDir} onClick={() => toggleSort("fc")} />
              <Th label="Kc base" active={sortKey === "kcBase"} dir={sortDir} onClick={() => toggleSort("kcBase")} />
              <Th label="Kc ajust." active={sortKey === "kcAjustado"} dir={sortDir} onClick={() => toggleSort("kcAjustado")} />
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
                <td style={tdStyle}>{r.fc.toFixed(2)}</td>
                <td style={tdStyle}>{r.kcBase.toFixed(2)}</td>
                <td style={tdStyle}>{r.kcAjustado.toFixed(2)}</td>
                <td style={tdStyle}>{r.etcSemanal} mm</td>
                <td style={tdStyle}>{r.reposicionMm} mm</td>
                <td style={tdStyle}>{r.volumenM3.toLocaleString()} m³</td>
                <td style={tdStyle}>{r.jefeCampo}</td>
                <td style={tdStyle}><Badge accion={r.accion} /></td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={14} style={{ textAlign: "center", color: "#999", padding: 16 }}>Sin resultados.</td></tr>
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

// ====== TUTORIAL ======

function TutorialRiego() {
  return (
    <div style={{
      background: "#f8f9fa", border: "1px solid #e0e0e0", borderRadius: 8,
      padding: "16px 20px", marginBottom: 16, fontSize: 13, lineHeight: 1.6,
    }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>📖 Cómo se calcula la Reposición de Riego</h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {/* Fórmula principal */}
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#1565c0" }}>1. Fórmula del Kc Dinámico</h4>
          <div style={{
            background: "#fff", border: "1px solid #e0e0e0", borderRadius: 6,
            padding: "10px 14px", fontFamily: "monospace", fontSize: 14, marginBottom: 8,
          }}>
            <strong>Kc = Kc_min + (Kc_max - Kc_min) × fc</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li><strong>Kc_max</strong>: Coeficiente de cultivo para árbol adulto a plena cobertura (datos de campo Siracusa)</li>
            <li><strong>Kc_min</strong>: Evaporación del suelo descubierto entre hileras (riego por goteo)</li>
            <li><strong>fc</strong>: Fracción de Cobertura de Copa (0 a 1). Calculada automáticamente por edad del cultivo, o ingresada manualmente por el administrador.</li>
          </ul>
        </div>

        {/* Origen de datos */}
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#2e7d32" }}>2. Origen de los Datos</h4>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li><strong>Kc_max por mes</strong>: Tabla de valores reales de campo en Siracusa (Oct-Abr). Para meses sin datos (May-Sep), se usan valores de reposo fenológico.</li>
            <li><strong>ET0 (Evapotranspiración de Referencia)</strong>: API de Open-Meteo, promedio de los últimos 3 días.</li>
            <li><strong>Precipitación</strong>: API de Open-Meteo, acumulado semanal.</li>
            <li><strong>Año de plantación</strong>: Campo de la base de datos de sectores.</li>
          </ul>
        </div>

        {/* Cálculo de fc */}
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#e65100" }}>3. Cálculo de la Fracción de Cobertura (fc)</h4>
          <p style={{ margin: "0 0 8px" }}>El fc se calcula automáticamente según la edad del cultivo:</p>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={{ padding: "4px 8px", textAlign: "left" }}>Cultivo</th>
                <th style={{ padding: "4px 8px", textAlign: "left" }}>1 año</th>
                <th style={{ padding: "4px 8px", textAlign: "left" }}>3 años</th>
                <th style={{ padding: "4px 8px", textAlign: "left" }}>5+ años</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdTutorial}>Cerezo</td><td style={tdTutorial}>0.15</td><td style={tdTutorial}>0.50</td><td style={tdTutorial}>0.70-1.0</td></tr>
              <tr><td style={tdTutorial}>Avellano</td><td style={tdTutorial}>0.15</td><td style={tdTutorial}>0.50</td><td style={tdTutorial}>0.70-1.0</td></tr>
              <tr><td style={tdTutorial}>Kiwi</td><td style={tdTutorial}>0.15</td><td style={tdTutorial}>0.70</td><td style={tdTutorial}>0.95-1.0</td></tr>
              <tr><td style={tdTutorial}>Olivo</td><td colSpan={3} style={tdTutorial}>Siempre 1.0 (solo adultos en Siracusa)</td></tr>
            </tbody>
          </table>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#666" }}>
            El administrador puede ingresar un valor manual de fc en el mantenedor de sectores.
          </p>
        </div>

        {/* Reposición semanal */}
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#6a1b9a" }}>4. Cálculo de Reposición Semanal</h4>
          <div style={{
            background: "#fff", border: "1px solid #e0e0e0", borderRadius: 6,
            padding: "10px 14px", fontFamily: "monospace", fontSize: 12, marginBottom: 8,
          }}>
            <div>ETc_diaria = ET0 × Kc</div>
            <div>ETc_semanal = ETc_diaria × 7</div>
            <div>precip_efectiva = min(lluvia × 0.75, ETc × 0.80)</div>
            <div>reposición_neta = ETc_semanal - precip_efectiva</div>
            <div><strong>reposición_bruta = reposición_neta / eficiencia</strong></div>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li><strong>Eficiencia</strong>: Factor del sistema de riego (default 0.9 = 90%).</li>
            <li><strong>Precipitación efectiva</strong>: Máximo 75% de la lluvia o 80% de la ETc.</li>
          </ul>
        </div>

        {/* Clasificación */}
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#c62828" }}>5. Clasificación de Acción</h4>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li><strong>💧 Regar</strong>: Reposición bruta {'>'} 25 mm</li>
            <li><strong>👀 Monitorear</strong>: Reposición bruta 15-25 mm</li>
            <li><strong>✅ Sin riego</strong>: Reposición bruta {'≤'} 15 mm</li>
          </ul>
        </div>

        {/* Conversión */}
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#37474f" }}>6. Conversión a Volumen</h4>
          <div style={{
            background: "#fff", border: "1px solid #e0e0e0", borderRadius: 6,
            padding: "10px 14px", fontFamily: "monospace", fontSize: 12,
          }}>
            <div>volumen (m³/ha) = reposición_bruta (mm) × 10</div>
            <div><strong>volumen_total = m³/ha × hectáreas</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ====== COMPONENTES AUXILIARES ======

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

// ====== ESTILOS ======

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const thStyle: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #ddd", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#555", background: "#f5f5f5", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #eee" };
const tdTutorial: React.CSSProperties = { padding: "4px 8px", borderBottom: "1px solid #f0f0f0", fontSize: 12 };
const selectStyle: React.CSSProperties = { padding: "5px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 12, minWidth: 100 };
const btnClear: React.CSSProperties = { padding: "5px 10px", border: "1px solid #ccc", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 12 };
const btnTutorial: React.CSSProperties = { padding: "5px 10px", border: "1px solid #1565c0", borderRadius: 4, background: "#e8f0fe", cursor: "pointer", fontSize: 12, color: "#1565c0" };
