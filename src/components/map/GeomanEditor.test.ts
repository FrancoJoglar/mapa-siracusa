import { describe, it, expect } from "vitest";

function mockPolygon(latlngs: any[]) {
  return { getLatLngs: () => latlngs };
}

// Copy of the function for testing
function extractCoordsFromLayer(layer: any): GeoJSON.Feature | null {
  try {
    const latlngs = layer.getLatLngs();
    const rings: number[][][] = [];
    if (!latlngs || !latlngs[0]) return null;
    if (typeof latlngs[0].lat === "number") {
      rings.push(latlngs.map((ll: any) => [ll.lng, ll.lat]));
    } else if (Array.isArray(latlngs[0])) {
      for (const ring of latlngs) {
        if (ring && ring.length && typeof ring[0]?.lat === "number") {
          rings.push(ring.map((ll: any) => [ll.lng, ll.lat]));
        } else if (Array.isArray(ring[0])) {
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
      : { type: "MultiPolygon" as const, coordinates: rings };
    return { type: "Feature", geometry: geometry as any, properties: {} };
  } catch { return null; }
}

describe("extractCoordsFromLayer", () => {
  it("extrae de poligono simple ([LatLng])", () => {
    const layer = mockPolygon([
      { lng: -71.62, lat: -35.13 }, { lng: -71.61, lat: -35.13 },
      { lng: -71.61, lat: -35.12 }, { lng: -71.62, lat: -35.12 },
      { lng: -71.62, lat: -35.13 },
    ]);
    const r = extractCoordsFromLayer(layer);
    expect(r?.geometry.type).toBe("Polygon");
    expect((r!.geometry as any).coordinates[0]).toHaveLength(5);
  });

  it("extrae de MultiPolygon ([[LatLng]])", () => {
    const layer = mockPolygon([
      [{ lng: 0, lat: 0 }, { lng: 1, lat: 0 }, { lng: 1, lat: 1 }, { lng: 0, lat: 1 }, { lng: 0, lat: 0 }],
      [{ lng: 2, lat: 0 }, { lng: 3, lat: 0 }, { lng: 3, lat: 1 }, { lng: 2, lat: 1 }, { lng: 2, lat: 0 }],
    ]);
    const r = extractCoordsFromLayer(layer);
    expect(r?.geometry.type).toBe("MultiPolygon");
    expect((r!.geometry as any).coordinates).toHaveLength(2);
  });

  it("rechaza layer sin coordenadas", () => {
    const layer = mockPolygon([]);
    expect(extractCoordsFromLayer(layer)).toBeNull();
  });
});
