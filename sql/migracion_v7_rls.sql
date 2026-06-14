-- ============================================================
-- MAPA SIRACUSA 2025 - Migración v7: Cerrar RLS en UPDATE
-- Cambia: USING (true) → USING (is_admin()) en UPDATE policies
-- Rollback: Revertir cualquier cambio ejecutando el backup
-- ============================================================

-- Backup: Las políticas actuales se guardaron antes de ejecutar.

-- 1. Sectores
DROP POLICY IF EXISTS "anyone can update sectores" ON sectores;
CREATE POLICY "anyone can update sectores" ON sectores FOR UPDATE
  USING (is_admin());

-- 2. Cuarteles
DROP POLICY IF EXISTS "anyone can update cuarteles" ON cuarteles;
CREATE POLICY "anyone can update cuarteles" ON cuarteles FOR UPDATE
  USING (is_admin());

-- 3. cuartel_sector
DROP POLICY IF EXISTS "anyone can update cuartel_sector" ON cuartel_sector;
CREATE POLICY "anyone can update cuartel_sector" ON cuartel_sector FOR UPDATE
  USING (is_admin());

-- 4. Equipos
DROP POLICY IF EXISTS "anyone can update equipos" ON equipos;
CREATE POLICY "anyone can update equipos" ON equipos FOR UPDATE
  USING (is_admin());

-- 5. Edificaciones
DROP POLICY IF EXISTS "anyone can update edificaciones" ON edificaciones;
CREATE POLICY "anyone can update edificaciones" ON edificaciones FOR UPDATE
  USING (is_admin());

-- Seguridad adicional: Los RPCs SECURITY DEFINER bypassean RLS.
-- Si alguien llama update_sector_geom o update_cuartel_sector_geom
-- directamente desde la consola, puede modificar geometrías sin ser admin.
-- Para cerrar esto, se modificarán los RPCs.
