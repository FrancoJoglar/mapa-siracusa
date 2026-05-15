import { useState, useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet/dist/leaflet.css";
import type { Feature } from "geojson";
import L from "leaflet";

interface Props {
  geojson: Feature | null;
  onSave: (geojson: Feature) => Promise<void>;
  onCancel: () => void;
}

export default function EditorGeometria({ geojson, onSave, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [editedGeo, setEditedGeo] = useState<Feature | null>(null);

  const initialCenter: [number, number] = (() => {
    const geometry = geojson?.geometry || (geojson as any);
    if (!geometry?.coordinates) return [-35.14, -71.625];
    let coords: number[][] = [];
    if (geometry.type === "Polygon") {
      coords = geometry.coordinates[0] || [];
    } else if (geometry.type === "MultiPolygon") {
      coords = (geometry.coordinates[0] || []).flat() as number[][];
    }
    if (!coords.length) return [-35.14, -71.625];
    const lats = coords.map((c: number[]) => c[1]);
    const lngs = coords.map((c: number[]) => c[0]);
    return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
  })();

  const handleSave = async () => {
    const toSave = editedGeo || geojson;
    if (!toSave) { alert("No hay geometria para guardar"); return; }
    setSaving(true);
    try {
      await onSave(toSave);
      alert("Geometria guardada correctamente");
    } catch (e: any) {
      alert("Error al guardar: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ marginTop: 0 }}>Editor de Poligono</h3>
        <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>
          Arrastra vertices para modificar.
        </p>
        {!ready && <p style={{ color: "#999", fontSize: 12 }}>Cargando editor...</p>}
        <div style={{ height: 440, marginBottom: 12, display: ready ? "block" : "none" }}>
          <MapContainer
            center={initialCenter}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; OSM'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            <EditorSetup
              geojson={geojson}
              onReady={() => setReady(true)}
              onEdit={(geo) => setEditedGeo(geo)}
            />
          </MapContainer>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={btnCancel}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !ready} style={btnSave}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditorSetup({ geojson, onReady, onEdit }: {
  geojson: Feature | null;
  onReady: () => void;
  onEdit: (geo: Feature) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const setup = () => {
      (map as any).pm.addControls({
        position: "topleft",
        drawCircle: false, drawCircleMarker: false, drawRectangle: false,
        drawPolyline: false, drawMarker: false, drawText: false,
        cutPolygon: false, rotateMode: false,
        dragMode: true, editMode: true, removalMode: true,
      });

      if (geojson) {
        const layer = L.geoJSON(geojson as any);
        layer.eachLayer((l: any) => {
          l.addTo(map);
          l.pm.enable();
        });
        map.fitBounds(layer.getBounds().pad(0.3));
        
        // Store initial geometry as Feature
        onEdit(geojson);
      }

      map.on("pm:update", (e: any) => {
        const latlngs = e.layer.getLatLngs();
        const coords = (latlngs as any[]).map((ring: any[]) =>
          ring.map((ll: any) => [ll.lng, ll.lat])
        );
        const geo: Feature = {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: coords },
          properties: {},
        };
        onEdit(geo);
      });

      map.on("pm:create", (e: any) => {
        const latlngs = e.layer.getLatLngs();
        const coords = (latlngs as any[]).map((ring: any[]) =>
          ring.map((ll: any) => [ll.lng, ll.lat])
        );
        const geo: Feature = {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: coords },
          properties: {},
        };
        onEdit(geo);
      });

      onReady();
    };

    // Small delay to ensure map is fully initialized
    const t = setTimeout(setup, 500);
    return () => {
      clearTimeout(t);
      try { (map as any).pm.removeControls(); } catch {}
    };
  }, []); // Run once on mount

  return null;
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
