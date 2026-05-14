import { useState, useMemo } from "react";
import { useSectores } from "../hooks/useSectores";
import { useEquipos } from "../hooks/useEquipos";
import { Sector } from "../lib/types";
import FormularioSector from "../components/sectores/FormularioSector";

export default function AdminSectores() {
  const { sectores, loading, error, createSector, updateSector, deleteSector, updateGeometria, fetchGeometriaSector } = useSectores();
  const { equipos } = useEquipos();
  const [editing, setEditing] = useState<Sector | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filtros, setFiltros] = useState({ equipo: "", especie: "", jc: "", variedad: "" });
  const [search, setSearch] = useState("");

  const getEquipoNombre = (equipoId: string) =>
    equipos.find(e => e.id === equipoId)?.nombre || "";

  const unique = useMemo(() => {
    const eq = new Set<string>();
    const esp = new Set<string>();
    const jc = new Set<string>();
    const varSet = new Set<string>();
    sectores.forEach(s => {
      if (s.especie) esp.add(s.especie);
      if (s.variedad) varSet.add(s.variedad);
      if (s.jefe_campo) s.jefe_campo.split("/").forEach(n => jc.add(n.trim()));
      if (s.equipo_id) eq.add(getEquipoNombre(s.equipo_id));
    });
    return {
      equipos: Array.from(eq).sort((a, b) => {
        const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return na - nb;
      }),
      especies: Array.from(esp).sort(),
      jefes: Array.from(jc).sort(),
      variedades: Array.from(varSet).sort(),
    };
  }, [sectores, equipos]);

  const filtered = useMemo(() => sectores.filter(s => {
    if (search && !s.codigo.toLowerCase().includes(search.toLowerCase())) return false;
    const eqName = getEquipoNombre(s.equipo_id);
    if (filtros.equipo && eqName !== filtros.equipo) return false;
    if (filtros.especie && s.especie !== filtros.especie) return false;
    if (filtros.variedad && s.variedad !== filtros.variedad) return false;
    if (filtros.jc && (!s.jefe_campo || !s.jefe_campo.includes(filtros.jc))) return false;
    return true;
  }), [sectores, filtros, equipos, search]);

  if (loading) return <CenterMsg msg="Cargando sectores..." />;
  if (error) return <CenterMsg msg={`Error: ${error}`} />;

  const s = selectStyle;
  return (
    <div style={{ maxWidth: "95%", margin: "24px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Sectores de Riego ({sectores.length})</h2>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={btnPrimary}>+ Nuevo Sector</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
        <input
          type="text" placeholder="Buscar sector..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "5px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 12, width: 160 }}
        />
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
        Mostrando {filtered.length} de {sectores.length} sectores.
      </p>

      <div style={{ maxHeight: "calc(100vh - 240px)", overflow: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th>Código</th><th>Equipo</th><th>N°</th><th>Has</th>
              <th>Especie</th><th>Variedad</th><th>Bomba</th><th>Filtro</th>
              <th>Año</th><th>JC</th><th>m³/ha</th>
              <th style={{ width: 100 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td><strong>{s.codigo}</strong></td>
                <td>{getEquipoNombre(s.equipo_id)}</td><td>{s.numero}</td>
                <td>{s.hectareas ?? ""}</td><td>{s.especie}</td><td>{s.variedad}</td>
                <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{s.bomba}</td>
                <td>{s.filtro}</td><td>{s.anio ?? ""}</td><td>{s.jefe_campo}</td>
                <td>{s.m3_ha ?? ""}</td>
                <td>
                  <button onClick={() => { setEditing(s); setShowForm(true); }} style={btnSm}>Editar</button>{" "}
                  <button onClick={() => { if (confirm(`Eliminar ${s.codigo}?`)) deleteSector(s.id); }}
                    style={{ ...btnSm, color: "#c62828" }}>Eliminar</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={12} style={{ textAlign: "center", color: "#999" }}>Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <FormularioSector
          sector={editing}
          equipos={equipos}
          onSave={async (data) => {
            if (editing) { await updateSector(editing.id, data); }
            else { await createSector(data as any); }
            setShowForm(false); setEditing(null);
          }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onUpdateGeometria={async (gj) => {
            if (editing) await updateGeometria(editing.id, gj);
            window.location.href = "/";
          }}
          fetchGeometria={fetchGeometriaSector}
        />
      )}
    </div>
  );
}

function CenterMsg({ msg }: { msg: string }) {
  return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}><p>{msg}</p></div>;
}

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const selectStyle: React.CSSProperties = { padding: "5px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 12, minWidth: 100 };
const btnSm: React.CSSProperties = { padding: "4px 10px", background: "none", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnPrimary: React.CSSProperties = { padding: "8px 16px", background: "#1565c0", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 };
const btnClear: React.CSSProperties = { padding: "5px 10px", border: "1px solid #ccc", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 12 };
