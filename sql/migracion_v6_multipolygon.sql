-- ============================================================
-- MAPA SIRACUSA 2025 - Migración v6: Permitir MultiPolygon
-- Cambia columnas geometria de POLYGON a GEOMETRY genérico
-- ============================================================

ALTER TABLE sectores ALTER COLUMN geometria TYPE geometry(Geometry, 4326);
ALTER TABLE cuarteles ALTER COLUMN geometria TYPE geometry(Geometry, 4326);
ALTER TABLE cuartel_sector ALTER COLUMN geometria TYPE geometry(Geometry, 4326);
ALTER TABLE edificaciones ALTER COLUMN geometria TYPE geometry(Geometry, 4326);
