import { useState } from "react";
import { useCuarteles } from "../hooks/useCuarteles";
import { useSectores } from "../hooks/useSectores";
import { Cuartel } from "../lib/types";
import FormularioCuartel from "../components/cuarteles/FormularioCuartel";

export default function AdminCuarteles() {
  const { cuarteles, loading, error, updateCuartel, deleteCuartel } =
    useCuarteles();
  const { sectores } = useSectores();
  const [editing, setEditing] = useState<Cuartel | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  if (loading) return <CenterMsg msg="Cargando cuarteles..." />;
  if (error) return <CenterMsg msg={`Error: ${error}`} />;

  const filtered = cuarteles.filter(
    (c) =>
      !search ||
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.especie?.toLowerCase().includes(search.toLowerCase()) ||
      c.jefe_campo?.toLowerCase().includes(search.toLowerCase())
  );

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
        <h2 style={{ margin: 0 }}>Cuarteles ({cuarteles.length})</h2>
        <input
          type="text"
          placeholder="Buscar cuartel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchStyle}
        />
      </div>

      <p style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>
        Mostrando {filtered.length} de {cuarteles.length} cuarteles. Clic en
        Editar para modificar.
      </p>

      <div style={{ maxHeight: "calc(100vh - 200px)", overflow: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Especie</th>
              <th>Variedad</th>
              <th>Año</th>
              <th>Superficie</th>
              <th>JC</th>
              <th>Centro Costo</th>
              <th>Eq/Sector</th>
              <th style={{ width: 120 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.nombre}</strong>
                </td>
                <td>{c.especie}</td>
                <td>{c.variedad}</td>
                <td>{c.anio_plantacion}</td>
                <td>{c.superficie_ha ? `${c.superficie_ha} ha` : ""}</td>
                <td>{c.jefe_campo}</td>
                <td>{c.centro_costo}</td>
                <td>{c.equipo_riego} / {c.sector_raw}</td>
                <td>
                  <button
                    onClick={() => {
                      setEditing(c);
                      setShowForm(true);
                    }}
                    style={btnSmStyle}
                  >
                    Editar
                  </button>{" "}
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar ${c.nombre}?`))
                        deleteCuartel(c.id);
                    }}
                    style={{ ...btnSmStyle, color: "#c62828" }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", color: "#999" }}>
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && editing && (
        <FormularioCuartel
          cuartel={editing}
          sectores={sectores}
          onSave={async (data) => {
            await updateCuartel(editing.id, data);
            setShowForm(false);
            setEditing(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CenterMsg({ msg }: { msg: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: 200,
      }}
    >
      <p>{msg}</p>
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};
const searchStyle: React.CSSProperties = {
  padding: "6px 12px",
  width: 220,
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: 13,
};
const btnSmStyle: React.CSSProperties = {
  padding: "4px 10px",
  background: "none",
  border: "1px solid #ccc",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
};
