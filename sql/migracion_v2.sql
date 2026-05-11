-- ============================================================
-- MAPA SIRACUSA - Migración v2 (ejecutar en SQL Editor)
-- Agrega las columnas del consolidado de riego a la tabla sectores
-- ============================================================

ALTER TABLE sectores
  ADD COLUMN caudal_nominal NUMERIC(10,2),
  ADD COLUMN hectareas NUMERIC(10,2),
  ADD COLUMN variedad TEXT,
  ADD COLUMN caseta TEXT,
  ADD COLUMN bomba TEXT,
  ADD COLUMN filtro TEXT,
  ADD COLUMN anio INTEGER,
  ADD COLUMN jefe_campo TEXT,
  ADD COLUMN especie TEXT,
  ADD COLUMN precipitacion NUMERIC(5,2),
  ADD COLUMN eficiencia NUMERIC(5,2),
  ADD COLUMN dist_entre_hilera NUMERIC(5,2),
  ADD COLUMN dist_entre_plantas NUMERIC(5,2),
  ADD COLUMN dist_entre_goteros NUMERIC(5,2),
  ADD COLUMN num_lineas INTEGER,
  ADD COLUMN caudal_emisor NUMERIC(5,2),
  ADD COLUMN m3_ha NUMERIC(10,2);
