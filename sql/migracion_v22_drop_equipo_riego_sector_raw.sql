-- ============================================================
-- MAPA SIRACUSA 2025 - Migracion v22: Eliminar equipo_riego y sector_raw
-- Estos campos se reemplazan por la relacion cuartel_sector
-- ============================================================

-- 1. Actualizar get_cuarteles_con_sectores para quitar los campos eliminados
CREATE OR REPLACE FUNCTION get_cuarteles_con_sectores()
RETURNS TABLE(
  id UUID,
  nombre TEXT,
  especie TEXT,
  variedad TEXT,
  anio_plantacion INTEGER,
  superficie_ha NUMERIC,
  plantas INTEGER,
  polinizante TEXT,
  jefe_campo TEXT,
  centro_costo TEXT,
  sector_ids JSONB,
  geojson JSONB
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.nombre, c.especie, c.variedad,
    c.anio_plantacion, c.superficie_ha, c.plantas,
    c.polinizante, c.jefe_campo, c.centro_costo,
    COALESCE(
      (SELECT jsonb_agg(cs.sector_id)
       FROM cuartel_sector cs WHERE cs.cuartel_id = c.id),
      '[]'::jsonb
    ) AS sector_ids,
    ST_AsGeoJSON(c.geometria)::jsonb AS geojson
  FROM cuarteles c;
END;
$$;

-- 2. Actualizar set_cuartel_sectores para quitar la computacion de equipo_riego/sector_raw
CREATE OR REPLACE FUNCTION set_cuartel_sectores(
  p_cuartel_id UUID,
  p_sector_ids UUID[]
) RETURNS TABLE(
  result TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Delete old relations
  DELETE FROM cuartel_sector WHERE cuartel_id = p_cuartel_id;

  -- 2. Insert new relations
  IF array_length(p_sector_ids, 1) > 0 THEN
    INSERT INTO cuartel_sector (cuartel_id, sector_id)
    SELECT p_cuartel_id, unnest(p_sector_ids);

    -- 3. Init unidad de riego for each (copy geometry, set codigo)
    PERFORM init_unidad_riego(p_cuartel_id, s_id)
    FROM unnest(p_sector_ids) AS s_id;
  END IF;

  -- 4. Update timestamp
  UPDATE cuarteles SET updated_at = now() WHERE id = p_cuartel_id;

  RETURN QUERY SELECT 'OK'::TEXT;
END;
$$;
