import type { Feature } from "geojson";

export interface Equipo {
  id: string;
  codigo: number;
  nombre: string;
  descripcion: string;
  plano_url?: string;
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

export interface SectorGeo {
  id: string;
  codigo: string;
  numero: number;
  especie: string;
  equipo: string;
  hectareas: number | null;
  jefe_campo: string;
  anio: number | null;
  bomba: string;
  filtro: string;
  caudal_nominal: number | null;
  geojson?: Feature;
}

export interface UnidadRiego {
  id: string;
  codigo: string;
  cuartel_id: string;
  cuartel_nombre: string;
  sector_id: string;
  sector_codigo: string;
  especie: string;
  porcentaje_agua: number | null;
  geojson?: Feature;
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

export interface Tuberia {
  id: string;
  codigo: string;
  equipo_id: string;
  nivel: string;
  nombre: string;
  material: string;
  diametro_mm: number | null;
  geojson?: Feature;
  created_at: string;
}

export interface Valvula {
  id: string;
  codigo: string;
  tuberia_id: string;
  tipo: string;
  diametro_mm: number | null;
  color?: string;
  geojson?: Feature;
  created_at: string;
}

export interface Antena {
  id: string;
  codigo: string;
  tipo: string;
  geojson?: Feature;
  created_at: string;
}

export interface Sonda {
  id: string;
  codigo: string;
  tipo: string;
  profundidad_m: number | null;
  geojson?: Feature;
  created_at: string;
}

export interface Georreferencia {
  id: string;
  equipo_id: string;
  bounds: { sw: [number, number]; ne: [number, number] };
  rotation: number;
  opacity: number;
  created_at: string;
  updated_at: string;
}
