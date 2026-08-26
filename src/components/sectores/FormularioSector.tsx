import { useState, useEffect } from "react";
import { Equipo, Sector } from "../../lib/types";
import { supabase } from "../../lib/supabase";
import EditorGeometria from "../ui/EditorGeometria";
import { useBombas, useSectorBombas } from "../../hooks/useBombas";
import { useFiltros } from "../../hooks/useFiltros";
import { useSectorFiltros } from "../../hooks/useSectorFiltros";
import type { Feature } from "geojson";

interface Props {
  sector: Sector | null;
  equipos: Equipo[];
  onSave: (data: Partial<Sector>) => Promise<void>;
  onCancel: () => void;
  fetchGeometria?: (id: string) => Promise<Feature | null>;
}

export default function FormularioSector({ sector, equipos, onSave, onCancel, fetchGeometria }: Props) {
  const [equipoId, setEquipoId] = useState(sector?.equipo_id || "");
  const [numero, setNumero] = useState(sector?.numero || 0);
  const [caudalNominal, setCaudalNominal] = useState(sector?.caudal_nominal ?? 0);
  const [hectareas, setHectareas] = useState(sector?.hectareas ?? 0);
  const [anio, setAnio] = useState(sector?.anio ?? 0);
  const [jefeCampo, setJefeCampo] = useState(sector?.jefe_campo || "");
  const [especie, setEspecie] = useState(sector?.especie || "");
  const [variedad, setVariedad] = useState(sector?.variedad || "");
  const [precipitacion, setPrecipitacion] = useState(sector?.precipitacion ?? 0);
  const [eficiencia, setEficiencia] = useState(sector?.eficiencia ?? 0);
  const [distHilera, setDistHilera] = useState(sector?.dist_entre_hilera ?? 0);
  const [distPlantas, setDistPlantas] = useState(sector?.dist_entre_plantas ?? 0);
  const [distGoteros, setDistGoteros] = useState(sector?.dist_entre_goteros ?? 0);
  const [numLineas, setNumLineas] = useState(sector?.num_lineas ?? 0);
  const [caudalEmisor, setCaudalEmisor] = useState(sector?.caudal_emisor ?? 0);
  const [descripcion, setDescripcion] = useState(sector?.descripcion || "");
  const [m3ha, setM3ha] = useState(sector?.m3_ha ?? 0);
  const [configBombas, setConfigBombas] = useState<Sector["config_bombas"]>(sector?.config_bombas ?? null);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [geoData, setGeoData] = useState<Feature | null>(null);

  // Bombas del equipo seleccionado + las asignadas al sector
  const { bombas } = useBombas(equipoId || undefined);
  const { bombaIds, guardar: guardarSectorBombas } = useSectorBombas(sector?.id);
  const [seleccion, setSeleccion] = useState<string[] | null>(null);
  const bombasSel = seleccion ?? bombaIds; // hasta que el usuario toque algo, refleja lo guardado
  const toggleBomba = (id: string) => {
    const base = seleccion ?? bombaIds;
    setSeleccion(base.includes(id) ? base.filter((x) => x !== id) : [...base, id]);
  };

  // Filtros del equipo seleccionado + los asignados al sector
  const { filtros } = useFiltros(equipoId || undefined);
  const { filtroIds, guardar: guardarSectorFiltros } = useSectorFiltros(sector?.id);
  const [seleccionFiltros, setSeleccionFiltros] = useState<string[] | null>(null);
  const filtrosSel = seleccionFiltros ?? filtroIds;
  const toggleFiltro = (id: string) => {
    const base = seleccionFiltros ?? filtroIds;
    setSeleccionFiltros(base.includes(id) ? base.filter((x: string) => x !== id) : [...base, id]);
  };

  // Cuarteles que riega este sector con porcentajes
  const [cuartelesSector, setCuartelesSector] = useState<Array<{ id: string; nombre: string; porcentaje_agua: number | null }>>([]);
  const [cuartelPcts, setCuartelPcts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!sector?.id) return;
    supabase
      .from("cuartel_sector")
      .select("cuartel_id, porcentaje_agua, cuarteles(nombre)")
      .eq("sector_id", sector.id)
      .then(({ data }) => {
        if (!data) return;
        const items = data.map((r: any) => ({
          id: r.cuartel_id,
          nombre: r.cuarteles?.nombre || "Desconocido",
          porcentaje_agua: r.porcentaje_agua,
        }));
        setCuartelesSector(items);
        const pcts: Record<string, number> = {};
        items.forEach((item) => {
          if (item.porcentaje_agua != null) pcts[item.id] = item.porcentaje_agua;
        });
        setCuartelPcts(pcts);
      });
  }, [sector?.id]);

  const totalCuartelPct = cuartelesSector.reduce((sum, c) => sum + (cuartelPcts[c.id] ?? 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        equipo_id: equipoId, numero,
        caudal_nominal: caudalNominal || null,
        hectareas: hectareas || null,
        anio: anio || null,
        jefe_campo: jefeCampo,
        especie, variedad, descripcion,
        config_bombas: configBombas,
        precipitacion: precipitacion || null,
        eficiencia: eficiencia || null,
        dist_entre_hilera: distHilera || null,
        dist_entre_plantas: distPlantas || null,
        dist_entre_goteros: distGoteros || null,
        num_lineas: numLineas || null,
        caudal_emisor: caudalEmisor || null,
        m3_ha: m3ha || null,
      });
      // La relacion N:N solo se puede guardar sobre un sector existente
      if (sector?.id && seleccion !== null) {
        await guardarSectorBombas(sector.id, seleccion);
      }
      // Guardar filtros asignados al sector
      if (sector?.id && seleccionFiltros !== null) {
        await guardarSectorFiltros(sector.id, seleccionFiltros);
      }
      // Guardar porcentajes de riego por cuartel
      if (sector?.id) {
        for (const c of cuartelesSector) {
          const pct = cuartelPcts[c.id];
          if (pct != null) {
            await supabase
              .from("cuartel_sector")
              .update({ porcentaje_agua: pct })
              .eq("sector_id", sector.id)
              .eq("cuartel_id", c.id);
          }
        }
      }
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const previewCodigo = equipoId
    ? `E${equipos.find((e) => e.id === equipoId)?.codigo || ""}S${numero}`
    : "";

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ marginTop: 0 }}>{sector ? `Editar ${sector.codigo}` : "Nuevo Sector"}</h3>
        <form onSubmit={handleSubmit}>
          <Row>
            <Campo label="Equipo">
              <select value={equipoId} onChange={e => setEquipoId(e.target.value)} required style={inputStyle}>
                <option value="">Seleccionar...</option>
                {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre} (Cód. {eq.codigo})</option>)}
              </select>
            </Campo>
            <Campo label="N° Sector">
              <input type="number" value={numero} onChange={e => setNumero(Number(e.target.value))} required min={1} style={inputStyle} />
            </Campo>
            <Campo label="Código">
              <input type="text" value={previewCodigo} disabled style={{...inputStyle, background:"#f5f5f5", color:"#666"}} />
            </Campo>
          </Row>
          <Row>
            <Campo label="Caudal Nominal (m³/h)"><input type="number" step="0.1" value={caudalNominal || ""} onChange={e => setCaudalNominal(Number(e.target.value))} style={inputStyle} /></Campo>
            <Campo label="Hectáreas"><input type="number" step="0.01" value={hectareas || ""} onChange={e => setHectareas(Number(e.target.value))} style={inputStyle} /></Campo>
            <Campo label="m³/ha"><input type="number" step="0.01" value={m3ha || ""} onChange={e => setM3ha(Number(e.target.value))} style={inputStyle} /></Campo>
          </Row>
          <Row>
            <Campo label="Especie">
              <select value={especie} onChange={e => setEspecie(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar...</option>
                <option value="Olivo">Olivo</option>
                <option value="Avellano">Avellano</option>
                <option value="Cerezo">Cerezo</option>
                <option value="Kiwi">Kiwi</option>
              </select>
            </Campo>
            <Campo label="Variedad">
              <select value={variedad} onChange={e => setVariedad(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar...</option>
                <optgroup label="Olivo">
                  <option value="Arbequina">Arbequina</option>
                  <option value="Arbosana">Arbosana</option>
                  <option value="Korinenki">Korinenki</option>
                </optgroup>
                <optgroup label="Avellano">
                  <option value="Giffoni">Giffoni</option>
                </optgroup>
                <optgroup label="Cerezo">
                  <option value="Santina">Santina</option>
                  <option value="Lapins">Lapins</option>
                  <option value="Sweet Aryana">Sweet Aryana</option>
                  <option value="Pacific Red">Pacific Red</option>
                </optgroup>
                <optgroup label="Kiwi">
                  <option value="Hayward">Hayward</option>
                </optgroup>
              </select>
            </Campo>
            <Campo label="Año de Plantacion"><input type="number" value={anio || ""} onChange={e => setAnio(Number(e.target.value))} style={inputStyle} /></Campo>
          </Row>
          <p style={{ margin: "4px 0 12px", fontSize: 12, color: "#888" }}>
            Filtro y caseta se editan a nivel de equipo (Admin → Equipos), no por sector.
          </p>

          <h4 style={{ margin: "16px 0 8px", fontSize: 13, color: "#555" }}>Bombas de este sector</h4>
          {!sector?.id ? (
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>Guardá el sector primero para poder asignarle bombas.</p>
          ) : !equipoId ? (
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>Seleccioná un equipo para ver sus bombas.</p>
          ) : bombas.length === 0 ? (
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>El equipo no tiene bombas cargadas (Admin → Equipos → Bombas).</p>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {bombas.map((b) => {
                  const on = bombasSel.includes(b.id);
                  const etiqueta = [b.marca, b.modelo].filter(Boolean).join(" ") + (b.potencia_hp ? ` ${b.potencia_hp}HP` : "") + (b.funcion === "helada" ? " ❄" : "");
                  return (
                    <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "5px 10px", border: `1px solid ${on ? "#1565c0" : "#ccc"}`, borderRadius: 6, cursor: "pointer", background: on ? "#e8f0fe" : "#fff" }}>
                      <input type="checkbox" checked={on} onChange={() => toggleBomba(b.id)} />
                      {etiqueta || "(sin datos)"}
                    </label>
                  );
                })}
              </div>
              <Row>
                <Campo label="Disposición de las bombas">
                  <select value={configBombas ?? ""} onChange={(e) => setConfigBombas((e.target.value || null) as Sector["config_bombas"])} style={inputStyle}>
                    <option value="">— sin especificar —</option>
                    <option value="serie">Serie (suman presión)</option>
                    <option value="paralelo">Paralelo (suman caudal)</option>
                    <option value="mixta">Mixta</option>
                  </select>
                </Campo>
                <Campo label=""><span style={{ fontSize: 11, color: "#888" }}>{bombasSel.length} bomba(s) seleccionada(s)</span></Campo>
              </Row>
            </>
          )}

          <h4 style={{ margin: "16px 0 8px", fontSize: 13, color: "#555" }}>Filtros de este sector</h4>
          {!sector?.id ? (
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>Guardá el sector primero para poder asignarle filtros.</p>
          ) : !equipoId ? (
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>Seleccioná un equipo para ver sus filtros.</p>
          ) : filtros.length === 0 ? (
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>El equipo no tiene filtros cargados.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {filtros.map((f) => {
                const on = filtrosSel.includes(f.id);
                const etiqueta = [f.marca, f.modelo].filter(Boolean).join(" ") + (f.tipo ? ` (${f.tipo})` : "");
                return (
                  <label key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "5px 10px", border: `1px solid ${on ? "#1565c0" : "#ccc"}`, borderRadius: 6, cursor: "pointer", background: on ? "#e8f0fe" : "#fff" }}>
                    <input type="checkbox" checked={on} onChange={() => toggleFiltro(f.id)} />
                    {etiqueta || "(sin datos)"}
                  </label>
                );
              })}
            </div>
          )}

          {sector?.id && cuartelesSector.length > 0 && (
            <>
              <h4 style={{ margin: "16px 0 8px", fontSize: 13, color: "#555" }}>Porcentaje de Agua por Cuartel</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                {cuartelesSector.map(c => (
                  <div key={c.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 10px", background: "#f5f5f5", borderRadius: 4, fontSize: 13,
                  }}>
                    <strong style={{ minWidth: 60 }}>{c.nombre}</strong>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      <span style={{ color: "#666" }}>% Riego:</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={cuartelPcts[c.id] ?? ""}
                        onChange={(e) => setCuartelPcts(prev => ({
                          ...prev,
                          [c.id]: e.target.value === "" ? 0 : Number(e.target.value),
                        }))}
                        style={{
                          width: 60, padding: "3px 6px", border: "1px solid #ccc",
                          borderRadius: 4, fontSize: 12, textAlign: "center",
                        }}
                      />
                      <span style={{ color: "#999" }}>%</span>
                    </label>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: totalCuartelPct === 100 ? "#2e7d32" : totalCuartelPct > 100 ? "#c62828" : "#e65100", fontWeight: 500, marginTop: 4 }}>
                  Total: {totalCuartelPct}%
                </div>
              </div>
            </>
          )}
          <Row>
            <Campo label="Jefe de Campo"><input type="text" value={jefeCampo} onChange={e => setJefeCampo(e.target.value)} style={inputStyle} /></Campo>
            <Campo label="Precipitación"><input type="number" step="0.01" value={precipitacion || ""} onChange={e => setPrecipitacion(Number(e.target.value))} style={inputStyle} /></Campo>
            <Campo label="Eficiencia"><input type="number" step="0.01" value={eficiencia || ""} onChange={e => setEficiencia(Number(e.target.value))} style={inputStyle} /></Campo>
          </Row>
          <h4 style={{ margin: "16px 0 8px", fontSize: 13, color: "#555" }}>Distanciamiento</h4>
          <Row>
            <Campo label="Dist. Hilera (m)"><input type="number" step="0.01" value={distHilera || ""} onChange={e => setDistHilera(Number(e.target.value))} style={inputStyle} /></Campo>
            <Campo label="Dist. Plantas (m)"><input type="number" step="0.01" value={distPlantas || ""} onChange={e => setDistPlantas(Number(e.target.value))} style={inputStyle} /></Campo>
            <Campo label="Dist. Goteros (m)"><input type="number" step="0.01" value={distGoteros || ""} onChange={e => setDistGoteros(Number(e.target.value))} style={inputStyle} /></Campo>
          </Row>
          <Row>
            <Campo label="N° Líneas"><input type="number" value={numLineas || ""} onChange={e => setNumLineas(Number(e.target.value))} style={inputStyle} /></Campo>
            <Campo label="Caudal Emisor"><input type="number" step="0.01" value={caudalEmisor || ""} onChange={e => setCaudalEmisor(Number(e.target.value))} style={inputStyle} /></Campo>
          </Row>
          <Campo label="Descripción">
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} style={{...inputStyle, width:"100%", resize:"vertical"}} />
          </Campo>
          <div style={{display:"flex", gap:8, justifyContent:"space-between", marginTop:16}}>
            {sector && (
              <button type="button" onClick={async () => {
                if (fetchGeometria) {
                  const geo = await fetchGeometria(sector.id);
                  setGeoData(geo);
                }
                setShowEditor(true);
              }} style={btnEditor}>Editar Poligono</button>
            )}
            <div style={{display:"flex", gap:8, marginLeft: "auto"}}>
              <button type="button" onClick={onCancel} style={btnCancel}>Cancelar</button>
              <button type="submit" disabled={saving} style={btnSave}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </form>
      </div>

      {showEditor && sector && (
        <EditorGeometria
          geojson={geoData}
          table="sectores"
          entityId={sector.id}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 8 }}>{children}</div>;
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ flex: 1, marginBottom: 10 }}>
    <label style={{ display: "block", marginBottom: 3, fontSize: 11, fontWeight: 600, color: "#555" }}>{label}</label>
    {children}
  </div>;
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 };
const modal: React.CSSProperties = { background: "#fff", padding: 24, borderRadius: 8, width: 720, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "5px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 12, boxSizing: "border-box" };
const btnCancel: React.CSSProperties = { padding: "6px 14px", border: "1px solid #ccc", borderRadius: 4, background: "#f5f5f5", cursor: "pointer" };
const btnSave: React.CSSProperties = { padding: "6px 14px", background: "#1565c0", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 500 };
const btnEditor: React.CSSProperties = { padding: "6px 14px", background: "#fff3e0", color: "#e65100", border: "1px solid #ffcc80", borderRadius: 4, cursor: "pointer", fontWeight: 500, fontSize: 13 };
