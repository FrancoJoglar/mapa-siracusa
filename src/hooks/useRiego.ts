import { useState, useEffect, useMemo } from "react";
import { useSectores } from "./useSectores";
import { obtenerDatosClima, DatosClima } from "../lib/openMeteo";
import { kcBase, etapaFenologica, ajustarKcPorEdad, calcularReposicionSemanal, clasificar, Accion } from "../lib/riego";

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
  kcBase: number;
  kcAjustado: number;
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
        const kcB = kcBase(s.especie, mesActual);
        const kcAjustado = ajustarKcPorEdad(kcB, s.anio, s.especie);
        const repo = calcularReposicionSemanal(
          clima.et0Promedio,
          kcAjustado,
          s.eficiencia ?? 0.9,
          clima.precipitacionSemanalMm
        );
        const volumenM3 = repo.volumenM3Ha * (s.hectareas || 0);
        const { accion } = clasificar(repo.reposicionBruta);

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
          etapa: etapaFenologica(s.especie, mesActual),
          kcBase: kcB,
          kcAjustado: Math.round(kcAjustado * 1000) / 1000,
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
