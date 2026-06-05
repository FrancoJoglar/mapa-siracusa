import { useState, useEffect } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet/dist/leaflet.css";
import type { Feature } from "geojson";
import GeomanEditor from "../map/GeomanEditor";
import { supabase } from "../../lib/supabase";

interface Props {
  geojson: Feature | null;
  table: "cuarteles" | "sectores" | "cuartel_sector";
  entityId?: string;
  where?: string;
  onCancel: () => void;
}

export default function EditorGeometria({ geojson, table, entityId, where, onCancel }: Props) {
  const [resolvedGeo, setResolvedGeo] = useState<Feature | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (geojson) {
      setResolvedGeo(geojson);
      return;
    }
    setFetching(true);
    (async () => {
      try {
        if (table === "cuartel_sector" && where) {
          const params = Object.fromEntries(where.split("&").map(p => {
            const [k, v] = p.split("=eq.");
            return [k, v];
          }));
          let q = supabase.from(table).select("geometria");
          for (const [col, val] of Object.entries(params)) {
            q = q.eq(col as any, val);
          }
          const { data, error } = await q.single();
          if (!error && data?.geometria) {
            setResolvedGeo({ type: "Feature", geometry: data.geometria, properties: {} });
          }
        } else if (entityId) {
          const { data, error } = await supabase
            .from(table)
            .select("geometria")
            .eq("id", entityId)
            .single();
          if (!error && data?.geometria) {
            setResolvedGeo({ type: "Feature", geometry: data.geometria, properties: {} });
          }
        }
      } catch {}
      finally { setFetching(false); }
    })();
  }, [geojson, table, entityId, where]);

  const initialGeo = resolvedGeo;

  const initialCenter: [number, number] = (() => {
    const g = (initialGeo as any)?.geometry || initialGeo;
    if (!g?.coordinates) return [-35.14, -71.625];
    let coords: number[][] = [];
    if (g.type === "Polygon") coords = g.coordinates[0] || [];
    else if (g.type === "MultiPolygon") coords = (g.coordinates[0] || []).flat() as number[][];
    if (!coords.length) return [-35.14, -71.625];
    const lats = coords.map((c: number[]) => c[1]);
    const lngs = coords.map((c: number[]) => c[0]);
    return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
  })();

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ marginTop: 0 }}>Editor de Poligono</h3>
        {fetching && <p style={{ color: "#999", fontSize: 12, margin: "0 0 8px" }}>Cargando geometria...</p>}
        <div style={{ height: 440 }}>
          <MapContainer
            center={initialCenter}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            {!fetching && (
              <GeomanEditor
                initialGeoJSON={initialGeo}
                table={table}
                entityId={entityId}
                where={where}
                onClose={onCancel}
              />
            )}
          </MapContainer>
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
