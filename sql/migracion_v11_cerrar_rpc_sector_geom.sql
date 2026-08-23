-- ============================================================
-- MAPA SIRACUSA 2025 - Migración v11
-- Cierra el hueco de seguridad documentado en migracion_v7_rls.sql:
-- "Si alguien llama update_sector_geom directamente desde la consola,
--  puede modificar geometrías sin ser admin."
--
-- Mismo patrón ya usado en migracion_v8_tuberias_valvulas.sql para
-- update_tuberia_geom / update_valvula_geom (IF NOT is_admin() THEN RAISE).
--
-- Ejecutar en el SQL Editor de Supabase.
-- Requiere que is_admin() ya exista y funcione correctamente — si la
-- auditoria (auditoria_seguridad_2026-08-22.sql) muestra que is_admin()
-- lee de user_metadata en vez de app_metadata, corregir eso PRIMERO.
-- ============================================================

CREATE OR REPLACE FUNCTION update_sector_geom(p_id UUID, p_geojson JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Solo admin puede modificar geometrias';
  END IF;

  UPDATE sectores SET geometria = ST_Force2D(ST_GeomFromGeoJSON(p_geojson::text))
  WHERE id = p_id;
END;
$$;
