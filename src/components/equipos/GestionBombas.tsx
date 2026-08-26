import { useState } from "react";
import { useBombas } from "../../hooks/useBombas";
import { Bomba } from "../../lib/types";

interface Props {
  equipoId: string;
  equipoNombre: string;
  onClose: () => void;
}

type Draft = Partial<Bomba>;

export default function GestionBombas({ equipoId, equipoNombre, onClose }: Props) {
  const { bombas, loading, createBomba, updateBomba, deleteBomba } = useBombas(equipoId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const nueva = () => setDraft({ funcion: "riego", marca: "", modelo: "", potencia_hp: null, caudal_m3h: null, orden: (bombas.length + 1), rodamientos: null, sello_mecanico: null, modelo_motor: null, rodete: null, tension: null, presion: null });
  const editar = (b: Bomba) => setDraft({ ...b });

  const guardar = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = {
        equipo_id: equipoId,
        marca: draft.marca || null,
        modelo: draft.modelo || null,
        potencia_hp: draft.potencia_hp ?? null,
        caudal_m3h: draft.caudal_m3h ?? null,
        funcion: (draft.funcion as "riego" | "helada") || "riego",
        orden: draft.orden ?? null,
        revisar: false,
        rodamientos: draft.rodamientos || null,
        sello_mecanico: draft.sello_mecanico || null,
        modelo_motor: draft.modelo_motor || null,
        rodete: draft.rodete || null,
        tension: draft.tension || null,
        presion: draft.presion ?? null,
      };
      if (draft.id) await updateBomba(draft.id, payload);
      else await createBomba(payload as Omit<Bomba, "id" | "created_at">);
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
          <h3 style={{ margin: 0 }}>Bombas · {equipoNombre}</h3>
          <button onClick={onClose} style={btnClose} aria-label="Cerrar">✕</button>
        </div>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 14px" }}>
          Cada fila es una bomba física del equipo. Las marcadas <b style={{ color: "#a96a12" }}>revisar</b> se
          infirieron del texto y conviene verificarlas.
        </p>

        {loading ? <p>Cargando…</p> : (
          <table style={tabla}>
            <thead>
              <tr>
                <th style={th}>#</th><th style={th}>Marca</th><th style={th}>Modelo</th>
                <th style={th}>HP</th><th style={th}>Motor</th><th style={th}>Rodete</th>
                <th style={th}>Función</th><th style={th}></th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {bombas.map((b) => (
                <tr key={b.id} style={{ background: b.revisar ? "#fbf3e2" : undefined }}>
                  <td style={td}>{b.orden ?? ""}</td>
                  <td style={td}>{b.marca ?? "—"} {b.modelo ?? ""}</td>
                  <td style={td}>{b.modelo ?? "—"}</td>
                  <td style={td}>{b.potencia_hp ?? "—"}</td>
                  <td style={td}>{b.modelo_motor ?? "—"}</td>
                  <td style={td}>{b.rodete ?? "—"}</td>
                  <td style={td}>{b.funcion === "helada" ? "❄ Helada" : "Riego"}</td>
                  <td style={td}><button onClick={() => editar(b)} style={btnSm}>Editar</button></td>
                  <td style={td}><button onClick={() => { if (confirm("¿Eliminar esta bomba?")) deleteBomba(b.id); }} style={{ ...btnSm, color: "#c62828" }}>✕</button></td>
                </tr>
              ))}
              {bombas.length === 0 && <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#999" }}>Sin bombas cargadas.</td></tr>}
            </tbody>
          </table>
        )}

        {!draft && <button onClick={nueva} style={btnPrimary}>+ Agregar bomba</button>}

        {draft && (
          <div style={editor}>
            <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>{draft.id ? "Editar bomba" : "Nueva bomba"}</h4>
            <div style={grid}>
              <label style={lbl}>Marca<input style={inp} value={draft.marca ?? ""} onChange={(e) => setDraft({ ...draft, marca: e.target.value })} placeholder="Vogt, KSB…" /></label>
              <label style={lbl}>Modelo<input style={inp} value={draft.modelo ?? ""} onChange={(e) => setDraft({ ...draft, modelo: e.target.value })} /></label>
              <label style={lbl}>Potencia (HP)<input style={inp} type="number" step="0.1" value={draft.potencia_hp ?? ""} onChange={(e) => setDraft({ ...draft, potencia_hp: e.target.value ? Number(e.target.value) : null })} /></label>
              <label style={lbl}>Caudal (m³/h)<input style={inp} type="number" step="0.1" value={draft.caudal_m3h ?? ""} onChange={(e) => setDraft({ ...draft, caudal_m3h: e.target.value ? Number(e.target.value) : null })} /></label>
              <label style={lbl}>Función
                <select style={inp} value={draft.funcion ?? "riego"} onChange={(e) => setDraft({ ...draft, funcion: e.target.value as "riego" | "helada" | "impulsion" })}>
                  <option value="riego">Riego</option>
                  <option value="impulsion">Impulsión</option>
                  <option value="helada">Control de heladas</option>
                </select>
              </label>
              <label style={lbl}>Orden<input style={inp} type="number" value={draft.orden ?? ""} onChange={(e) => setDraft({ ...draft, orden: e.target.value ? Number(e.target.value) : null })} /></label>
              <label style={lbl}>Modelo Motor<input style={inp} value={draft.modelo_motor ?? ""} onChange={(e) => setDraft({ ...draft, modelo_motor: e.target.value })} /></label>
              <label style={lbl}>Rodete<input style={inp} value={draft.rodete ?? ""} onChange={(e) => setDraft({ ...draft, rodete: e.target.value })} /></label>
              <label style={lbl}>Tensión<input style={inp} value={draft.tension ?? ""} onChange={(e) => setDraft({ ...draft, tension: e.target.value })} placeholder="380V, 220V…" /></label>
              <label style={lbl}>Presión (bar)<input style={inp} type="number" step="0.1" value={draft.presion ?? ""} onChange={(e) => setDraft({ ...draft, presion: e.target.value ? Number(e.target.value) : null })} /></label>
              <label style={lbl}>Rodamientos<input style={inp} value={draft.rodamientos ?? ""} onChange={(e) => setDraft({ ...draft, rodamientos: e.target.value })} /></label>
              <label style={lbl}>Sello Mecánico<input style={inp} value={draft.sello_mecanico ?? ""} onChange={(e) => setDraft({ ...draft, sello_mecanico: e.target.value })} /></label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setDraft(null)} style={btnCancel}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={btnPrimary}>{saving ? "Guardando…" : "Guardar bomba"}</button>
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
const modal: React.CSSProperties = { background: "#fff", padding: 24, borderRadius: 8, width: 720, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" };
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
