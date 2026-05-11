import type { Feature } from "geojson";

export interface Equipo {
  id: string;
  codigo: number;
  nombre: string;
  descripcion: string;
  created_at: string;
}

export interface Sector {
  id: string;
  codigo: string;
  equipo_id: string;
  numero: number;
  descripcion: string;
  caudal_nominal: number | null;
  hectareas: number | null;
  variedad: string;
  caseta: string;
  bomba: string;
  filtro: string;
  anio: number | null;
  jefe_campo: string;
  especie: string;
  precipitacion: number | null;
  eficiencia: number | null;
  dist_entre_hilera: number | null;
  dist_entre_plantas: number | null;
  dist_entre_goteros: number | null;
  num_lineas: number | null;
  caudal_emisor: number | null;
  m3_ha: number | null;
  created_at: string;
  equipo?: Equipo;
}

export interface Cuartel {
  id: string;
  nombre: string;
  especie: string;
  variedad: string;
  anio_plantacion: number | null;
  superficie_ha: number | null;
  plantas: number | null;
  polinizante: string;
  jefe_campo: string;
  centro_costo: string;
  equipo_riego: string;
  sector_raw: string;
  sector_ids: string[];
  sectores?: Sector[];
  geojson?: Feature;
  created_at: string;
  updated_at: string;
}

export interface Edificacion {
  id: string;
  nombre: string;
  equipo_riego: string;
  sector_riego: string;
  geojson?: Feature;
}

export type EspecieColor = {
  especie: string;
  color: string;
};

export interface FiltrosCuartel {
  especie: string;
  variedad: string;
  anioDesde: number | null;
  anioHasta: number | null;
  equipo: string;
  sector: string;
  jefeCampo: string;
}
