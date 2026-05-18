import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import * as turf from "@turf/turf";
import { useGeometryStore } from "../../store/editorStore";

interface Props {
  initialGeoJSON?: GeoJSON.Feature | null;
  readOnly?: boolean;
}

export default function GeomanEditor({ initialGeoJSON, readOnly = false }: Props) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const setupDone = useRef(false);
  const { setGeojson, setValid } = useGeometryStore();

  // Initialize Geoman once
  useEffect(() => {
    if (setupDone.current) return;
    setupDone.current = true;

    if (!(map as any).pm) {
      // Geoman not loaded yet, retry
      setupDone.current = false;
      const id = requestAnimationFrame(() => { /* force re-render by not changing flag */ });
      return () => cancelAnimationFrame(id);
    }

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

    // Load initial geometry if provided
    if (initialGeoJSON?.geometry) {
      const layer = L.geoJSON(initialGeoJSON);
      layer.eachLayer((l: any) => {
        l.addTo(map);
        if (!readOnly) l.pm.enable();
      });
      layerRef.current = layer;
      map.fitBounds(layer.getBounds().pad(0.2));
      setGeojson(initialGeoJSON);
      const initialValidation = validateGeometry(initialGeoJSON);
      setValid(initialValidation.valid, initialValidation.errors);
    }

    // Handle create
    map.on("pm:create", (e: any) => {
      layerRef.current = e.layer;
      const geo = layerToGeoJSON(e.layer);
      const validation = validateGeometry(geo);
      setGeojson(geo);
      setValid(validation.valid, validation.errors);
    });

    // Handle update
    map.on("pm:update", (e: any) => {
      const geo = layerToGeoJSON(e.layer);
      const validation = validateGeometry(geo);
      setGeojson(geo);
      setValid(validation.valid, validation.errors);
    });

    return () => {
      try {
        pm.removeControls();
        map.off("pm:create");
        map.off("pm:update");
        layerRef.current?.remove();
      } catch {}
    };
  }, [map, initialGeoJSON, readOnly, setGeojson, setValid]);

  return null;
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

  if (!geo?.geometry || geo.geometry.type !== "Polygon") {
    return { valid: false, errors: ["Geometria no es un poligono valido"] };
  }

  const coords = (geo.geometry as any).coordinates[0] as number[][] | undefined;
  if (!coords || coords.length < 3) {
    errors.push("El poligono debe tener al menos 3 vertices");
  }

  if (coords && coords.length >= 3) {
    try {
      // Check self-intersection
      const polygon = turf.polygon([coords]);
      const kinks = turf.kinks(polygon);
      if (kinks.features.length > 0) {
        errors.push("El poligono tiene auto-intersecciones");
      }

      // Check minimum area (500 m²)
      const area = turf.area(polygon);
      if (area < 500) {
        errors.push(`Area minima 500 m2, actual: ${Math.round(area)} m2`);
      }
    } catch {
      errors.push("Error al validar la geometria");
    }
  }

  return { valid: errors.length === 0, errors };
}
