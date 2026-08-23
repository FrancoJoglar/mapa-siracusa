-- ============================================================
-- MAPA SIRACUSA 2025 - Migracion v14
-- Denormalizacion: caseta, bomba y filtro son atributos del EQUIPO,
-- no del sector. Estaban repetidos en cada sector, lo que permitio
-- que se cargaran valores distintos por sector (equipos 5,6,10,11).
--
-- Regla acordada: usar el valor del sector numero=1 de cada equipo.
-- (Los 25 equipos tienen sector 1, no hace falta fallback.)
--
-- Aplicar en el SQL Editor de Supabase (o via Management API).
-- ============================================================

-- 1. Agregar las columnas a equipos
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS caseta TEXT;
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS bomba  TEXT;
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS filtro TEXT;

-- 2. Poblar cada equipo con los valores de su sector 1
UPDATE equipos e SET
  caseta = s.caseta,
  bomba  = s.bomba,
  filtro = s.filtro
FROM sectores s
WHERE s.equipo_id = e.id AND s.numero = 1;

-- 3. Recrear el RPC del mapa para que lea bomba/filtro desde el equipo
--    (misma firma de retorno, cambia s.bomba/s.filtro -> e.bomba/e.filtro)
CREATE OR REPLACE FUNCTION public.get_sectores_geojson()
 RETURNS TABLE(id uuid, codigo text, numero integer, especie text, variedad text, equipo text, hectareas numeric, jefe_campo text, anio integer, bomba text, filtro text, caudal_nominal numeric, geojson jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.codigo, s.numero, s.especie, s.variedad,
    e.nombre AS equipo,
    s.hectareas, s.jefe_campo, s.anio, e.bomba, e.filtro,
    s.caudal_nominal,
    ST_AsGeoJSON(s.geometria)::jsonb AS geojson
  FROM sectores s
  JOIN equipos e ON e.id = s.equipo_id
  WHERE s.geometria IS NOT NULL;
END;
$function$;

-- 4. Eliminar las columnas duplicadas de sectores
ALTER TABLE sectores DROP COLUMN IF EXISTS caseta;
ALTER TABLE sectores DROP COLUMN IF EXISTS bomba;
ALTER TABLE sectores DROP COLUMN IF EXISTS filtro;
