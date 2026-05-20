import { useState, useEffect } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet/dist/leaflet.css";
import type { Feature } from "geojson";
import GeomanEditor from "../map/GeomanEditor";

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk";

interface Props {
  geojson: Feature | null;
  table: "cuarteles" | "sectores";
  entityId: string;
  onCancel: () => void;
}

export default function EditorGeometria({ geojson, table, entityId, onCancel }: Props) {
  const [resolvedGeo, setResolvedGeo] = useState<Feature | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (geojson) {
      setResolvedGeo(geojson);
      return;
    }
    setFetching(true);
    fetch(
      `https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/${table}?id=eq.${entityId}&select=geometria`,
      { headers: { "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}` } }
    )
      .then(r => r.json())
      .then(data => {
        if (data?.length > 0 && data[0]?.geometria) {
          setResolvedGeo({ type: "Feature", geometry: data[0].geometria, properties: {} });
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [geojson, table, entityId]);

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
              attribution='&copy; OSM'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            {!fetching && (
              <GeomanEditor
                initialGeoJSON={initialGeo}
                table={table}
                entityId={entityId}
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
