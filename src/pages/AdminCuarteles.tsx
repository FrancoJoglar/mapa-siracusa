import { useState, useMemo } from "react";
import { useCuarteles } from "../hooks/useCuarteles";
import { useSectores } from "../hooks/useSectores";
import { useUnidadesRiego } from "../hooks/useUnidadesRiego";
import { Cuartel, UnidadRiego } from "../lib/types";
import { supabase } from "../lib/supabase";
import FormularioCuartel from "../components/cuarteles/FormularioCuartel";
import EditorGeometria from "../components/ui/EditorGeometria";
import type { Feature } from "geojson";

export default function AdminCuarteles() {
  const { cuarteles, loading, error, refetch, updateCuartel, deleteCuartel } = useCuarteles();
  const { sectores } = useSectores();
  const { unidades } = useUnidadesRiego();
  const sectorCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    sectores.forEach(s => map.set(s.id, s.codigo));
    return map;
  }, [sectores]);
  const [editing, setEditing] = useState<Cuartel | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filtros, setFiltros] = useState({ equipo: "", especie: "", jc: "", variedad: "" });
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editUnidad, setEditUnidad] = useState<UnidadRiego | null>(null);

  const parts = (raw: string) => raw.split('-').map(x => x.trim()).filter(Boolean);

  const handleNuevoCuartel = async () => {
    try {
      const { data, error: err } = await supabase
        .rpc("create_cuartel_placeholder", { c_nombre: "Nuevo Cuartel " + Date.now() });
      if (err) throw err;
      if (data) {
        const nuevo: Cuartel = {
          id: data, nombre: "Nuevo Cuartel " + Date.now(),
          especie: "", variedad: "", anio_plantacion: null,
          superficie_ha: null, plantas: null, polinizante: "",
          jefe_campo: "", centro_costo: "",
          equipo_riego: "", sector_raw: "", sector_ids: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setEditing(nuevo);
        setShowForm(true);
        await refetch();
      }
    } catch (e: any) {
      alert("Error al crear cuartel: " + (e?.message || String(e)));
    }
  };

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

  const filtered = useMemo(() => {
    return cuarteles.filter(c => {
    if (search && !c.nombre.toLowerCase().includes(search.toLowerCase())) return false;
    if (filtros.especie && c.especie !== filtros.especie) return false;
    if (filtros.variedad && c.variedad !== filtros.variedad) return false;
    if (filtros.jc && c.jefe_campo !== filtros.jc) return false;
    if (filtros.equipo && (!c.equipo_riego || !parts(c.equipo_riego).includes(filtros.equipo))) return false;
    return true;
    });
  }, [cuarteles, filtros, search]);

  const unidadesPorCuartel = useMemo(() => {
    const map = new Map<string, UnidadRiego[]>();
    for (const u of unidades) {
      const arr = map.get(u.cuartel_id) || [];
      arr.push(u);
      map.set(u.cuartel_id, arr);
    }
    return map;
  }, [unidades]);

  if (loading) return <CenterMsg msg="Cargando cuarteles..." />;
  if (error) return <CenterMsg msg={`Error: ${error}`} />;

  const s = selectStyle;
  return (
    <div style={{ maxWidth: "95%", margin: "24px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 12px" }}>
        <h2>Cuarteles ({cuarteles.length})</h2>
        <button onClick={handleNuevoCuartel} style={btnPrimary}>+ Nuevo Cuartel</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
        <input
          type="text" placeholder="Buscar cuartel..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "5px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 12, width: 160 }}
        />
        <select value={filtros.equipo} onChange={e => setFiltros({ ...filtros, equipo: e.target.value })} style={s}>
          <option value="">Equipo</option>
          {unique.equipos.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filtros.especie} onChange={e => setFiltros({ ...filtros, especie: e.target.value })} style={s}>
          <option value="">Especie</option>
          {["Olivo", "Cerezo", "Avellano", "Kiwi", "Palto"].map(v => <option key={v} value={v}>{v}</option>)}
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
              <th style={{ width: 30 }}></th>
              <th>Nombre</th><th>Especie</th><th>Variedad</th><th>Año</th>
              <th>Superficie</th><th>JC</th><th>Centro Costo</th><th>Sectores</th>
              <th style={{ width: 120 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const isExpanded = expandedId === c.id;
              return (
                <tr key={c.id}>
                  <td>
                    <button onClick={() => setExpandedId(isExpanded ? null : c.id)} style={btnExpand}>
                      {isExpanded ? "▼" : "▶"}
                    </button>
                  </td>
                  <td><strong>{c.nombre}</strong></td>
                  <td>{c.especie}</td><td>{c.variedad}</td><td>{c.anio_plantacion}</td>
                  <td>{c.superficie_ha ? `${c.superficie_ha} ha` : ""}</td><td>{c.jefe_campo}</td>
                  <td>{c.centro_costo}</td><td>{(c.sector_ids || []).map(id => sectorCodeMap.get(id)).filter(Boolean).join(", ")}</td>
                  <td>
                    <button onClick={() => { setEditing(c); setShowForm(true); }} style={btnSm}>Editar</button>{" "}
                    <button onClick={() => { if (confirm(`Eliminar ${c.nombre}?`)) deleteCuartel(c.id); }}
                      style={{ ...btnSm, color: "#c62828" }}>Eliminar</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: "center", color: "#999" }}>Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
        {filtered.map(c => expandedId === c.id && (
          <div key={`sub-${c.id}`} style={subtableContainer}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: "#555" }}>
              Unidades de riego ({c.nombre})
            </div>
            {(() => {
              const cuartelUnidades = unidadesPorCuartel.get(c.id) || [];
              if (cuartelUnidades.length === 0) {
                return <p style={{ margin: 0, fontSize: 12, color: "#999" }}>Sin sectores asignados.</p>;
              }
              return (
                <table style={{ ...tableStyle, fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th>Código</th><th>Sector</th><th>% Agua</th><th>Polígono</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuartelUnidades.map(u => (
                      <tr key={u.id}>
                        <td><strong>{u.codigo}</strong></td>
                        <td>{u.sector_codigo}</td>
                        <td>{u.porcentaje_agua ?? ""}</td>
                        <td>
                          <button onClick={() => setEditUnidad(u)} style={btnSm}>Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        ))}
      </div>

      {editUnidad && (
        <EditorGeometria
          geojson={(editUnidad.geojson as Feature) || null}
          table="cuartel_sector"
          where={`cuartel_id=eq.${editUnidad.cuartel_id}&sector_id=eq.${editUnidad.sector_id}`}
          onCancel={() => setEditUnidad(null)}
        />
      )}

      {showForm && editing && (
        <FormularioCuartel
          cuartel={editing}
          sectores={sectores}
          onSave={async (data) => { await updateCuartel(editing.id, data); setShowForm(false); setEditing(null); window.location.reload(); }}
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
const btnPrimary: React.CSSProperties = { padding: "6px 14px", border: "none", borderRadius: 4, background: "#1b5e20", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 };
const btnExpand: React.CSSProperties = { padding: "2px 6px", border: "none", background: "none", cursor: "pointer", fontSize: 11, color: "#666" };
const subtableContainer: React.CSSProperties = { padding: "8px 16px 12px 40px", borderBottom: "1px solid #eee", background: "#fafafa" };
