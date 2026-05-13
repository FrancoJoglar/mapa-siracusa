import { useState, useMemo } from "react";
import { useCuarteles } from "../hooks/useCuarteles";
import { useSectores } from "../hooks/useSectores";
import { Cuartel } from "../lib/types";
import FormularioCuartel from "../components/cuarteles/FormularioCuartel";

const parts = (raw: string) => raw.split('-').map(x => x.trim()).filter(Boolean);

export default function AdminCuarteles() {
  const { cuarteles, loading, error, updateCuartel, deleteCuartel, updateGeometria } = useCuarteles();
  const { sectores } = useSectores();
  const [editing, setEditing] = useState<Cuartel | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filtros, setFiltros] = useState({ equipo: "", especie: "", jc: "", variedad: "" });

  if (loading) return <CenterMsg msg="Cargando cuarteles..." />;
  if (error) return <CenterMsg msg={`Error: ${error}`} />;

  const unique = useMemo(() => {
    const eq = new Set<string>();
    const esp = new Set<string>();
    const jc = new Set<string>();
    const varSet = new Set<string>();
    cuarteles.forEach(c => {
      if (c.especie) esp.add(c.especie);
      if (c.variedad) varSet.add(c.variedad);
      if (c.jefe_campo) jc.add(c.jefe_campo);
      if (c.equipo_riego) parts(c.equipo_riego).forEach(n => eq.add(n));
    });
    return {
      equipos: Array.from(eq).sort((a: string, b: string) => Number(a) - Number(b)),
      especies: Array.from(esp).sort(),
      jefes: Array.from(jc).sort(),
      variedades: Array.from(varSet).sort(),
    };
  }, [cuarteles]);

  const filtered = useMemo(() => cuarteles.filter(c => {
    if (filtros.especie && c.especie !== filtros.especie) return false;
    if (filtros.variedad && c.variedad !== filtros.variedad) return false;
    if (filtros.jc && c.jefe_campo !== filtros.jc) return false;
    if (filtros.equipo && (!c.equipo_riego || !parts(c.equipo_riego).includes(filtros.equipo))) return false;
    return true;
  }), [cuarteles, filtros]);

  const s = selectStyle;
  return (
    <div style={{ maxWidth: "95%", margin: "24px auto", padding: "0 16px" }}>
      <h2 style={{ margin: "0 0 12px" }}>Cuarteles ({cuarteles.length})</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
        <select value={filtros.equipo} onChange={e => setFiltros({ ...filtros, equipo: e.target.value })} style={s}>
          <option value="">Equipo</option>
          {unique.equipos.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filtros.especie} onChange={e => setFiltros({ ...filtros, especie: e.target.value })} style={s}>
          <option value="">Especie</option>
          {unique.especies.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filtros.jc} onChange={e => setFiltros({ ...filtros, jc: e.target.value })} style={s}>
          <option value="">Jefe de Campo</option>
          {unique.jefes.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filtros.variedad} onChange={e => setFiltros({ ...filtros, variedad: e.target.value })} style={s}>
          <option value="">Variedad</option>
          {unique.variedades.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <button onClick={() => setFiltros({ equipo: "", especie: "", jc: "", variedad: "" })} style={btnClear}>Limpiar</button>
      </div>

      <p style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>
        Mostrando {filtered.length} de {cuarteles.length} cuarteles.
      </p>

      <div style={{ maxHeight: "calc(100vh - 220px)", overflow: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th>Nombre</th><th>Especie</th><th>Variedad</th><th>Año</th>
              <th>Superficie</th><th>JC</th><th>Centro Costo</th><th>Eq/Sector</th>
              <th style={{ width: 120 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td><strong>{c.nombre}</strong></td>
                <td>{c.especie}</td><td>{c.variedad}</td><td>{c.anio_plantacion}</td>
                <td>{c.superficie_ha ? `${c.superficie_ha} ha` : ""}</td><td>{c.jefe_campo}</td>
                <td>{c.centro_costo}</td><td>{c.equipo_riego} / {c.sector_raw}</td>
                <td>
                  <button onClick={() => { setEditing(c); setShowForm(true); }} style={btnSm}>Editar</button>{" "}
                  <button onClick={() => { if (confirm(`Eliminar ${c.nombre}?`)) deleteCuartel(c.id); }}
                    style={{ ...btnSm, color: "#c62828" }}>Eliminar</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "#999" }}>Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && editing && (
        <FormularioCuartel
          cuartel={editing}
          sectores={sectores}
          onSave={async (data) => { await updateCuartel(editing.id, data); setShowForm(false); setEditing(null); }}
          onUpdateGeometria={async (gj) => { await updateGeometria(editing.id, gj); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function CenterMsg({ msg }: { msg: string }) {
  return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}><p>{msg}</p></div>;
}

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const selectStyle: React.CSSProperties = { padding: "5px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 12, minWidth: 110 };
const btnSm: React.CSSProperties = { padding: "4px 10px", background: "none", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnClear: React.CSSProperties = { padding: "5px 10px", border: "1px solid #ccc", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 12 };
