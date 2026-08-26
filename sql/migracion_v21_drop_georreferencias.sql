-- ============================================================
-- MAPA SIRACUSA 2025 - Migracion v21: Eliminar tabla georreferencias
-- Esta tabla ya no se usa desde que se quito el overlay de plano
-- ============================================================

DROP TABLE IF EXISTS georreferencias;
