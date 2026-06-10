-- ============================================================
-- MAPA SIRACUSA 2025 - Migración v5: Remover variedad de sectores
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Recrear RPC get_sectores_geojson sin el campo variedad
DROP FUNCTION IF EXISTS get_sectores_geojson;

CREATE OR REPLACE FUNCTION get_sectores_geojson()
RETURNS TABLE(
  id UUID,
  codigo TEXT,
  numero INTEGER,
  especie TEXT,
  equipo TEXT,
  hectareas NUMERIC,
  jefe_campo TEXT,
  anio INTEGER,
  bomba TEXT,
  filtro TEXT,
  caudal_nominal NUMERIC,
  geojson JSONB
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.codigo, s.numero, s.especie,
    eq.nombre AS equipo,
    s.hectareas, s.jefe_campo, s.anio,
    s.bomba, s.filtro, s.caudal_nominal,
    ST_AsGeoJSON(s.geometria)::jsonb AS geojson
  FROM sectores s
  JOIN equipos eq ON eq.id = s.equipo_id
  WHERE s.geometria IS NOT NULL;
END;
$$;

-- 2. Remover la columna variedad de sectores
ALTER TABLE sectores DROP COLUMN IF EXISTS variedad;
