// Lógica de reposición de riego — Nivel 2 Híbrido
// Kc dinámico basado en Fracción de Cobertura (fc)
// Fórmula: Kc = Kc_min + (Kc_max - Kc_min) × fc
// Fuente de Kc_max: datos reales de campo Siracusa (CSV)
// Fuente de clima: Open-Meteo (ver openMeteo.ts)

export type Especie = "Olivo" | "Cerezo" | "Avellano" | "Kiwi";

// ====== PARÁMETROS KC POR ESPECIE ======
// kcMin: evaporación del suelo descubierto (riego por goteo)
// kcMaxMes: Kc del CSV para cultivo adulto a plena cobertura (Kc_max)
// esPerenne: true = siempre adulto (ej: olivos en Siracusa)

export interface KcParametros {
  kcMin: number;
  kcMaxMes: Record<number, number>;
  esPerenne: boolean;
}

export const KC_PARAMETROS: Record<Especie, KcParametros> = {
  Olivo: {
    kcMin: 0.15,
    kcMaxMes: {
      1: 0.50, 2: 0.45, 3: 0.31, 4: 0.23, 5: 0.45, 6: 0.45,
      7: 0.45, 8: 0.50, 9: 0.55, 10: 0.20, 11: 0.30, 12: 0.45,
    },
    esPerenne: true, // En Siracusa: solo olivos adultos
  },
  Cerezo: {
    kcMin: 0.20,
    kcMaxMes: {
      1: 0.70, 2: 0.60, 3: 0.40, 4: 0.20, 5: 0.45, 6: 0.45,
      7: 0.45, 8: 0.60, 9: 0.70, 10: 0.35, 11: 0.80, 12: 1.00,
    },
    esPerenne: false,
  },
  Avellano: {
    kcMin: 0.20,
    kcMaxMes: {
      1: 0.60, 2: 0.55, 3: 0.40, 4: 0.30, 5: 0.45, 6: 0.45,
      7: 0.45, 8: 0.50, 9: 0.60, 10: 0.35, 11: 0.50, 12: 0.55,
    },
    esPerenne: false,
  },
  Kiwi: {
    kcMin: 0.25,
    kcMaxMes: {
      1: 1.15, 2: 1.10, 3: 0.80, 4: 0.50, 5: 0.40, 6: 0.40,
      7: 0.40, 8: 0.70, 9: 0.70, 10: 0.70, 11: 1.00, 12: 1.15,
    },
    esPerenne: false, // Todos nuevos en Siracusa
  },
};

// ====== CÁLCULO DE FRACCIÓN DE COBERTURA (fc) ======

/**
 * Calcula fc basado en la edad del cultivo.
 * fc va de ~0.15 (plantón) a 1.0 (adulto a plena cobertura).
 */
function calcularFcAutomatico(especie: string, edad: number): number {
  switch (especie as Especie) {
    case "Olivo":
      // Olivos en Siracusa: siempre adultos (fc = 1.0)
      return 1.0;

    case "Cerezo":
      if (edad <= 1) return 0.15;
      if (edad <= 2) return 0.30;
      if (edad <= 3) return 0.50;
      if (edad <= 5) return 0.70;
      if (edad <= 8) return 0.90;
      return 1.0;

    case "Avellano":
      if (edad <= 1) return 0.15;
      if (edad <= 2) return 0.30;
      if (edad <= 3) return 0.50;
      if (edad <= 5) return 0.70;
      if (edad <= 10) return 0.90;
      return 1.0;

    case "Kiwi":
      // Kiwi: crecimiento muy rápido (step function)
      if (edad <= 1) return 0.15;
      if (edad <= 2) return 0.40;
      if (edad <= 3) return 0.70;
      if (edad <= 4) return 0.95;
      return 1.0;

    default:
      return 0.50;
  }
}

/**
 * Calcula la fracción de cobertura (fc).
 * Prioridad: manual > automático > default (1.0)
 */
export function calcularFc(
  especie: string,
  anioPlantacion: number | null,
  fcManual: number | null
): number {
  // 1. Si el usuario ingresa fc manual, usarlo
  if (fcManual !== null && fcManual !== undefined) {
    return Math.max(0, Math.min(1, fcManual));
  }

  // 2. Si es perenne (olivo), siempre adulto
  const params = KC_PARAMETROS[especie as Especie];
  if (params?.esPerenne) return 1.0;

  // 3. Calcular automáticamente por edad
  if (anioPlantacion !== null && anioPlantacion !== undefined) {
    const edad = new Date().getFullYear() - anioPlantacion;
    if (edad >= 0) {
      return calcularFcAutomatico(especie, edad);
    }
  }

  // 4. Default: asumir adulto
  return 1.0;
}

// ====== CÁLCULO KC DINÁMICO ======

export interface KcResultado {
  kc: number;       // Kc final calculado
  fc: number;       // Fracción de cobertura usada
  kcMin: number;    // Evaporación del suelo
  kcMax: number;    // Kc del CSV (adulto)
}

/**
 * Calcula el Kc dinámico usando la fórmula:
 * Kc = Kc_min + (Kc_max - Kc_min) × fc
 *
 * @param especie - Olivo, Cerezo, Avellano, Kiwi
 * @param mes - Mes del año (1-12)
 * @param anioPlantacion - Año de plantación del sector
 * @param fcManual - Fracción de cobertura ingresada por admin (opcional)
 */
export function calcularKcDinamico(
  especie: string,
  mes: number,
  anioPlantacion: number | null,
  fcManual: number | null = null
): KcResultado {
  const params = KC_PARAMETROS[especie as Especie];

  if (!params) {
    return { kc: 0.5, fc: 1.0, kcMin: 0.2, kcMax: 0.5 };
  }

  // Obtener Kc_max del mes (o valor de invierno si no hay dato)
  const kcMax = params.kcMaxMes[mes] ?? 0.45;
  const kcMin = params.kcMin;

  // Calcular fc
  const fc = calcularFc(especie, anioPlantacion, fcManual);

  // Fórmula principal
  const kc = kcMin + (kcMax - kcMin) * fc;

  return { kc, fc, kcMin, kcMax };
}

// ====== CÁLCULO DE REPOSICIÓN SEMANAL ======

export interface ReposicionCalculo {
  etcDiaria: number;
  etcSemanal: number;
  precipEfectiva: number;
  reposicionNeta: number;
  reposicionBruta: number; // mm
  volumenM3Ha: number;
}

/** Reponer en esta semana la ETc de la semana pasada, descontando la lluvia real */
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

// ====== CLASIFICACIÓN DE ACCIÓN ======

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
