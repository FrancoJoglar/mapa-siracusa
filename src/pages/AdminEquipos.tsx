import { useState, useRef } from "react";
import { useEquipos } from "../hooks/useEquipos";
import { Equipo } from "../lib/types";
import FormularioEquipo from "../components/equipos/FormularioEquipo";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import VisorPDF from "../components/ui/VisorPDF";
import Georreferenciador from "../components/ui/Georreferenciador";

export default function AdminEquipos() {
  const { isAdmin } = useAuth();
  const { equipos, loading, error, createEquipo, updateEquipo, deleteEquipo } =
    useEquipos();
  const [editing, setEditing] = useState<Equipo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [visorPdf, setVisorPdf] = useState<{ url: string; nombre: string } | null>(null);
  const [geoRef, setGeoRef] = useState<{ url: string; codigo: string } | null>(null);
  const [savedGeo, setSavedGeo] = useState<any>(null);

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
            <th>Código</th>
            <th>Nombre</th>
            <th>Descripción</th>
            <th>Plano</th>
            <th style={{ width: 120 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {equipos.map((e) => (
            <FilaEquipo key={e.id} equipo={e} isAdmin={isAdmin} onEdit={() => { setEditing(e); setShowForm(true); }} onDelete={() => { if (confirm(`¿Eliminar ${e.nombre}?`)) deleteEquipo(e.id); }} onViewPlano={(url, nombre) => setVisorPdf({ url, nombre })} onGeoref={async (url, codigo) => {
              const { data } = await supabase.from('georreferencias').select('*').eq('equipo_id', e.id).single();
              setSavedGeo(data);
              setGeoRef({ url, codigo });
            }} />
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

      {visorPdf && <VisorPDF url={visorPdf.url} nombre={visorPdf.nombre} onClose={() => setVisorPdf(null)} />}

      {geoRef && (
        <Georreferenciador
          planoUrl={geoRef.url}
          equipoCodigo={geoRef.codigo}
          equipoId={equipos.find(e => 'Equipo ' + e.codigo === geoRef.codigo)?.id || ""}
          initialCenter={[-35.14, -71.62]}
          saved={savedGeo}
           onCreateTuberia={async (data) => {
            const eq = equipos.find(e => 'Equipo ' + e.codigo === geoRef.codigo);
            if (!eq) return;
            const insertData: any = {
              codigo: data.codigo,
              equipo_id: eq.id,
              nivel: data.nivel,
              material: data.material,
              diametro_mm: data.diametro_mm,
              geometria: { type: "LineString", coordinates: data.puntos.map(p => [p.lng, p.lat]) },
            };
            if (data.nombre) insertData.nombre = data.nombre;
            const { error } = await supabase.from('tuberias').insert(insertData);
            if (error) alert("Error: " + error.message);
          }}
          onCreateValvula={async (data) => {
            const insertData: any = {
              codigo: data.codigo,
              tipo: data.tipo,
              diametro_mm: data.diametro_mm,
              geometria: { type: "Point", coordinates: [data.punto.lng, data.punto.lat] },
            };
            if (data.tuberia_id) insertData.tuberia_id = data.tuberia_id;
            const { error } = await supabase.from('valvulas').insert(insertData);
            if (error) alert("Error: " + error.message);
          }}
          onCreateAntena={async (data) => {
            const eq = equipos.find(e => 'Equipo ' + e.codigo === geoRef.codigo);
            if (!eq) return;
            const { error } = await supabase.from('antenas').insert({
              codigo: data.codigo,
              tipo: data.tipo,
              equipo_id: eq.id,
              geometria: { type: "Point", coordinates: [data.punto.lng, data.punto.lat] },
            });
            if (error) alert("Error: " + error.message);
          }}
          onCreateSonda={async (data) => {
            const eq = equipos.find(e => 'Equipo ' + e.codigo === geoRef.codigo);
            if (!eq) return;
            const { error } = await supabase.from('sondas').insert({
              codigo: data.codigo,
              tipo: data.tipo,
              profundidad_m: data.profundidad_m,
              equipo_id: eq.id,
              geometria: { type: "Point", coordinates: [data.punto.lng, data.punto.lat] },
            });
            if (error) alert("Error: " + error.message);
          }}
          onUpdateTuberia={async (id: string, data: any) => {
            const { error } = await supabase.from('tuberias').update(data).eq('id', id);
            if (error) alert('Error al actualizar tubería: ' + error.message);
          }}
          onUpdateValvula={async (id: string, data: any) => {
            const { error } = await supabase.from('valvulas').update(data).eq('id', id);
            if (error) alert('Error al actualizar válvula: ' + error.message);
          }}
          onUpdateAntena={async (id: string, data: any) => {
            const { error } = await supabase.from('antenas').update(data).eq('id', id);
            if (error) alert('Error al actualizar antena: ' + error.message);
          }}
          onUpdateSonda={async (id: string, data: any) => {
            const { error } = await supabase.from('sondas').update(data).eq('id', id);
            if (error) alert('Error al actualizar sonda: ' + error.message);
          }}
          onDeleteTuberia={async (id: string) => {
            if (!confirm('¿Eliminar esta tubería?')) return;
            const { error } = await supabase.from('tuberias').delete().eq('id', id);
            if (error) alert('Error al eliminar: ' + error.message);
          }}
          onDeleteValvula={async (id: string) => {
            if (!confirm('¿Eliminar esta válvula?')) return;
            const { error } = await supabase.from('valvulas').delete().eq('id', id);
            if (error) alert('Error al eliminar: ' + error.message);
          }}
          onDeleteAntena={async (id: string) => {
            if (!confirm('¿Eliminar esta antena?')) return;
            const { error } = await supabase.from('antenas').delete().eq('id', id);
            if (error) alert('Error al eliminar: ' + error.message);
          }}
          onDeleteSonda={async (id: string) => {
            if (!confirm('¿Eliminar esta sonda?')) return;
            const { error } = await supabase.from('sondas').delete().eq('id', id);
            if (error) alert('Error al eliminar: ' + error.message);
          }}
          onSave={async (data) => {
            const eq = equipos.find(e => 'Equipo ' + e.codigo === geoRef.codigo);
            if (!eq) return alert('Equipo no encontrado');
            const now = new Date().toISOString();
            const boundsValue: any = { center: data.center, map_zoom: data.mapZoom };
            if (data.sw) boundsValue.sw = data.sw;
            if (data.ne) boundsValue.ne = data.ne;
            const payload = { 
              equipo_id: eq.id, 
              bounds: boundsValue,
              zoom_level: data.zoom_level,
              rotation: data.rotation, 
              opacity: data.opacity,
              updated_at: now 
            };
            const { data: existing } = await supabase.from('georreferencias').select('id').eq('equipo_id', eq.id).single();
            let error;
            if (existing) {
              ({ error } = await supabase.from('georreferencias').update(payload).eq('equipo_id', eq.id));
            } else {
              ({ error } = await supabase.from('georreferencias').insert(payload));
            }
            if (error) alert('Error al guardar: ' + error.message);
            else { alert('Georreferencia guardada'); setGeoRef(null); }
          }}
          onClose={() => setGeoRef(null)}
        />
      )}
    </div>
  );
}

function FilaEquipo({ equipo, isAdmin, onEdit, onDelete, onViewPlano, onGeoref }: { equipo: Equipo; isAdmin: boolean; onEdit: () => void; onDelete: () => void; onViewPlano: (url: string, nombre: string) => void; onGeoref: (url: string, codigo: string) => Promise<void> }) {
  const [uploading, setUploading] = useState(false);
  const [deletingPlano, setDeletingPlano] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.name.endsWith('.pdf')) { alert('Solo se aceptan archivos PDF'); return; }
    setUploading(true);
    try {
      const path = `equipo_${equipo.codigo}.pdf`;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      if (!token) { alert('No hay sesión activa'); return; }
      const url = `https://nnelrvctqjbwfucccxfh.supabase.co/storage/v1/object/planos/${path}`;
      const resp = await fetch(url, { method: "POST", headers: { "apikey": token, "Authorization": "Bearer " + token, "Content-Type": "application/pdf" }, body: file });
      if (!resp.ok) { const t = await resp.text(); throw new Error(t.substring(0, 200)); }
      const { data: { publicUrl } } = supabase.storage.from('planos').getPublicUrl(path);
      const { error: updateErr } = await supabase.from('equipos').update({ plano_url: publicUrl }).eq('id', equipo.id);
      if (updateErr) throw updateErr;
      alert('Plano subido correctamente');
      window.location.reload();
    } catch (e: any) {
      alert('Error al subir plano: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePlano = async (eq: Equipo) => {
    if (!confirm('¿Eliminar plano de ' + eq.nombre + '?')) return;
    setDeletingPlano(eq.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      if (!token) { alert('No hay sesión activa'); return; }
      const path = `equipo_${eq.codigo}.pdf`;
      const url = `https://nnelrvctqjbwfucccxfh.supabase.co/storage/v1/object/planos/${path}`;
      await fetch(url, { method: "DELETE", headers: { "apikey": token, "Authorization": "Bearer " + token } });
      await supabase.from('equipos').update({ plano_url: null }).eq('id', eq.id);
      window.location.reload();
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setDeletingPlano(null); }
  };

  return (
    <tr key={equipo.id}>
      <td>{equipo.codigo}</td>
      <td>{equipo.nombre}</td>
      <td>{equipo.descripcion}</td>
      <td>
        {equipo.plano_url ? (
          <span>
            <a href="#" onClick={e => { e.preventDefault(); onViewPlano(equipo.plano_url!, equipo.codigo + ' - ' + equipo.nombre); }} style={{ color: "#1565c0", fontWeight: 500, marginRight: 8, cursor: "pointer" }}>Ver Plano</a>
            {isAdmin && <a href="#" onClick={e => { e.preventDefault(); onGeoref(equipo.plano_url!, 'Equipo ' + equipo.codigo); }} style={{ ...btnSmStyle, fontSize: 11, marginRight: 4, textDecoration: "none", color: "#2e7d32" }}>Georreferenciar</a>}
            <a href={equipo.plano_url} download style={{ ...btnSmStyle, textDecoration: "none", fontSize: 11, marginRight: 4 }}>Descargar</a>
            {isAdmin && <button onClick={() => handleDeletePlano(equipo)} disabled={deletingPlano === equipo.id} style={{ ...btnSmStyle, color: "#c62828", fontWeight: 600 }}>Eliminar</button>}
          </span>
        ) : <span style={{ color: "#999", fontSize: 12 }}>--</span>}
        {isAdmin && <>
          <input type="file" accept=".pdf" ref={fileRef} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...btnSmStyle, fontSize: 11 }}>{uploading ? 'Subiendo...' : 'Subir PDF'}</button>
        </>}
      </td>
      <td>
        {isAdmin && <><button onClick={onEdit} style={btnSmStyle}>Editar</button>{" "}
        <button onClick={onDelete} style={{ ...btnSmStyle, color: "#c62828" }}>Eliminar</button></>}
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
