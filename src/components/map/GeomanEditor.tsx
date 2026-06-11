import React, { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";

interface Props {
  initialGeoJSON?: GeoJSON.Feature | null;
  table?: "cuarteles" | "sectores" | "cuartel_sector";
  entityId?: string;
  where?: string;
  readOnly?: boolean;
  onClose?: () => void;
  showContext?: boolean;
  onToggleContext?: () => void;
  satelite?: boolean;
  onToggleSatelite?: () => void;
}

export default function GeomanEditor({ initialGeoJSON, table, entityId, where, readOnly = false, onClose, showContext, onToggleContext, satelite, onToggleSatelite }: Props) {
  const map = useMap();
  const setupDone = useRef(false);
  const [saving, setSaving] = useState(false);
  // Track explicit polygon layers for saving (bypass all filters)
  const polyLayersRef = useRef<Set<any>>(new Set());
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

      pm.setGlobalOptions({ snappable: false });

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
        console.log("INIT initialGeoJSON type:", initialGeoJSON.geometry.type, "| coords:", JSON.stringify((initialGeoJSON.geometry as any).coordinates).substring(0, 200));
        let count = 0;
        layer.eachLayer((l: any) => {
          l.addTo(map);
          polyLayersRef.current.add(l);
          if (!readOnly) l.pm.enable();
          count++;
        });
        console.log("INIT: L.geoJSON created", count, "layers, polyLayersRef now:", polyLayersRef.current.size);
        if (layer.getBounds().isValid()) {
          map.fitBounds(layer.getBounds().pad(0.2));
        }
        // Store the initial geometry
        currentGeoRef.current = initialGeoJSON;
      }

      // Track Geoman updates - extract coordinates from the leaf layer
      map.on("pm:create", (e: any) => {
        polyLayersRef.current.add(e.layer);
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
    const allFeatures: GeoJSON.Feature[] = [];
    polyLayersRef.current.forEach((l: any) => {
      const geo = extractCoordsFromLayer(l);
      if (geo) {
        allFeatures.push(geo);
        const first = JSON.stringify((geo.geometry as any).coordinates).substring(0, 100);
        console.log("FEATURE coord sample:", first);
      }
    });
    console.log("Poly layers tracked:", polyLayersRef.current.size, "| features:", allFeatures.length);
    
    // Check for Z in every coordinate of every feature
    function findZ(c: any, path: string): boolean {
      if (Array.isArray(c) && c.length > 0 && typeof c[0] === 'number' && c.length > 2) {
        console.log("⚠️ Z at", path, ":", c);
        return true;
      }
      if (Array.isArray(c)) return c.some((x, i) => findZ(x, path + '[' + i + ']'));
      return false;
    }
    allFeatures.forEach((f, i) => findZ((f.geometry as any).coordinates, 'f' + i));

    if (allFeatures.length > 0) {
      // Check every coordinate for Z
      function checkZ(c: any, depth: number): void {
        if (Array.isArray(c) && c.length > 0 && typeof c[0] === 'number') {
          if (c.length > 2) console.log("⚠️ Z FOUND at depth", depth, ":", c);
        } else if (Array.isArray(c)) c.forEach((x: any) => checkZ(x, depth + 1));
      }
      allFeatures.forEach((f) => checkZ((f.geometry as any)?.coordinates, 0));
      if (allFeatures.length > 1) {
        const mp = { type: "MultiPolygon", coordinates: allFeatures.map(f => (f.geometry as any).coordinates as any) };
        console.log("MultiPolygon (first 400):", JSON.stringify(mp).substring(0, 400));
      }
    }

    if (allFeatures.length === 0) {
      if (initialGeoJSON?.geometry) { console.log("FALLBACK to initialGeoJSON"); await doSave(initialGeoJSON); return; }
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
        headers: {
          "Content-Type": "application/json",
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk",
        },
        body: JSON.stringify({ geometria: geometry }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text.substring(0, 300)}`);
      }
      alert("Poligono guardado correctamente");
      onClose?.();
    } catch (e: any) {
      alert("Error: " + (e?.message || String(e)));
    } finally { setSaving(false); }
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ top: 150, pointerEvents: "auto" as any }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {onToggleSatelite && (
          <button onClick={onToggleSatelite} style={{
            ...floatingBtn,
            background: satelite ? "#1565c0" : "white",
            color: satelite ? "white" : "#333",
          }}>
            Satélite {satelite ? "ON" : "OFF"}
          </button>
        )}
        {onToggleContext && (
          <button onClick={onToggleContext} style={{
            ...floatingBtn,
            background: showContext ? "#ef6c00" : "white",
            color: showContext ? "white" : "#333",
          }}>
            Aledaños {showContext ? "ON" : "OFF"}
          </button>
        )}
        {onClose && (
          <button onClick={onClose} style={{ ...floatingBtn, background: "white", color: "#333" }}>
            Cancelar
          </button>
        )}
        <button onClick={handleSave} disabled={saving}
          style={{ ...floatingBtn, background: saving ? "#ccc" : "#1565c0", color: "#fff", fontWeight: 600 }}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

const floatingBtn: React.CSSProperties = {
  padding: "6px 12px", border: "1px solid #ccc", borderRadius: 4,
  cursor: "pointer", fontSize: 11,
};

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
