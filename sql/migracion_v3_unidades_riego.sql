-- ============================================================
-- MAPA SIRACUSA 2025 - Migración v3: Unidades de Riego
-- Ejecutar en Supabase SQL Editor después de v1 + v2
-- ============================================================

-- 1. Columnas nuevas en cuartel_sector
ALTER TABLE cuartel_sector
  ADD COLUMN IF NOT EXISTS codigo          TEXT,
  ADD COLUMN IF NOT EXISTS geometria       GEOMETRY(POLYGON, 4326),
  ADD COLUMN IF NOT EXISTS porcentaje_agua NUMERIC(5,2);

-- 2. Poblar filas existentes: código + copiar geometría del cuartel
UPDATE cuartel_sector cs
SET codigo = c.nombre || '-' || s.codigo,
    geometria = c.geometria
FROM cuarteles c, sectores s
WHERE cs.cuartel_id = c.id AND cs.sector_id = s.id
  AND cs.geometria IS NULL;

-- 3. RPC: obtener unidades de riego como GeoJSON para el mapa
CREATE OR REPLACE FUNCTION get_unidades_riego_geojson()
RETURNS TABLE(
  id              TEXT,
  codigo          TEXT,
  cuartel_id      UUID,
  cuartel_nombre  TEXT,
  sector_id       UUID,
  sector_codigo   TEXT,
  especie         TEXT,
  porcentaje_agua NUMERIC,
  geojson         JSONB
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.cuartel_id::TEXT || '-' || cs.sector_id::TEXT,
    cs.codigo,
    cs.cuartel_id,
    c.nombre,
    cs.sector_id,
    s.codigo,
    c.especie,
    cs.porcentaje_agua,
    ST_AsGeoJSON(cs.geometria)::jsonb
  FROM cuartel_sector cs
  JOIN cuarteles c ON c.id = cs.cuartel_id
  JOIN sectores s ON s.id = cs.sector_id
  WHERE cs.geometria IS NOT NULL;
END;
$$;

-- 4. RPC: inicializar unidad cuando se asigna un sector a un cuartel
CREATE OR REPLACE FUNCTION init_unidad_riego(
  p_cuartel_id UUID,
  p_sector_id  UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE cuartel_sector
  SET codigo = (SELECT nombre FROM cuarteles WHERE id = p_cuartel_id) || '-' ||
               (SELECT codigo FROM sectores WHERE id = p_sector_id),
      geometria = (SELECT geometria FROM cuarteles WHERE id = p_cuartel_id)
  WHERE cuartel_id = p_cuartel_id AND sector_id = p_sector_id;
END;
$$;

-- 5. RPC: actualizar geometría de una unidad de riego
CREATE OR REPLACE FUNCTION update_unidad_geometria(
  p_cuartel_id UUID,
  p_sector_id  UUID,
  p_geojson    JSONB
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE cuartel_sector
  SET geometria = ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326)
  WHERE cuartel_id = p_cuartel_id AND sector_id = p_sector_id;
END;
$$;
