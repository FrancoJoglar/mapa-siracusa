import { useState, useRef } from "react";
import { useEquipos } from "../hooks/useEquipos";
import { Equipo } from "../lib/types";
import FormularioEquipo from "../components/equipos/FormularioEquipo";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function AdminEquipos() {
  const { isAdmin } = useAuth();
  const { equipos, loading, error, createEquipo, updateEquipo, deleteEquipo } =
    useEquipos();
  const [editing, setEditing] = useState<Equipo | null>(null);
  const [showForm, setShowForm] = useState(false);

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
            <FilaEquipo key={e.id} equipo={e} isAdmin={isAdmin} onEdit={() => { setEditing(e); setShowForm(true); }} onDelete={() => { if (confirm(`¿Eliminar ${e.nombre}?`)) deleteEquipo(e.id); }} />
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
    </div>
  );
}

function FilaEquipo({ equipo, isAdmin, onEdit, onDelete }: { equipo: Equipo; isAdmin: boolean; onEdit: () => void; onDelete: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [deletingPlano, setDeletingPlano] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.name.endsWith('.pdf')) { alert('Solo se aceptan archivos PDF'); return; }
    setUploading(true);
    try {
      const path = `equipo_${equipo.codigo}.pdf`;
      const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk";
      const url = `https://nnelrvctqjbwfucccxfh.supabase.co/storage/v1/object/planos/${path}`;
      const resp = await fetch(url, { method: "PUT", headers: { "apikey": ANON_KEY, "Authorization": "Bearer " + ANON_KEY, "Content-Type": "application/pdf" }, body: file });
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
      const path = `equipo_${eq.codigo}.pdf`;
      await supabase.storage.from('planos').remove([path]);
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
            <a href={equipo.plano_url} target="_blank" rel="noopener" style={{ color: "#1565c0", fontWeight: 500, marginRight: 8 }}>Ver Plano</a>
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
