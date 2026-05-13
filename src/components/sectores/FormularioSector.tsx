import { useState } from "react";
import { Equipo, Sector } from "../../lib/types";
import EditorGeometria from "../ui/EditorGeometria";
import type { Feature } from "geojson";

interface Props {
  sector: Sector | null;
  equipos: Equipo[];
  onSave: (data: Partial<Sector>) => Promise<void>;
  onCancel: () => void;
  onUpdateGeometria?: (geojson: Feature) => Promise<void>;
  fetchGeometria?: (id: string) => Promise<Feature | null>;
}

export default function FormularioSector({ sector, equipos, onSave, onCancel, onUpdateGeometria, fetchGeometria }: Props) {
  const [equipoId, setEquipoId] = useState(sector?.equipo_id || "");
  const [numero, setNumero] = useState(sector?.numero || 0);
  const [caudalNominal, setCaudalNominal] = useState(sector?.caudal_nominal ?? 0);
  const [hectareas, setHectareas] = useState(sector?.hectareas ?? 0);
  const [variedad, setVariedad] = useState(sector?.variedad || "");
  const [caseta, setCaseta] = useState(sector?.caseta || "");
  const [bomba, setBomba] = useState(sector?.bomba || "");
  const [filtro, setFiltro] = useState(sector?.filtro || "");
  const [anio, setAnio] = useState(sector?.anio ?? 0);
  const [jefeCampo, setJefeCampo] = useState(sector?.jefe_campo || "");
  const [especie, setEspecie] = useState(sector?.especie || "");
  const [precipitacion, setPrecipitacion] = useState(sector?.precipitacion ?? 0);
  const [eficiencia, setEficiencia] = useState(sector?.eficiencia ?? 0);
  const [distHilera, setDistHilera] = useState(sector?.dist_entre_hilera ?? 0);
  const [distPlantas, setDistPlantas] = useState(sector?.dist_entre_plantas ?? 0);
  const [distGoteros, setDistGoteros] = useState(sector?.dist_entre_goteros ?? 0);
  const [numLineas, setNumLineas] = useState(sector?.num_lineas ?? 0);
  const [caudalEmisor, setCaudalEmisor] = useState(sector?.caudal_emisor ?? 0);
  const [descripcion, setDescripcion] = useState(sector?.descripcion || "");
  const [m3ha, setM3ha] = useState(sector?.m3_ha ?? 0);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [geoData, setGeoData] = useState<Feature | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        equipo_id: equipoId, numero,
        caudal_nominal: caudalNominal || null,
        hectareas: hectareas || null,
        variedad, caseta, bomba, filtro,
        anio: anio || null,
        jefe_campo: jefeCampo,
        especie, descripcion,
        precipitacion: precipitacion || null,
        eficiencia: eficiencia || null,
        dist_entre_hilera: distHilera || null,
        dist_entre_plantas: distPlantas || null,
        dist_entre_goteros: distGoteros || null,
        num_lineas: numLineas || null,
        caudal_emisor: caudalEmisor || null,
        m3_ha: m3ha || null,
      });
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
            <Campo label="Variedad"><input type="text" value={variedad} onChange={e => setVariedad(e.target.value)} style={inputStyle} /></Campo>
            <Campo label="Año"><input type="number" value={anio || ""} onChange={e => setAnio(Number(e.target.value))} style={inputStyle} /></Campo>
          </Row>
          <Row>
            <Campo label="Bomba"><input type="text" value={bomba} onChange={e => setBomba(e.target.value)} style={inputStyle} /></Campo>
            <Campo label="Filtro"><input type="text" value={filtro} onChange={e => setFiltro(e.target.value)} style={inputStyle} /></Campo>
            <Campo label="Caseta"><input type="text" value={caseta} onChange={e => setCaseta(e.target.value)} style={inputStyle} /></Campo>
          </Row>
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
            {sector && onUpdateGeometria && (
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

      {showEditor && (
        <EditorGeometria
          geojson={geoData}
          onSave={async (gj) => {
            if (onUpdateGeometria) await onUpdateGeometria(gj);
            setShowEditor(false);
          }}
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
