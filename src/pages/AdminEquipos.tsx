import { useState } from "react";
import { useEquipos } from "../hooks/useEquipos";
import { Equipo } from "../lib/types";
import FormularioEquipo from "../components/equipos/FormularioEquipo";
import GestionBombas from "../components/equipos/GestionBombas";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import Georreferenciador from "../components/ui/Georreferenciador";

export default function AdminEquipos() {
  const { isAdmin } = useAuth();
  const { equipos, loading, error, createEquipo, updateEquipo, deleteEquipo } =
    useEquipos();
  const [editing, setEditing] = useState<Equipo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [geoRef, setGeoRef] = useState<{ codigo: string; id: string } | null>(null);
  const [bombasDe, setBombasDe] = useState<Equipo | null>(null);

  if (loading) return <CenterMsg msg="Cargando equipos..." />;
  if (error) return <CenterMsg msg={`Error: ${error}`} />;

  return (
    <div style={{ maxWidth: 800, margin: "24px auto", padding: "0 16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>Equipos de Riego</h2>
        {isAdmin && (
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          style={btnPrimaryStyle}
        >
          + Nuevo Equipo
        </button>
        )}
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th>Estado</th>
            <th>Código</th>
            <th>Nombre</th>
            <th>Descripción</th>
            <th style={{ width: 180 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {equipos.map((e) => (
            <FilaEquipo key={e.id} equipo={e} isAdmin={isAdmin} onEdit={() => { setEditing(e); setShowForm(true); }} onDelete={() => { if (confirm(`¿Eliminar ${e.nombre}?`)) deleteEquipo(e.id); }} onPuntos={() => setGeoRef({ codigo: 'Equipo ' + e.codigo, id: e.id })} onBombas={() => setBombasDe(e)} onToggleActivo={async () => { await updateEquipo(e.id, { activo: !e.activo }); }} />
          ))}
          {equipos.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: "center", color: "#999" }}>
                No hay equipos. Creá el primero.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showForm && (
        <FormularioEquipo
          equipo={editing}
          onSave={async (data) => {
            if (editing) {
              await updateEquipo(editing.id, data);
            } else {
              await createEquipo(data as any);
            }
            setShowForm(false);
            setEditing(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {bombasDe && (
        <GestionBombas
          equipoId={bombasDe.id}
          equipoNombre={bombasDe.nombre}
          onClose={() => setBombasDe(null)}
        />
      )}

      {geoRef && (
        <Georreferenciador
          equipoCodigo={geoRef.codigo}
          equipoId={equipos.find(e => 'Equipo ' + e.codigo === geoRef.codigo)?.id || ""}
          initialCenter={[-35.14, -71.62]}
          onCreateTuberia={async (data) => {
            try {
              const eq = equipos.find(e => 'Equipo ' + e.codigo === geoRef.codigo);
              if (!eq) return;
              const payload: any = {
                codigo: data.codigo,
                equipo_id: eq.id,
                nivel: data.nivel,
                material: data.material,
                diametro_mm: data.diametro_mm,
                geometria: { type: "LineString", coordinates: data.puntos.map(p => [p.lng, p.lat]) },
              };
              if (data.tuberia_padre_id) payload.tuberia_padre_id = data.tuberia_padre_id;
              const { error } = await supabase.from('tuberias').insert(payload);
              if (error) alert("Error tubería: " + error.message);
            } catch (e: any) { alert("Error tubería: " + e.message); }
          }}
          onDeleteTuberia={async (id) => {
            const { error } = await supabase.from('tuberias').delete().eq('id', id);
            if (error) alert("Error al eliminar tubería: " + error.message);
          }}
          onCreateValvula={async (data) => {
            try {
              const eq = equipos.find(e => 'Equipo ' + e.codigo === geoRef.codigo);
              if (!eq) return;
              const { error } = await supabase.from('valvulas').insert({
                codigo: data.codigo,
                tipo: data.tipo || 'transicion',
                diametro_mm: data.diametro_mm,
                equipo_id: eq.id,
                sector_codigo: data.sector_codigo,
                geometria: { type: "Point", coordinates: [data.punto.lng, data.punto.lat] },
              });
              if (error) alert("Error válvula: " + error.message);
            } catch (e: any) { alert("Error válvula: " + e.message); }
          }}
          onUpdateValvula={async (id, punto) => {
            const { error } = await supabase.from('valvulas').update({
              geometria: { type: "Point", coordinates: [punto.lng, punto.lat] },
            }).eq('id', id);
            if (error) alert("Error al mover válvula: " + error.message);
          }}
          onUpdateValvulaData={async (id, data) => {
            const payload: any = {};
            if (data.bloque_riego !== undefined) payload.bloque_riego = data.bloque_riego;
            if (data.diametro_mm !== undefined) payload.diametro_mm = data.diametro_mm;
            if (data.activacion !== undefined) payload.activacion = data.activacion;
            if (data.sector_codigo !== undefined) payload.sector_codigo = data.sector_codigo;
            if (data.color !== undefined) payload.color = data.color;
            const { error } = await supabase.from('valvulas').update(payload).eq('id', id);
            if (error) alert("Error al guardar válvula: " + error.message);
          }}
          onUpdateTuberia={async (id, puntos) => {
            const { error } = await supabase.from('tuberias').update({
              geometria: { type: "LineString", coordinates: puntos.map(p => [p.lng, p.lat]) },
            }).eq('id', id);
            if (error) alert("Error al actualizar tubería: " + error.message);
          }}
          onDeleteValvula={async (id) => {
            const { error } = await supabase.from('valvulas').delete().eq('id', id);
            if (error) alert("Error al eliminar válvula: " + error.message);
          }}
          onCreateAntena={async (data) => {
            try {
              const eq = equipos.find(e => 'Equipo ' + e.codigo === geoRef.codigo);
              if (!eq) return;
              const { error } = await supabase.from('antenas').insert({
                codigo: data.codigo,
                tipo: data.tipo,
                equipo_id: eq.id,
                geometria: { type: "Point", coordinates: [data.punto.lng, data.punto.lat] },
              });
              if (error) alert("Error antena: " + error.message);
            } catch (e: any) { alert("Error antena: " + e.message); }
          }}
          onCreateSonda={async (data) => {
            try {
              const eq = equipos.find(e => 'Equipo ' + e.codigo === geoRef.codigo);
              if (!eq) return;
              const { error } = await supabase.from('sondas').insert({
                codigo: data.codigo,
                tipo: data.tipo,
                profundidad_m: data.profundidad_m,
                equipo_id: eq.id,
                geometria: { type: "Point", coordinates: [data.punto.lng, data.punto.lat] },
              });
              if (error) alert("Error sonda: " + error.message);
            } catch (e: any) { alert("Error sonda: " + e.message); }
          }}
          onClose={() => setGeoRef(null)}
        />
      )}
    </div>
  );
}

function FilaEquipo({ equipo, isAdmin, onEdit, onDelete, onPuntos, onBombas, onToggleActivo }: { equipo: Equipo; isAdmin: boolean; onEdit: () => void; onDelete: () => void; onPuntos: () => void; onBombas: () => void; onToggleActivo: () => void }) {
  const activo = equipo.activo ?? true;
  return (
    <tr key={equipo.id} style={{ opacity: activo ? 1 : 0.5 }}>
      <td>
        <button
          onClick={onToggleActivo}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 18, padding: 0, lineHeight: 1,
          }}
          title={activo ? "Desactivar equipo" : "Activar equipo"}
        >
          {activo ? "🟢" : "🔴"}
        </button>
      </td>
      <td>{equipo.codigo}</td>
      <td>{equipo.nombre}{!activo && <span style={{ color: "#c62828", fontSize: 11, marginLeft: 6, fontWeight: 600 }}>INACTIVO</span>}</td>
      <td>{equipo.descripcion}</td>
      <td>
        {isAdmin && <>
          <button onClick={onBombas} style={{ ...btnSmStyle, fontSize: 11, marginRight: 4, color: "#1565c0", fontWeight: 600 }}>Bombas</button>
          <button onClick={onPuntos} style={{ ...btnSmStyle, fontSize: 11, marginRight: 4, color: "#2e7d32", fontWeight: 600 }}>📍 Puntos</button>
          <button onClick={onEdit} style={btnSmStyle}>Editar</button>{" "}
          <button onClick={onDelete} style={{ ...btnSmStyle, color: "#c62828" }}>Eliminar</button>
        </>}
      </td>
    </tr>
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
  fontSize: 14,
};
const btnPrimaryStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#1565c0",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 500,
};
const btnSmStyle: React.CSSProperties = {
  padding: "4px 10px",
  background: "none",
  border: "1px solid #ccc",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
};
