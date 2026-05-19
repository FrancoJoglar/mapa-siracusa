import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import * as turf from "@turf/turf";
import { supabase } from "../../lib/supabase";

interface Props {
  initialGeoJSON?: GeoJSON.Feature | null;
  table?: "cuarteles" | "sectores";
  entityId?: string;
  readOnly?: boolean;
  onClose?: () => void;
}

export default function GeomanEditor({ initialGeoJSON, table, entityId, readOnly = false, onClose }: Props) {
  const map = useMap();
  const featureLayerRef = useRef<any>(null);
  const setupDone = useRef(false);
  const [saving, setSaving] = useState(false);

  // Initialize Geoman once
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
        drawCircle: false,
        drawCircleMarker: false,
        drawRectangle: false,
        drawPolyline: false,
        drawMarker: false,
        drawText: false,
        cutPolygon: false,
        rotateMode: false,
        dragMode: !readOnly,
        editMode: !readOnly,
        removalMode: !readOnly,
      });

      if (initialGeoJSON?.geometry) {
        const layer = L.geoJSON(initialGeoJSON);
        layer.eachLayer((l: any) => {
          l.addTo(map);
          if (!readOnly) l.pm.enable();
          featureLayerRef.current = l; // Store the FIRST feature layer
        });
        if (layer.getBounds().isValid()) {
          map.fitBounds(layer.getBounds().pad(0.2));
        }
      }
    };

    requestAnimationFrame(init);

    return () => {
      setupDone.current = false;
      try {
        (map as any)?.pm?.removeControls();
        map.off("pm:create");
        map.off("pm:update");
      } catch {}
    };
  }, [map, initialGeoJSON, readOnly]);

  const handleSave = async () => {
    let targetLayer = featureLayerRef.current;

    if (!targetLayer) {
      if (initialGeoJSON?.geometry) {
        await doSave(initialGeoJSON);
        return;
      }
      alert("No hay poligono para guardar");
      return;
    }

    const geo = layerToGeoJSON(targetLayer);
    const v = validateGeometry(geo);
    if (!v.valid) {
      alert("Poligono invalido:\n" + v.errors.join("\n"));
      return;
    }
    await doSave(geo);
  };

  const doSave = async (feature: GeoJSON.Feature) => {
    if (!table || !entityId) { alert("Faltan datos de guardado"); return; }
    const geometry = (feature as any)?.geometry || feature;
    if (!geometry?.type || !geometry?.coordinates) { alert("Geometria invalida"); return; }

    setSaving(true);
    try {
      const { error: err } = await (supabase as any)
        .from(table)
        .update({ geometria: geometry })
        .eq("id", entityId);
      if (err) throw new Error(JSON.stringify(err));
      alert("Poligono guardado correctamente");
      onClose?.();
    } catch (e: any) {
      alert("Error: " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="leaflet-top leaflet-right" style={{ top: 150 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 16px",
            background: saving ? "#ccc" : "#1565c0",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
      {onClose && (
        <div className="leaflet-top leaflet-right" style={{ top: 190 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "#e53935",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Cancelar
          </button>
        </div>
      )}
    </>
  );
}

// ===== PURE FUNCTIONS (testable without DOM) =====

export function layerToGeoJSON(layer: any): GeoJSON.Feature {
  const latlngs = layer.getLatLngs();
  const coords = (latlngs as any[]).map((ring: any[]) =>
    ring.map((ll: { lng: number; lat: number }) => [ll.lng, ll.lat])
  );
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: coords,
    },
    properties: {},
  };
}

export function validateGeometry(geo: GeoJSON.Feature): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const g = (geo as any)?.geometry || geo;
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) {
    return { valid: false, errors: ["Geometria no es un poligono valido"] };
  }

  // Extract first ring coordinates
  const coords = g.type === "Polygon"
    ? (g.coordinates[0] as number[][])
    : (g.coordinates[0]?.[0] as number[][]) || [];

  if (!coords || coords.length < 4) {
    errors.push("El poligono debe tener al menos 3 vertices");
    return { valid: false, errors };
  }

  try {
    const polygon = turf.polygon([coords]);
    const kinks = turf.kinks(polygon);
    if (kinks.features.length > 0) {
      errors.push("El poligono tiene auto-intersecciones");
    }
    const area = turf.area(polygon);
    if (area < 500) {
      errors.push(`Area minima 500 m2, actual: ${Math.round(area)} m2`);
    }
  } catch {
    errors.push("Error al validar la geometria");
  }

  return { valid: errors.length === 0, errors };
}
