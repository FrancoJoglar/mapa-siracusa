import { useState, useEffect, useMemo } from "react";
import { useSectores } from "./useSectores";
import { obtenerDatosClima, DatosClima } from "../lib/openMeteo";
import { calcularKcDinamico, calcularReposicionSemanal, clasificar, Accion } from "../lib/riego";

export interface SectorRiego {
  id: string;
  codigo: string;
  equipoCodigo: number;
  equipoNombre: string;
  numero: number;
  especie: string;
  variedad: string;
  hectareas: number;
  jefeCampo: string;
  anio: number | null;
  etapa: string;
  kcBase: number;      // Kc del CSV (adulto a plena cobertura)
  kcAjustado: number;  // Kc dinámico calculado
  fc: number;          // Fracción de cobertura
  kcMin: number;       // Evaporación del suelo
  etcSemanal: number;
  reposicionMm: number;
  volumenM3: number;
  accion: Accion;
}

export function useRiego() {
  const { sectores, loading: loadingSectores, error: errorSectores, refetch } = useSectores();
  const [clima, setClima] = useState<DatosClima | null>(null);
  const [loadingClima, setLoadingClima] = useState(true);
  const [errorClima, setErrorClima] = useState<string | null>(null);

  useEffect(() => {
    obtenerDatosClima()
      .then(setClima)
      .catch((e) => setErrorClima(e.message))
      .finally(() => setLoadingClima(false));
  }, []);

  const resultados: SectorRiego[] = useMemo(() => {
    if (!clima) return [];
    const mesActual = new Date().getMonth() + 1;

    return sectores
      .filter((s) => s.hectareas && s.especie)
      .map((s) => {
        // NUEVO: Usar calcularKcDinamico con fc
        const { kc, fc, kcMin, kcMax } = calcularKcDinamico(
          s.especie,
          mesActual,
          s.anio,
          s.fc_manual  // Del campo en DB (null = automático)
        );

        const repo = calcularReposicionSemanal(
          clima.et0Promedio,
          kc,
          s.eficiencia ?? 0.9,
          clima.precipitacionSemanalMm
        );
        const volumenM3 = repo.volumenM3Ha * (s.hectareas || 0);
        const { accion } = clasificar(repo.reposicionBruta);

        // Calcular etapa fenográfica (placeholder - se puede mejorar)
        const etapa = calcularEtapa(s.especie, mesActual);

        return {
          id: s.id,
          codigo: s.codigo,
          equipoCodigo: s.equipo?.codigo ?? 0,
          equipoNombre: s.equipo?.nombre ?? "",
          numero: s.numero,
          especie: s.especie,
          variedad: s.variedad,
          hectareas: s.hectareas || 0,
          jefeCampo: s.jefe_campo,
          anio: s.anio,
          etapa,
          kcBase: kcMax,       // Kc del CSV (adulto)
          kcAjustado: kc,      // Kc dinámico
          fc,                  // Fracción de cobertura
          kcMin,               // Evaporación del suelo
          etcSemanal: repo.etcSemanal,
          reposicionMm: repo.reposicionBruta,
          volumenM3: Math.round(volumenM3),
          accion,
        };
      });
  }, [sectores, clima]);

  const resumen = useMemo(() => {
    const aRegar = resultados.filter((r) => r.accion === "REGAR").length;
    const monitorear = resultados.filter((r) => r.accion === "MONITOREAR").length;
    const sinRiego = resultados.filter((r) => r.accion === "SIN_REGAR").length;
    const volumenTotal = resultados.reduce((a, r) => a + r.volumenM3, 0);
    return { total: resultados.length, aRegar, monitorear, sinRiego, volumenTotal };
  }, [resultados]);

  return {
    resultados,
    resumen,
    clima,
    loading: loadingSectores || loadingClima,
    error: errorSectores || errorClima,
    refetch,
  };
}

// Función placeholder para etapa fenológica
function calcularEtapa(especie: string, mes: number): string {
  const etapas: Record<string, Record<number, string>> = {
    Olivo: {
      1: "Envero", 2: "Maduración", 3: "Cosecha", 4: "Post-cosecha",
      5: "Reposo", 6: "Reposo", 7: "Reposo", 8: "Hinchamiento",
      9: "Floración", 10: "Cuajado", 11: "Crecimiento fruto", 12: "Crecimiento fruto",
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
  return etapas[especie]?.[mes] ?? "";
}
