import { useState, useRef, useEffect } from "react";
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
  const geoRef = useRef<Feature | null>(geojson || null);

  const initialCenter: [number, number] = (() => {
    const geometry = geojson?.geometry;
    if (!geometry) return [-35.14, -71.625];
    let coords: number[][] = [];
    if (geometry.type === "Polygon") {
      coords = (geometry as any).coordinates[0] || [];
    } else if (geometry.type === "MultiPolygon") {
      const polys = (geometry as any).coordinates[0] || [];
      coords = polys.flat() as number[][];
    }
    if (!coords.length) return [-35.14, -71.625];
    const lats = coords.map((c: number[]) => c[1]);
    const lngs = coords.map((c: number[]) => c[0]);
    return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
  })();

  const handleSave = async () => {
    if (!geoRef.current) { alert("No hay geometria para guardar"); return; }
    setSaving(true);
    try {
      await onSave(geoRef.current);
    } catch(e: any) {
      console.error("Error al guardar:", e);
      alert("Error al guardar: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ marginTop: 0 }}>Editor de Poligono</h3>
        <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>
          Arrastra vertices para modificar. Usa los controles de la barra superior para agregar/quitar puntos.
        </p>
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
            <EditorSetup geojson={geojson} geoRef={geoRef} />
          </MapContainer>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={btnCancel}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={btnSave}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditorSetup({ geojson, geoRef }: { geojson: Feature | null; geoRef: React.MutableRefObject<Feature | null> }) {
  const map = useMap();

  useEffect(() => {
    map.pm.addControls({
      position: "topleft",
      drawCircle: false, drawCircleMarker: false, drawRectangle: false,
      drawPolyline: false, drawMarker: false, drawText: false,
      cutPolygon: false, rotateMode: false,
      dragMode: true, editMode: true, removalMode: true,
    });

    if (geojson?.geometry) {
      const layer = L.geoJSON(geojson as any);
      layer.eachLayer((l: L.Layer) => {
        l.addTo(map);
        (l as any).pm.enable();
      });
      map.fitBounds(layer.getBounds().pad(0.3));
      // Store the ORIGINAL geojson (not L.geoJSON output)
      geoRef.current = geojson;
    }

    map.on("pm:update", (e: any) => {
      console.log("pm:update fired");
      const latlngs = e.layer.getLatLngs();
      const coords = (latlngs as any[]).map((ring: any[]) =>
        ring.map((ll: { lng: number; lat: number }) => [ll.lng, ll.lat])
      );
      geoRef.current = {
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: coords },
        properties: {},
      };
      console.log("geoRef actualizado, primer punto:", coords[0]?.[0]);
    });
    map.on("pm:create", (e: any) => {
      const latlngs = e.layer.getLatLngs();
      const coords = (latlngs as any[]).map((ring: any[]) =>
        ring.map((ll: { lng: number; lat: number }) => [ll.lng, ll.lat])
      );
      geoRef.current = {
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: coords },
        properties: {},
      };
    });

    return () => {
      map.pm.removeControls();
      map.off("pm:update");
      map.off("pm:create");
    };
  }, [map, geojson, geoRef]);

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
