import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
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
  const [contextFeatures, setContextFeatures] = useState<Feature[]>([]);
  const [showContext, setShowContext] = useState(true);
  const [satelite, setSatelite] = useState(true);

  useEffect(() => {
    if (geojson) {
      setResolvedGeo(geojson);
      return;
    }
    setFetching(true);
    (async () => {
      try {
        if (table === "cuartel_sector" && where) {
          const params: Record<string, string> = {};
          where.split("&").forEach(p => {
            const [k, v] = p.split("=eq.");
            if (k && v) params[k] = v;
          });
          const { data, error } = await supabase
            .from(table)
            .select("geometria")
            .match(params)
            .single();
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

  // Fetch context layers (neighboring polygons)
  useEffect(() => {
    const fetchContext = async () => {
      try {
        let features: Feature[] = [];
        if (table === "cuarteles") {
          const { data } = await supabase
            .from("cuarteles")
            .select("id, geometria")
            .not("geometria", "is", null);
          if (data) {
            features = data
              .filter((r: any) => r.id !== entityId)
              .map((r: any) => ({ type: "Feature", geometry: r.geometria, properties: {} }));
          }
        } else if (table === "sectores") {
          const { data } = await supabase
            .from("sectores")
            .select("id, geometria")
            .not("geometria", "is", null);
          if (data) {
            features = data
              .filter((r: any) => r.id !== entityId)
              .map((r: any) => ({ type: "Feature", geometry: r.geometria, properties: {} }));
          }
        } else if (table === "cuartel_sector") {
          const { data } = await supabase.rpc("get_unidades_riego_geojson");
          if (data) {
            features = data
              .filter((r: any) => r.geojson)
              .map((r: any) => ({ type: "Feature", geometry: r.geojson, properties: {} }));
          }
        }
        setContextFeatures(features);
      } catch (e) {
        console.error("Error fetching context layers:", e);
      }
    };
    fetchContext();
  }, [table, entityId]);

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
              key={satelite ? "sat-editor" : "osm-editor"}
              attribution={
                satelite
                  ? '&copy; Esri'
                  : '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              }
              url={satelite
                ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              }
            />
            <ContextLayers features={contextFeatures} visible={showContext} />

            {!fetching && (
              <GeomanEditor
                initialGeoJSON={initialGeo}
                table={table}
                entityId={entityId}
                where={where}
                onClose={onCancel}
                showContext={showContext}
                onToggleContext={() => setShowContext(v => !v)}
                satelite={satelite}
                onToggleSatelite={() => setSatelite(v => !v)}
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

function ContextLayers({ features, visible }: { features: Feature[]; visible: boolean }) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!features.length) return;
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (visible) {
      layerRef.current = L.geoJSON({ type: "FeatureCollection", features } as any, {
        style: { color: "#888", weight: 0.5, fill: false, opacity: 0.6 },
        onEachFeature: (_f, layer) => {
          (layer as any).options.interactive = false;
          if ((layer as any)._path) (layer as any)._path.style.pointerEvents = "none";
        },
      }).addTo(map);
    }
  }, [features, visible, map]);

  useEffect(() => {
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map]);

  return null;
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex", justifyContent: "center", alignItems: "center", zIndex: 3000,
};
const modal: React.CSSProperties = {
  background: "#fff", padding: 20, borderRadius: 8, width: 750, maxWidth: "95vw",
};
