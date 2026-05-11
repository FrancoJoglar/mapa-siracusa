import * as XLSX from "xlsx";
import { Cuartel } from "./types";

export function exportarCuarteles(cuarteles: Cuartel[], filename: string = "cuarteles_export") {
  const data = cuarteles.map((c) => ({
    Cuartel: c.nombre,
    Especie: c.especie,
    Variedad: c.variedad,
    "Año Plantación": c.anio_plantacion ?? "",
    "Superficie (ha)": c.superficie_ha ?? "",
    Plantas: c.plantas ?? "",
    Polinizante: c.polinizante,
    "Jefe de Campo": c.jefe_campo,
    "Centro Costo": c.centro_costo,
    "Equipo Riego": c.equipo_riego,
    "Sector Riego": c.sector_raw,
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

export function exportarCuartelesGeoJSON(cuarteles: Cuartel[], filename: string = "cuarteles_export") {
  const features = cuarteles
    .filter((c) => c.geojson)
    .map((c) => ({
      type: "Feature" as const,
      geometry: c.geojson!.geometry,
      properties: {
        nombre: c.nombre,
        especie: c.especie,
        variedad: c.variedad,
        anio_plantacion: c.anio_plantacion,
        superficie_ha: c.superficie_ha,
        plantas: c.plantas,
        polinizante: c.polinizante,
        jefe_campo: c.jefe_campo,
        centro_costo: c.centro_costo,
        equipo_riego: c.equipo_riego,
        sector_raw: c.sector_raw,
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
