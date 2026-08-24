-- ============================================================
-- MAPA SIRACUSA 2025 - Migracion v20: Campo activo en equipos
-- Permite desactivar un equipo para una temporada sin eliminarlo
-- ============================================================

-- 1. Agregar columna activo (default true = todos activos)
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

-- 2. Marcar todos los existentes como activos por defecto
UPDATE equipos SET activo = true WHERE activo IS NULL;

-- 3. Verificar
SELECT codigo, nombre, activo FROM equipos ORDER BY codigo;
