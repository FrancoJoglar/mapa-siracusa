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
  const [deleteMode, setDeleteMode] = useState(false);
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

      pm.setGlobalOptions({ snappable: false, snapDistance: 0 });
      // Force snappable off on draw start (defensive)
      map.on("pm:drawstart", () => {
        pm.setGlobalOptions({ snappable: false, snapDistance: 0 });
      });

      pm.addControls({
        position: "topleft",
        drawCircle: false, drawCircleMarker: false, drawRectangle: false,
        drawPolyline: false, drawMarker: false, drawText: false,
        cutPolygon: false, rotateMode: false,
        drawPolygon: !readOnly,
        dragMode: !readOnly, editMode: !readOnly, removalMode: false,
      });

      if (initialGeoJSON?.geometry) {
        console.log("INIT initialGeoJSON type:", initialGeoJSON.geometry.type);
        // Create polygons manually from coordinates — no L.geoJSON FeatureGroup
        const allCoords: number[][][] = [];
        const raw = (initialGeoJSON.geometry as any).coordinates;
        if (initialGeoJSON.geometry.type === 'MultiPolygon') {
          raw.forEach((poly: any) => allCoords.push(poly[0]));
        } else if (initialGeoJSON.geometry.type === 'Polygon') {
          allCoords.push(raw[0]);
        }
        let count = 0;
        allCoords.forEach((ring: number[][]) => {
          const latlngs = ring.map((c: number[]) => [c[1], c[0]] as [number, number]);
          const polygon = L.polygon(latlngs, { color: "#3388ff", weight: 2, fillOpacity: 0.2 });
          polygon.addTo(map);
          polyLayersRef.current.add(polygon);
          if (!readOnly) polygon.pm.enable({ snappable: false });
          count++;
        });
        console.log("INIT: created", count, "manual polygons, polyLayersRef now:", polyLayersRef.current.size);
        // Fit bounds
        if (allCoords.length > 0) {
          const allLatLngs = allCoords.flat().map((c: number[]) => [c[1], c[0]] as [number, number]);
          map.fitBounds(L.latLngBounds(allLatLngs).pad(0.2));
        }
        // Store the initial geometry
        currentGeoRef.current = initialGeoJSON;
      }

      // Track layers created by Geoman (user draws new polygon)
      map.on("pm:create", (e: any) => {
        const l = e.layer;
        // Validate: must have at least 3 distinct non-zero points
        if (typeof l.getLatLngs !== 'function') return;
        const latlngs = l.getLatLngs();
        const pts: any[] = Array.isArray(latlngs?.[0]) ? latlngs[0] : [];
        const valid = pts.filter((p: any) => Math.abs(p.lat) > 0.001 || Math.abs(p.lng) > 0.001).length;
        if (valid < 3) { console.log("pm:create SKIP phantom layer, valid pts:", valid); return; }
        polyLayersRef.current.add(l);
        const coords = extractCoordsFromLayer(l);
        if (coords) currentGeoRef.current = coords;
      });
      map.on("pm:update", (e: any) => {
        const coords = extractCoordsFromLayer(e.layer);
        if (coords) currentGeoRef.current = coords;
      });
      // Track layer removal (Geoman delete tool)
      map.on("pm:remove", (e: any) => {
        polyLayersRef.current.delete(e.layer);
      });
    };

    requestAnimationFrame(init);
    return () => {
      setupDone.current = false;
      try { (map as any)?.pm?.removeControls(); } catch {}
      map.off("pm:create");
      map.off("pm:update");
      map.off("pm:remove");
      map.off("pm:drawstart");
    };
  }, [map, initialGeoJSON, readOnly]);

  const handleSave = async () => {
    const allFeatures: GeoJSON.Feature[] = [];
    polyLayersRef.current.forEach((l: any) => {
      const geo = extractCoordsFromLayer(l);
      if (!geo) return;
      // Reject polygons with zero/near-zero coordinates (invalid artifacts)
      const allCoords: number[][] = [];
      function walk(c: any) { if (Array.isArray(c) && typeof c[0] === 'number') allCoords.push(c); else if (Array.isArray(c)) c.forEach(walk); }
      walk((geo.geometry as any)?.coordinates);
      const hasBad = allCoords.some(c => Math.abs(c[0]) < 0.001 && Math.abs(c[1]) < 0.001);
      const validPoints = allCoords.filter(c => Math.abs(c[0]) > 0.001 || Math.abs(c[1]) > 0.001).length;
      if (hasBad || validPoints < 3) {
        console.log("SKIP bad polygon: bad=" + hasBad + " validPoints=" + validPoints);
        return;
      }
      allFeatures.push(geo);
    });
    console.log("Poly layers tracked:", polyLayersRef.current.size, "| features:", allFeatures.length);

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
      if (initialGeoJSON?.geometry) {
        alert("FALLBACK: no se encontraron poligonos editables, guardando original");
        await doSave(initialGeoJSON);
        return;
      }
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
    console.log("SAVING feats:", allFeatures.length, "| allCoords:", JSON.stringify(allFeatures.map(f => (f.geometry as any)?.coordinates?.[0]?.[0])).substring(0, 200));
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
      // For sectores, use RPC that forces 2D geometry via ST_Force2D
      let resp: Response;
      if (table === 'sectores' && entityId) {
        resp = await fetch(`https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/rpc/update_sector_geom`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk",
          },
          body: JSON.stringify({ p_id: entityId, p_geojson: geometry }),
        });
      } else if (table === 'cuartel_sector' && where) {
        // Parse cuartel_id and sector_id from "cuartel_id=eq.uuid&sector_id=eq.uuid"
        const params = Object.fromEntries(where.split('&').map(p => {
          const [k, rest] = p.split('=');
          return [k, rest?.startsWith('eq.') ? rest.slice(3) : rest];
        }));
        console.log("CS PARAMS:", JSON.stringify(params), "| geo:", JSON.stringify(geometry).substring(0, 100));
        resp = await fetch(`https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/rpc/update_cuartel_sector_geom`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk",
          },
          body: JSON.stringify({ p_cuartel_id: params.cuartel_id, p_sector_id: params.sector_id, p_geojson: geometry }),
        });
      } else {
        resp = await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk",
          },
          body: JSON.stringify({ geometria: geometry }),
        });
      }
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
          <button onClick={() => {
            setDeleteMode(false);
            map.pm.disableGlobalRemovalMode();
            onClose();
          }} style={{ ...floatingBtn, background: "white", color: "#333" }}>
            Cancelar
          </button>
        )}
        <button onClick={() => {
          if (map.pm.globalRemovalModeEnabled()) {
            map.pm.disableGlobalRemovalMode();
            setDeleteMode(false);
          } else {
            map.pm.enableGlobalRemovalMode();
            setDeleteMode(true);
          }
        }} style={{
          ...floatingBtn,
          background: deleteMode ? "#c62828" : "white",
          color: deleteMode ? "white" : "#c62828",
          borderColor: "#c62828"
        }}>
          {deleteMode ? "Click en poligono a eliminar" : "Eliminar"}
        </button>
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
    let rings: number[][][] = [];

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

    // Force counter-clockwise orientation for all rings (GeoJSON standard)
    rings = rings.map(ring => {
      let area = 0;
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
      }
      // Positive area = CCW, Negative = CW (need to reverse)
      return area > 0 ? ring : ring.slice().reverse();
    });

    const geometry = rings.length === 1
      ? { type: "Polygon" as const, coordinates: [rings[0]] }
      : { type: "MultiPolygon" as const, coordinates: rings.map((r: number[][]) => [r]) };

    return { type: "Feature", geometry: geometry as any, properties: {} };
  } catch { return null; }
}
