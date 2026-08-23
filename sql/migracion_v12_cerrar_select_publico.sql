-- ============================================================
-- MAPA SIRACUSA 2025 - Migración v12
-- Cierra el SELECT público (sin login) en sectores, cuarteles,
-- equipos, edificaciones y cuartel_sector.
-- Mismo patrón que ya usan tuberias/valvulas/antenas/sondas:
-- exigir auth.role() = 'authenticated' para leer.
-- ============================================================

DROP POLICY IF EXISTS "anyone can select sectores" ON sectores;
CREATE POLICY "lectura sectores" ON sectores
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "anyone can select cuarteles" ON cuarteles;
CREATE POLICY "lectura cuarteles" ON cuarteles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "anyone can select equipos" ON equipos;
CREATE POLICY "lectura equipos" ON equipos
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "anyone can select edificaciones" ON edificaciones;
CREATE POLICY "lectura edificaciones" ON edificaciones
  FOR SELECT USING (auth.role() = 'authenticated');

-- No estaba en el pedido original pero tiene exactamente el mismo problema
-- (SELECT abierto, qual: true) — la incluyo para no dejar el mismo hueco
-- a medio cerrar en la tabla que mapea cuarteles<->sectores.
DROP POLICY IF EXISTS "anyone can select cuartel_sector" ON cuartel_sector;
CREATE POLICY "lectura cuartel_sector" ON cuartel_sector
  FOR SELECT USING (auth.role() = 'authenticated');
