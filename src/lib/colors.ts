import { EspecieColor } from "./types";

export const COLOR_POR_ESPECIE: EspecieColor[] = [
  { especie: "Olivo", color: "#2e7d32" },
  { especie: "Avellano", color: "#795548" },
  { especie: "Cerezo", color: "#c62828" },
  { especie: "Kiwi", color: "#7cb342" },
];

export const COLOR_DEFAULT = "#90caf9";
export const COLOR_EDIFICACION = "#ff9800";
export const COLOR_FILTRADO_OUT = "#e0e0e0";

export function colorPorEspecie(especie: string): string {
  const found = COLOR_POR_ESPECIE.find(
    (c) => c.especie.toLowerCase() === especie.toLowerCase()
  );
  return found?.color || COLOR_DEFAULT;
}
