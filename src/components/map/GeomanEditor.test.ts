import { describe, it, expect } from "vitest";
import { validateGeometry, layerToGeoJSON } from "./GeomanEditor";

// Mock Leaflet layer
function mockLayer(latlngs: any[]) {
  return {
    getLatLngs: () => latlngs,
  };
}

describe("validateGeometry", () => {
  it("acepta un poligono valido con area > 500m2", () => {
    // Valid polygon: large square (~10,000 m²)
    const geo: GeoJSON.Feature = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [0, 0], [0, 0.001], [0.001, 0.001], [0.001, 0], [0, 0],
        ]],
      },
      properties: {},
    };

    const result = validateGeometry(geo);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rechaza poligono con auto-interseccion", () => {
    // Self-intersecting polygon (bowtie shape)
    const geo: GeoJSON.Feature = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [0, 0], [0, 0.002], [0.001, 0], [0.001, 0.002], [0, 0],
        ]],
      },
      properties: {},
    };

    const result = validateGeometry(geo);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("auto-intersecci"))).toBe(true);
  });

  it("rechaza geometria con menos de 4 coordenadas (3 vertices)", () => {
    const geo: GeoJSON.Feature = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[[0, 0], [1, 1], [0, 1]]],
      },
      properties: {},
    };

    const result = validateGeometry(geo);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("3 vertices"))).toBe(true);
  });

  it("rechaza si geometry es null", () => {
    const geo: GeoJSON.Feature = {
      type: "Feature",
      geometry: undefined as any,
      properties: {},
    };

    const result = validateGeometry(geo);
    expect(result.valid).toBe(false);
  });
});

describe("layerToGeoJSON", () => {
  it("convierte LatLngs de Leaflet a GeoJSON Feature", () => {
    const latlngs = [[
      { lng: -71.62, lat: -35.13 },
      { lng: -71.61, lat: -35.13 },
      { lng: -71.61, lat: -35.12 },
      { lng: -71.62, lat: -35.12 },
      { lng: -71.62, lat: -35.13 },
    ]];
    const layer = mockLayer(latlngs);

    const result = layerToGeoJSON(layer);

    expect(result.type).toBe("Feature");
    expect(result.geometry.type).toBe("Polygon");
    expect((result.geometry as any).coordinates[0]).toHaveLength(5);
    expect((result.geometry as any).coordinates[0][0]).toEqual([-71.62, -35.13]);
  });
});
