// Lógica de reposición de riego — portada de calculadora_riego.py (proyecto Agrotech IA)
// Misma fórmula, mismas tablas de Kc/etapa. Fuente de sectores: tabla `sectores` de Supabase
// (ya no un CSV aparte), fuente de clima: Open-Meteo (ver openMeteo.ts).

export type Especie = "Olivo" | "Cerezo" | "Avellano" | "Kiwi";

export const KC_TABLA: Record<Especie, Record<number, number>> = {
  Olivo: { 1: 0.80, 2: 0.70, 3: 0.60, 4: 0.50, 5: 0.45, 6: 0.45, 7: 0.45, 8: 0.50, 9: 0.55, 10: 0.65, 11: 0.80, 12: 0.80 },
  Cerezo: { 1: 0.65, 2: 0.55, 3: 0.45, 4: 0.45, 5: 0.45, 6: 0.45, 7: 0.45, 8: 0.60, 9: 0.70, 10: 0.85, 11: 0.80, 12: 0.75 },
  Avellano: { 1: 0.65, 2: 0.55, 3: 0.45, 4: 0.45, 5: 0.45, 6: 0.45, 7: 0.45, 8: 0.50, 9: 0.60, 10: 0.80, 11: 0.75, 12: 0.65 },
  Kiwi: { 1: 0.95, 2: 0.80, 3: 0.65, 4: 0.50, 5: 0.45, 6: 0.45, 7: 0.45, 8: 0.70, 9: 0.70, 10: 0.90, 11: 1.00, 12: 0.95 },
};

export const ETAPA_TABLA: Record<Especie, Record<number, string>> = {
  Olivo: {
    1: "Envero", 2: "Maduración", 3: "Cosecha", 4: "Post-cosecha",
    5: "Reposo invernal", 6: "Reposo invernal", 7: "Reposo invernal",
    8: "Hinchamiento yemas", 9: "Floración", 10: "Cuajado",
    11: "Crecimiento fruto", 12: "Crecimiento fruto",
  },
  Cerezo: {
    1: "Post-cosecha", 2: "Recuperación", 3: "Reposo", 4: "Reposo",
    5: "Reposo", 6: "Reposo", 7: "Reposo", 8: "Floración",
    9: "Cuajado", 10: "Crecimiento fruto", 11: "Envero", 12: "Maduración",
  },
  Avellano: {
    1: "Maduración", 2: "Cosecha", 3: "Post-cosecha", 4: "Reposo",
    5: "Reposo", 6: "Reposo", 7: "Reposo", 8: "Floración",
    9: "Cuajado", 10: "Crecimiento fruto", 11: "Engrosamiento", 12: "Maduración",
  },
  Kiwi: {
    1: "Crecimiento fruto", 2: "Maduración", 3: "Cosecha", 4: "Post-cosecha",
    5: "Reposo", 6: "Reposo", 7: "Reposo", 8: "Brotación",
    9: "Brotación", 10: "Crecimiento vegetativo", 11: "Floración", 12: "Crecimiento fruto",
  },
};

export function kcBase(especie: string, mes: number): number {
  return KC_TABLA[especie as Especie]?.[mes] ?? 0.5;
}

export function etapaFenologica(especie: string, mes: number): string {
  return ETAPA_TABLA[especie as Especie]?.[mes] ?? "";
}

/** Ajusta el Kc base según la edad del plantel y la especie (misma curva que calculadora_riego.py) */
export function ajustarKcPorEdad(kcBaseVal: number, anioPlantacion: number | null, especie: string): number {
  if (!anioPlantacion) return kcBaseVal;
  const edad = new Date().getFullYear() - anioPlantacion;
  let factor: number;

  switch (especie as Especie) {
    case "Olivo":
      if (edad <= 3) factor = 0.40 + edad * 0.067;
      else if (edad <= 8) factor = 0.60 + (edad - 3) * 0.04;
      else if (edad <= 15) factor = 0.80 + (edad - 8) * 0.029;
      else factor = Math.max(0.60, 1.00 - (edad - 15) * 0.01);
      break;
    case "Cerezo":
      if (edad <= 3) factor = 0.35;
      else if (edad <= 6) factor = 0.50 + (edad - 3) * 0.10;
      else if (edad <= 10) factor = 0.80 + (edad - 6) * 0.05;
      else factor = Math.max(0.40, 1.00 - (edad - 10) * 0.03);
      break;
    case "Kiwi":
      if (edad <= 2) factor = 0.30;
      else if (edad <= 5) factor = 0.50 + (edad - 2) * 0.10;
      else if (edad <= 10) factor = 0.80 + (edad - 5) * 0.04;
      else factor = Math.max(0.60, 1.00 - (edad - 10) * 0.02);
      break;
    case "Avellano":
      if (edad <= 3) factor = 0.35;
      else if (edad <= 8) factor = 0.55 + (edad - 3) * 0.05;
      else if (edad <= 15) factor = 0.80 + (edad - 8) * 0.029;
      else factor = Math.max(0.50, 1.00 - (edad - 15) * 0.015);
      break;
    default:
      factor = 1.0;
  }
  return kcBaseVal * factor;
}

export interface ReposicionCalculo {
  etcDiaria: number;
  etcSemanal: number;
  precipEfectiva: number;
  reposicionNeta: number;
  reposicionBruta: number; // mm
  volumenM3Ha: number;
}

/** Reponer en esta semana la ETc de la semana pasada, descontando la lluvia real de esos mismos 7 días */
export function calcularReposicionSemanal(
  et0Diario: number,
  kc: number,
  eficiencia: number,
  precipitacionSemanalMm: number
): ReposicionCalculo {
  const etcDiaria = et0Diario * kc;
  const etcSemanal = etcDiaria * 7;
  const precipEfectiva = Math.min(precipitacionSemanalMm * 0.75, etcSemanal * 0.80);
  const reposicionNeta = etcSemanal - precipEfectiva;
  const reposicionBruta = Math.max(0, reposicionNeta / (eficiencia || 0.9));
  return {
    etcDiaria: round2(etcDiaria),
    etcSemanal: round2(etcSemanal),
    precipEfectiva: round2(precipEfectiva),
    reposicionNeta: round2(reposicionNeta),
    reposicionBruta: round2(reposicionBruta),
    volumenM3Ha: round2(reposicionBruta * 10),
  };
}

export type Accion = "REGAR" | "MONITOREAR" | "SIN_REGAR";
export type Urgencia = "ALTA" | "MEDIA" | "BAJA";

const UMBRAL_RIEGO = 25;
const UMBRAL_ALERTA = 15;

export function clasificar(reposicionMm: number): { accion: Accion; urgencia: Urgencia } {
  if (reposicionMm > UMBRAL_RIEGO) return { accion: "REGAR", urgencia: "ALTA" };
  if (reposicionMm > UMBRAL_ALERTA) return { accion: "MONITOREAR", urgencia: "MEDIA" };
  return { accion: "SIN_REGAR", urgencia: "BAJA" };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
