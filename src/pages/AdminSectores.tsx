import { useState } from "react";
import { useSectores } from "../hooks/useSectores";
import { useEquipos } from "../hooks/useEquipos";
import { Sector } from "../lib/types";
import FormularioSector from "../components/sectores/FormularioSector";

export default function AdminSectores() {
  const { sectores, loading, error, createSector, updateSector, deleteSector } =
    useSectores();
  const { equipos } = useEquipos();
  const [editing, setEditing] = useState<Sector | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (loading) return <CenterMsg msg="Cargando sectores..." />;
  if (error) return <CenterMsg msg={`Error: ${error}`} />;

  const getEquipoNombre = (equipoId: string) =>
    equipos.find((e) => e.id === equipoId)?.nombre || "";

  return (
    <div style={{ maxWidth: "95%", margin: "24px auto", padding: "0 16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>Sectores de Riego ({sectores.length})</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          style={btnPrimaryStyle}
        >
          + Nuevo Sector
        </button>
      </div>

      <div style={{ maxHeight: "calc(100vh - 200px)", overflow: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Equipo</th>
              <th>N°</th>
              <th>Has</th>
              <th>Especie</th>
              <th>Variedad</th>
              <th>Bomba</th>
              <th>Filtro</th>
              <th>Año</th>
              <th>JC</th>
              <th>Caudal m³/h</th>
              <th>m³/ha</th>
              <th style={{ width: 100 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sectores.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.codigo}</strong></td>
                <td>{getEquipoNombre(s.equipo_id)}</td>
                <td>{s.numero}</td>
                <td>{s.hectareas ?? ""}</td>
                <td>{s.especie}</td>
                <td>{s.variedad}</td>
                <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{s.bomba}</td>
                <td>{s.filtro}</td>
                <td>{s.anio ?? ""}</td>
                <td>{s.jefe_campo}</td>
                <td>{s.caudal_nominal ?? ""}</td>
                <td>{s.m3_ha ?? ""}</td>
                <td>
                  <button onClick={() => { setEditing(s); setShowForm(true); }} style={btnSmStyle}>Editar</button>
                  {" "}
                  <button onClick={() => { if (confirm(`¿Eliminar ${s.codigo}?`)) deleteSector(s.id); }}
                    style={{ ...btnSmStyle, color: "#c62828" }}>Eliminar</button>
                </td>
              </tr>
            ))}
            {sectores.length === 0 && (
              <tr><td colSpan={13} style={{ textAlign: "center", color: "#999" }}>No hay sectores.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <FormularioSector
          sector={editing}
          equipos={equipos}
          onSave={async (data) => {
            if (editing) {
              await updateSector(editing.id, data);
            } else {
              const codigo = `E${data.equipo_id ? equipos.find(e => e.id === data.equipo_id)?.codigo : ""}S${data.numero}`;
              await createSector({ ...data, codigo } as any);
            }
            setShowForm(false);
            setEditing(null);
          }}
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
const btnPrimaryStyle: React.CSSProperties = { padding: "8px 16px", background: "#1565c0", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 };
const btnSmStyle: React.CSSProperties = { padding: "4px 10px", background: "none", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", fontSize: 12 };
