import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk";

interface Props {
  initialGeoJSON?: GeoJSON.Feature | null;
  table?: "cuarteles" | "sectores" | "cuartel_sector";
  entityId?: string;
  where?: string;
  readOnly?: boolean;
  onClose?: () => void;
}

export default function GeomanEditor({ initialGeoJSON, table, entityId, where, readOnly = false, onClose }: Props) {
  const map = useMap();
  const setupDone = useRef(false);
  const [saving, setSaving] = useState(false);
  // Store the current GeoJSON geometry (updated by pm:update/pm:create)
  const currentGeoRef = useRef<any>(null);

  useEffect(() => {
    if (setupDone.current) return;

    const init = () => {
      if (!(map as any)?.pm) {
        setupDone.current = false;
        requestAnimationFrame(init);
        return;
      }
      setupDone.current = true;
      const pm = (map as any).pm;

      pm.addControls({
        position: "topleft",
        drawCircle: false, drawCircleMarker: false, drawRectangle: false,
        drawPolyline: false, drawMarker: false, drawText: false,
        cutPolygon: false, rotateMode: false,
        drawPolygon: !readOnly,
        dragMode: !readOnly, editMode: !readOnly, removalMode: !readOnly,
      });

      if (initialGeoJSON?.geometry) {
        const layer = L.geoJSON(initialGeoJSON);
        layer.eachLayer((l: any) => {
          l.addTo(map);
          if (!readOnly) l.pm.enable();
        });
        if (layer.getBounds().isValid()) {
          map.fitBounds(layer.getBounds().pad(0.2));
        }
        // Store the initial geometry
        currentGeoRef.current = initialGeoJSON;
      }

      // Track Geoman updates - extract coordinates from the leaf layer
      map.on("pm:create", (e: any) => {
        const coords = extractCoordsFromLayer(e.layer);
        if (coords) currentGeoRef.current = coords;
      });
      map.on("pm:update", (e: any) => {
        const coords = extractCoordsFromLayer(e.layer);
        if (coords) currentGeoRef.current = coords;
      });
    };

    requestAnimationFrame(init);
    return () => {
      setupDone.current = false;
      try { (map as any)?.pm?.removeControls(); } catch {}
      map.off("pm:create");
      map.off("pm:update");
    };
  }, [map, initialGeoJSON, readOnly]);

  const handleSave = async () => {
    // Extract ALL polygon layers currently on the map (the most reliable way)
    const allFeatures: GeoJSON.Feature[] = [];
    map.eachLayer((l: any) => {
      if (!l.getLatLngs || l._url) return; // skip tiles
      const geo = extractCoordsFromLayer(l);
      if (geo) allFeatures.push(geo);
    });

    if (allFeatures.length === 0) {
      if (initialGeoJSON?.geometry) { await doSave(initialGeoJSON); return; }
      alert("No hay poligono para guardar");
      return;
    }

    // Merge multiple polygons into one Feature
    const feature: GeoJSON.Feature = allFeatures.length === 1
      ? allFeatures[0]
      : {
          type: "Feature",
          geometry: {
            type: "MultiPolygon",
            coordinates: allFeatures.map(f => (f.geometry as any).coordinates as any),
          } as any,
          properties: {},
        };
    await doSave(feature);
  };

  const doSave = async (feature: GeoJSON.Feature) => {
    if (!table) { alert("Faltan datos de guardado"); return; }
    if (!entityId && !where) { alert("Falta identificador del poligono"); return; }
    const geometry = (feature as any)?.geometry || feature;
    if (!geometry?.type || !geometry?.coordinates) { alert("Geometria invalida"); return; }

    const url = where
      ? `https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/${table}?${where}`
      : `https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/${table}?id=eq.${entityId}`;
    setSaving(true);
    try {
      const resp = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ geometria: geometry }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      alert("Poligono guardado correctamente");
      onClose?.();
    } catch (e: any) {
      alert("Error: " + (e?.message || String(e)));
    } finally { setSaving(false); }
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ top: 150, pointerEvents: "auto" as any }}>
      <button onClick={handleSave} disabled={saving}
        style={{ padding: "8px 16px", background: saving ? "#ccc" : "#1565c0", color: "#fff",
          border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

// Extract coordinates from a Geoman-edited layer
function extractCoordsFromLayer(layer: any): GeoJSON.Feature | null {
  try {
    const latlngs = layer.getLatLngs();
    // Leaflet Polygon.getLatLngs() returns [[LatLng, LatLng, ...]] for a single polygon
    // or [[[LatLng, LatLng, ...]]] for a MultiPolygon
    const rings: number[][][] = [];

    if (!latlngs || !latlngs[0]) return null;

    // Try to detect structure: [ [LatLng, LatLng], ... ] (single polygon)
    if (typeof latlngs[0].lat === "number") {
      rings.push(latlngs.map((ll: any) => [ll.lng, ll.lat]));
    }
    // Try: [ [ [LatLng, LatLng], ... ] ] (MultiPolygon)
    else if (Array.isArray(latlngs[0])) {
      for (const ring of latlngs) {
        if (ring && ring.length && typeof ring[0]?.lat === "number") {
          rings.push(ring.map((ll: any) => [ll.lng, ll.lat]));
        }
        // Nested further: [ [ [ [LatLng, LatLng], ... ] ] ]
        else if (Array.isArray(ring[0])) {
          for (const subring of ring) {
            if (subring && subring.length && typeof subring[0]?.lat === "number") {
              rings.push(subring.map((ll: any) => [ll.lng, ll.lat]));
            }
          }
        }
      }
    }

    if (rings.length === 0 || rings[0].length < 3) return null;

    const geometry = rings.length === 1
      ? { type: "Polygon" as const, coordinates: [rings[0]] }
      : { type: "MultiPolygon" as const, coordinates: rings.map((r: number[][]) => [r]) };

    return { type: "Feature", geometry: geometry as any, properties: {} };
  } catch { return null; }
}
