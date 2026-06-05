-- ============================================================
-- MAPA SIRACUSA 2025 - Migración v4: RPC para sync sectores
-- Bypass RLS en cuartel_sector (INSERT blocked by RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION set_cuartel_sectores(
  p_cuartel_id UUID,
  p_sector_ids UUID[]
) RETURNS TABLE(
  equipo_riego TEXT,
  sector_raw   TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_equipo_riego TEXT;
  v_sector_raw   TEXT;
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

    -- 4. Compute equipo_riego and sector_raw
    SELECT
      COALESCE(
        (SELECT string_agg(DISTINCT eq.codigo::TEXT, ' - ' ORDER BY eq.codigo::TEXT)
         FROM sectores s
         JOIN equipos eq ON eq.id = s.equipo_id
         WHERE s.id = ANY(p_sector_ids)),
        ''
      ),
      COALESCE(
        (SELECT string_agg(DISTINCT regexp_replace(s.codigo, '\D', '', 'g'), ' - ' ORDER BY regexp_replace(s.codigo, '\D', '', 'g'))
         FROM sectores s
         WHERE s.id = ANY(p_sector_ids)),
        ''
      )
    INTO v_equipo_riego, v_sector_raw;
  ELSE
    v_equipo_riego := NULL;
    v_sector_raw := NULL;
  END IF;

  -- 5. Update cuartel text fields
  UPDATE cuarteles
  SET equipo_riego = v_equipo_riego,
      sector_raw = v_sector_raw,
      updated_at = now()
  WHERE id = p_cuartel_id;

  RETURN QUERY SELECT v_equipo_riego, v_sector_raw;
END;
$$;
