import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import path from "path";

const supabase = createClient(
  "https://nnelrvctqjbwfucccxfh.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk"
);

async function main() {
  const { data, error } = await supabase
    .from("cuartel_sector")
    .select("cuartel_id, sector_id, codigo, porcentaje_agua");

  if (error) { console.error("Error:", error); process.exit(1); }

  const { data: cuarteles } = await supabase.from("cuarteles").select("id, nombre");
  const { data: sectores } = await supabase.from("sectores").select("id, codigo");

  const cuartelMap = Object.fromEntries((cuarteles || []).map(c => [c.id, c.nombre]));
  const sectorMap = Object.fromEntries((sectores || []).map(s => [s.id, s.codigo]));

  // Group by cuartel_id
  const porCuartel = {};
  const porSector = {};
  for (const r of data) {
    if (!porCuartel[r.cuartel_id]) porCuartel[r.cuartel_id] = [];
    porCuartel[r.cuartel_id].push(r);
    if (!porSector[r.sector_id]) porSector[r.sector_id] = [];
    porSector[r.sector_id].push(r);
  }

  // Sheet 1: Cuarteles con mas de un sector
  const cuartelRows = [];
  for (const [id, rows] of Object.entries(porCuartel)) {
    if (rows.length > 1) {
      cuartelRows.push({
        Cuartel: cuartelMap[id] || id,
        "Cant. Sectores": rows.length,
        Sectores: rows.map(r => sectorMap[r.sector_id] || r.sector_id).join(", "),
        "Unidades (códigos)": rows.map(r => r.codigo).join(", "),
      });
    }
  }
  cuartelRows.sort((a, b) => a.Cuartel.localeCompare(b.Cuartel, undefined, { numeric: true }));

  // Sheet 2: Sectores con mas de un cuartel
  const sectorRows = [];
  for (const [id, rows] of Object.entries(porSector)) {
    if (rows.length > 1) {
      sectorRows.push({
        Sector: sectorMap[id] || id,
        "Cant. Cuarteles": rows.length,
        Cuarteles: rows.map(r => cuartelMap[r.cuartel_id] || r.cuartel_id).join(", "),
        "Unidades (códigos)": rows.map(r => r.codigo).join(", "),
      });
    }
  }
  sectorRows.sort((a, b) => a.Sector.localeCompare(b.Sector, undefined, { numeric: true }));

  // Summary
  const summaryRows = [
    { Métrica: "Total unidades de riego", Valor: data.length },
    { Métrica: "Total cuarteles", Valor: Object.keys(porCuartel).length },
    { Métrica: "Total sectores", Valor: Object.keys(porSector).length },
    { Métrica: "Cuarteles con múltiples sectores", Valor: cuartelRows.length },
    { Métrica: "Sectores con múltiples cuarteles", Valor: sectorRows.length },
  ];

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(cuartelRows);
  XLSX.utils.book_append_sheet(wb, ws1, "Cuarteles multi-sector");

  const ws2 = XLSX.utils.json_to_sheet(sectorRows);
  XLSX.utils.book_append_sheet(wb, ws2, "Sectores multi-cuartel");

  const ws3 = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, ws3, "Resumen");

  const outPath = path.resolve("C:\\Users\\Usuario\\Desktop\\Unidades de riego revision.xlsx");
  XLSX.writeFile(wb, outPath);
  console.log("Archivo generado:", outPath);
}

main();
