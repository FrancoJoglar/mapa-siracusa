import { useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet/dist/leaflet.css";
import type { Feature } from "geojson";
import { supabase } from "../../lib/supabase";
import GeomanEditor from "../map/GeomanEditor";
import { useGeometryStore } from "../../store/editorStore";

interface Props {
  geojson: Feature | null;
  table: "cuarteles" | "sectores";
  entityId: string;
  onCancel: () => void;
}

export default function EditorGeometria({ geojson, table, entityId, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const { geojson: editedGeo, isValid, errors, reset } = useGeometryStore();

  const initialCenter: [number, number] = (() => {
    const g = (geojson as any)?.geometry || geojson;
    if (!g?.coordinates) return [-35.14, -71.625];
    let coords: number[][] = [];
    if (g.type === "Polygon") coords = g.coordinates[0] || [];
    else if (g.type === "MultiPolygon") coords = (g.coordinates[0] || []).flat() as number[][];
    if (!coords.length) return [-35.14, -71.625];
    const lats = coords.map((c: number[]) => c[1]);
    const lngs = coords.map((c: number[]) => c[0]);
    return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
  })();

  const handleSave = async () => {
    const toSave = editedGeo || geojson;
    if (!toSave) { alert("No hay geometria para guardar"); return; }
    const geometry = (toSave as any).geometry || toSave;
    if (!geometry?.type || !geometry?.coordinates) { alert("Geometria invalida"); return; }

    setSaving(true);
    try {
      console.log("SAVING geometry for", table, entityId);
      const { error: err } = await (supabase as any)
        .from(table)
        .update({ geometria: geometry })
        .eq("id", entityId);
      if (err) {
        console.error("SUPABASE ERROR:", err);
        throw new Error(JSON.stringify(err));
      }
      reset();
      alert("Poligono guardado. Recargando...");
      window.location.reload();
    } catch (e: any) {
      console.error("SAVE ERROR:", e);
      alert("Error: " + (e?.message || String(e)));
      setSaving(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ marginTop: 0 }}>Editor de Poligono</h3>
        {errors.length > 0 && (
          <div style={{ background: "#fce4ec", padding: "6px 12px", borderRadius: 4, marginBottom: 8, fontSize: 12 }}>
            {errors.map((e, i) => <div key={i} style={{ color: "#c62828" }}>{e}</div>)}
          </div>
        )}
        <div style={{ height: 440, marginBottom: 12 }}>
          <MapContainer
            center={initialCenter}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; OSM'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            <GeomanEditor initialGeoJSON={geojson} />
          </MapContainer>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => { reset(); onCancel(); }} style={btnCancel}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !isValid} style={btnSave}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex", justifyContent: "center", alignItems: "center", zIndex: 3000,
};
const modal: React.CSSProperties = {
  background: "#fff", padding: 20, borderRadius: 8, width: 750, maxWidth: "95vw",
};
const btnCancel: React.CSSProperties = {
  padding: "8px 16px", border: "1px solid #ccc", borderRadius: 4,
  background: "#f5f5f5", cursor: "pointer", fontSize: 13,
};
const btnSave: React.CSSProperties = {
  padding: "8px 16px", background: "#1565c0", color: "#fff",
  border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 500, fontSize: 13,
};
