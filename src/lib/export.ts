import * as XLSX from "xlsx";
import { Cuartel, SectorGeo } from "./types";

function resolveEquipoRiego(c: Cuartel, sectores: SectorGeo[]): string {
  if (!c.sector_ids?.length) return "";
  const eqNums = new Set<string>();
  c.sector_ids.forEach(sid => {
    const sec = sectores.find(s => s.id === sid);
    if (sec?.equipo) {
      const num = sec.equipo.replace(/\D/g, "");
      if (num) eqNums.add(num);
    }
  });
  return Array.from(eqNums).sort((a, b) => Number(a) - Number(b)).join(" - ");
}

function resolveSectorRaw(c: Cuartel, sectores: SectorGeo[]): string {
  if (!c.sector_ids?.length) return "";
  const secNums = new Set<number>();
  c.sector_ids.forEach(sid => {
    const sec = sectores.find(s => s.id === sid);
    if (sec?.numero != null) secNums.add(sec.numero);
  });
  return Array.from(secNums).sort((a, b) => a - b).join(" - ");
}

export function exportarCuarteles(cuarteles: Cuartel[], filename: string = "cuarteles_export", sectores?: SectorGeo[]) {
  const data = cuarteles.map((c) => ({
    Cuartel: c.nombre,
    Especie: c.especie,
    Variedad: c.variedad,
    "Año Plantación": c["año_plantacion"] ?? "",
    "Superficie (ha)": c.superficie_ha ?? "",
    Plantas: c.plantas ?? "",
    Polinizante: c.polinizante,
    "Jefe de Campo": c.jefe_campo,
    "Centro Costo": c.centro_costo,
    "Equipo Riego": sectores ? resolveEquipoRiego(c, sectores) : "",
    "Sector Riego": sectores ? resolveSectorRaw(c, sectores) : "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cuarteles");

  const totalHa = cuarteles.reduce((sum, c) => sum + (c.superficie_ha || 0), 0);
  XLSX.utils.sheet_add_aoa(
    ws,
    [
      [""],
      [`Total cuarteles: ${cuarteles.length}`],
      [`Total superficie: ${totalHa.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`],
    ],
    { origin: -1 }
  );

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportarCuartelesGeoJSON(cuarteles: Cuartel[], filename: string = "cuarteles_export", sectores?: SectorGeo[]) {
  const features = cuarteles
    .filter((c) => c.geojson)
    .map((c) => ({
      type: "Feature" as const,
      geometry: c.geojson!.geometry,
      properties: {
        nombre: c.nombre,
        especie: c.especie,
        variedad: c.variedad,
        "año_plantacion": c["año_plantacion"],
        superficie_ha: c.superficie_ha,
        plantas: c.plantas,
        polinizante: c.polinizante,
        jefe_campo: c.jefe_campo,
        centro_costo: c.centro_costo,
        equipo_riego: sectores ? resolveEquipoRiego(c, sectores) : "",
        sector_raw: sectores ? resolveSectorRaw(c, sectores) : "",
      },
    }));

  const geojson = {
    type: "FeatureCollection",
    features,
  };

  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
}
