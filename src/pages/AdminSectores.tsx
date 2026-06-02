import { useState, useMemo } from "react";
import { useSectores } from "../hooks/useSectores";
import { useEquipos } from "../hooks/useEquipos";
import { useCuarteles } from "../hooks/useCuarteles";
import { Sector } from "../lib/types";
import FormularioSector from "../components/sectores/FormularioSector";

export default function AdminSectores() {
  const { sectores, loading, error, createSector, updateSector, deleteSector, fetchGeometriaSector } = useSectores();
  const { equipos } = useEquipos();
  const { cuarteles, loading: loadingCuarteles } = useCuarteles();
  const [editing, setEditing] = useState<Sector | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [clickLog, setClickLog] = useState<string>("");
  const [filtros, setFiltros] = useState({ equipo: "", especie: "", jc: "", variedad: "" });
  const [search, setSearch] = useState("");

  const selectedSector = selectedSectorId ? sectores.find(s => s.id === selectedSectorId) : null;

  const cuartelesDelSector = useMemo(
    () => cuarteles.filter(c => c.sector_ids?.includes(selectedSectorId ?? "_")),
    [cuarteles, selectedSectorId]
  );

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
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#666", alignSelf: "center" }}>Click: {clickLog || "ninguno"}</span>
          <button onClick={() => { setSelectedSectorId("test"); setClickLog("test"); }} style={btnSm}>Test</button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} style={btnPrimary}>+ Nuevo Sector</button>
        </div>
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
        {selectedSectorId && <span style={{ marginLeft: 12, color: "#1565c0" }}>Seleccionado: {selectedSector?.codigo ?? "?"}</span>}
      </p>

      <div style={{ marginBottom: 8, padding: 8, background: "#fff3e0", borderRadius: 4, fontSize: 12 }}>
        DEBUG: selectedSectorId={selectedSectorId ?? "null"} | cuarteles={cuarteles.length} | loadingCuarteles={String(loadingCuarteles)}
      </div>

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
            {filtered.map(s => {
              const isSelected = selectedSectorId === s.id;
              return (
              <tr
                key={s.id}
                onClick={() => { setClickLog(s.codigo); setSelectedSectorId(isSelected ? null : s.id); }}
                style={{ cursor: "pointer", backgroundColor: isSelected ? "#e3f2fd" : undefined }}
              >
                <td><strong>{s.codigo}</strong></td>
                <td>{getEquipoNombre(s.equipo_id)}</td><td>{s.numero}</td>
                <td>{s.hectareas ?? ""}</td><td>{s.especie}</td><td>{s.variedad}</td>
                <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{s.bomba}</td>
                <td>{s.filtro}</td><td>{s.anio ?? ""}</td><td>{s.jefe_campo}</td>
                <td>{s.m3_ha ?? ""}</td>
                <td>
                  <button onClick={e => { e.stopPropagation(); setEditing(s); setShowForm(true); }} style={btnSm}>Editar</button>{" "}
                  <button onClick={e => { e.stopPropagation(); if (confirm(`Eliminar ${s.codigo}?`)) deleteSector(s.id); }}
                    style={{ ...btnSm, color: "#c62828" }}>Eliminar</button>
                </td>
              </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={12} style={{ textAlign: "center", color: "#999" }}>Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedSectorId && (
        <div style={{
          marginTop: 12, padding: "12px 16px", borderRadius: 6,
          border: "1px solid #90caf9", backgroundColor: "#f5faff",
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
            Sector: {selectedSector?.codigo ?? "Cargando..."}
          </div>
          {loadingCuarteles ? (
            <p style={{ margin: 0, fontSize: 12, color: "#999" }}>Cargando cuarteles...</p>
          ) : cuarteles.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "#c62828" }}>
              No se pudieron cargar los cuarteles.
            </p>
          ) : cuartelesDelSector.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
              Sin cuarteles vinculados ({cuarteles.length} cuarteles cargados).
            </p>
          ) : (
            <>
              <p style={{ margin: "0 0 4px", fontSize: 12, color: "#555" }}>
                Cuarteles vinculados ({cuartelesDelSector.length}):
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {cuartelesDelSector.map(c => (
                  <span key={c.id} style={{
                    padding: "3px 10px", borderRadius: 12, fontSize: 12,
                    backgroundColor: "#e3f2fd", border: "1px solid #90caf9",
                  }}>
                    {c.nombre}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

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
