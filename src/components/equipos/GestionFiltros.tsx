import { useState } from "react";
import { useFiltros } from "../../hooks/useFiltros";
import { Filtro } from "../../lib/types";

interface Props {
  equipoId: string;
  equipoNombre: string;
  onClose: () => void;
}

type Draft = Partial<Filtro>;

export default function GestionFiltros({ equipoId, equipoNombre, onClose }: Props) {
  const { filtros, loading, createFiltro, updateFiltro, deleteFiltro } = useFiltros(equipoId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const nueva = () => setDraft({ tipo: "", marca: "", modelo: "", valvulas_retrolavado: "", cantidad_cuerpos: null, controlador_retrolavado: "", alimentacion_controlador: "" });
  const editar = (f: Filtro) => setDraft({ ...f });

  const guardar = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = {
        equipo_id: equipoId,
        tipo: draft.tipo || null,
        marca: draft.marca || null,
        modelo: draft.modelo || null,
        valvulas_retrolavado: draft.valvulas_retrolavado || null,
        cantidad_cuerpos: draft.cantidad_cuerpos ?? null,
        controlador_retrolavado: draft.controlador_retrolavado || null,
        alimentacion_controlador: draft.alimentacion_controlador || null,
      };
      if (draft.id) await updateFiltro(draft.id, payload);
      else await createFiltro(payload as Omit<Filtro, "id" | "created_at">);
      setDraft(null);
    } catch (e) {
      alert("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Filtros · {equipoNombre}</h3>
          <button onClick={onClose} style={btnClose} aria-label="Cerrar">✕</button>
        </div>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 14px" }}>
          Filtros de riego del equipo. Cada filtro puede asignarse a uno o más sectores.
        </p>

        {loading ? <p>Cargando…</p> : (
          <table style={tabla}>
            <thead>
              <tr>
                <th style={th}>Tipo</th><th style={th}>Marca</th><th style={th}>Modelo</th>
                <th style={th}>V. Retrolavado</th><th style={th}>Cuerpos</th>
                <th style={th}>Controlador</th><th style={th}>Aliment.</th>
                <th style={th}></th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtros.map((f) => (
                <tr key={f.id}>
                  <td style={td}>{f.tipo ?? "—"}</td>
                  <td style={td}>{f.marca ?? "—"}</td>
                  <td style={td}>{f.modelo ?? "—"}</td>
                  <td style={td}>{f.valvulas_retrolavado ?? "—"}</td>
                  <td style={td}>{f.cantidad_cuerpos ?? "—"}</td>
                  <td style={td}>{f.controlador_retrolavado ?? "—"}</td>
                  <td style={td}>{f.alimentacion_controlador ?? "—"}</td>
                  <td style={td}><button onClick={() => editar(f)} style={btnSm}>Editar</button></td>
                  <td style={td}><button onClick={() => { if (confirm("¿Eliminar este filtro?")) deleteFiltro(f.id); }} style={{ ...btnSm, color: "#c62828" }}>✕</button></td>
                </tr>
              ))}
              {filtros.length === 0 && <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#999" }}>Sin filtros cargados.</td></tr>}
            </tbody>
          </table>
        )}

        {!draft && <button onClick={nueva} style={btnPrimary}>+ Agregar filtro</button>}

        {draft && (
          <div style={editor}>
            <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>{draft.id ? "Editar filtro" : "Nuevo filtro"}</h4>
            <div style={grid}>
              <label style={lbl}>Tipo<select style={inp} value={draft.tipo ?? ""} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}>
                <option value="">Seleccionar...</option>
                <option value="Spin Klin">Spin Klin</option>
                <option value="Azud">Azud</option>
                <option value="Grava">Grava</option>
                <option value="Amiad">Amiad</option>
                <option value="Otro">Otro</option>
              </select></label>
              <label style={lbl}>Marca<input style={inp} value={draft.marca ?? ""} onChange={(e) => setDraft({ ...draft, marca: e.target.value })} placeholder="Spin Klin, Azud…" /></label>
              <label style={lbl}>Modelo<input style={inp} value={draft.modelo ?? ""} onChange={(e) => setDraft({ ...draft, modelo: e.target.value })} placeholder="3x6, 309/6 FX…" /></label>
              <label style={lbl}>Válvulas Retrolavado<input style={inp} value={draft.valvulas_retrolavado ?? ""} onChange={(e) => setDraft({ ...draft, valvulas_retrolavado: e.target.value })} /></label>
              <label style={lbl}>Cuerpos<input style={inp} type="number" value={draft.cantidad_cuerpos ?? ""} onChange={(e) => setDraft({ ...draft, cantidad_cuerpos: e.target.value ? Number(e.target.value) : null })} /></label>
              <label style={lbl}>Controlador Retrolavado<input style={inp} value={draft.controlador_retrolavado ?? ""} onChange={(e) => setDraft({ ...draft, controlador_retrolavado: e.target.value })} /></label>
              <label style={lbl}>Alimentación Controlador<input style={inp} value={draft.alimentacion_controlador ?? ""} onChange={(e) => setDraft({ ...draft, alimentacion_controlador: e.target.value })} /></label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setDraft(null)} style={btnCancel}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={btnPrimary}>{saving ? "Guardando…" : "Guardar filtro"}</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={btnCancel}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2100 };
const modal: React.CSSProperties = { background: "#fff", padding: 24, borderRadius: 8, width: 800, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" };
const tabla: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "2px solid #eee", fontSize: 11, color: "#666", fontWeight: 600 };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f0f0f0" };
const editor: React.CSSProperties = { marginTop: 14, padding: 16, background: "#f7f7f4", borderRadius: 8 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#555" };
const inp: React.CSSProperties = { padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: "7px 14px", background: "#1565c0", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500, fontSize: 13 };
const btnCancel: React.CSSProperties = { padding: "7px 14px", background: "#f0f0f0", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer", fontSize: 13 };
const btnSm: React.CSSProperties = { padding: "3px 9px", background: "none", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnClose: React.CSSProperties = { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#888" };
