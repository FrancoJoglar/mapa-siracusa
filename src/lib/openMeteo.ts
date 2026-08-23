// Cliente de clima — Open-Meteo (gratis, sin API key), mismo enfoque que calculadora_riego.py.
// TODO: reemplazar por la estación Davis WeatherLink real del predio cuando esté conectada
// (ver Agrotech IA — quedó pendiente por credenciales inválidas).

const LATITUD = -34.98;
const LONGITUD = -71.28;
const TIMEZONE = "America/Santiago";
export const DIAS_VENTANA = 7;

export interface DatosClima {
  tempMax: number;
  hr: number;
  viento: number;
  precipitacionHoy: number;
  et0Promedio: number;
  precipitacionSemanalMm: number;
  periodo: { desde: string; hasta: string; dias: number };
}

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function obtenerDatosClima(): Promise<DatosClima> {
  const hoy = new Date();
  const inicio = new Date(hoy);
  inicio.setDate(inicio.getDate() - DIAS_VENTANA);

  const fechaHasta = fechaISO(hoy);
  const fechaDesde = fechaISO(inicio);

  const urlActual =
    `https://api.open-meteo.com/v1/forecast?latitude=${LATITUD}&longitude=${LONGITUD}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,et0_fao_evapotranspiration` +
    `&timezone=${TIMEZONE}&past_days=1&forecast_days=3`;

  const urlHistorico =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUD}&longitude=${LONGITUD}` +
    `&start_date=${fechaDesde}&end_date=${fechaHasta}` +
    `&daily=precipitation_sum,et0_fao_evapotranspiration&timezone=${TIMEZONE}`;

  try {
    const [respActual, respHistorico] = await Promise.all([fetch(urlActual), fetch(urlHistorico)]);
    if (!respActual.ok || !respHistorico.ok) throw new Error("Error consultando Open-Meteo");

    const datosActual = await respActual.json();
    const historico = await respHistorico.json();

    const actual = datosActual.current || {};
    const tempMax = actual.temperature_2m ?? 15;
    const hr = actual.relative_humidity_2m ?? 60;
    const viento = actual.wind_speed_10m ?? 2;
    const precipitacionHoy = actual.precipitation ?? 0;
    const et0Api = actual.et0_fao_evapotranspiration ?? 3.0;

    const et0Serie: number[] = (historico?.daily?.et0_fao_evapotranspiration || []).filter(
      (v: number | null) => v !== null
    );
    const et0Vals = et0Serie.slice(-3);
    const et0Promedio = et0Vals.length ? et0Vals.reduce((a, b) => a + b, 0) / et0Vals.length : et0Api;

    const precipSerie: number[] = (historico?.daily?.precipitation_sum || []).filter(
      (v: number | null) => v !== null
    );
    const precipitacionSemanalMm = precipSerie.length ? precipSerie.reduce((a, b) => a + b, 0) : precipitacionHoy;

    return {
      tempMax,
      hr,
      viento,
      precipitacionHoy,
      et0Promedio,
      precipitacionSemanalMm,
      periodo: { desde: fechaDesde, hasta: fechaHasta, dias: DIAS_VENTANA },
    };
  } catch {
    return {
      tempMax: 20,
      hr: 60,
      viento: 2,
      precipitacionHoy: 0,
      et0Promedio: 4.0,
      precipitacionSemanalMm: 0,
      periodo: { desde: fechaDesde, hasta: fechaHasta, dias: DIAS_VENTANA },
    };
  }
}
