-- ============================================================
-- MAPA SIRACUSA 2025 - Migracion v15
-- Estructura para bombas como activos fisicos.
-- Un equipo tiene N bombas; un sector usa 1..4 de ellas (N:N).
-- La disposicion (serie/paralelo/mixta) es por sector.
-- Una bomba puede tener funcion especial (riego / control de heladas).
--
-- equipos.bomba (texto) se conserva como referencia hasta que el
-- inventario estructurado este cargado y verificado; luego se elimina.
-- ============================================================

-- 1. Inventario de bombas (una fila por bomba fisica)
CREATE TABLE IF NOT EXISTS bombas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id    UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  marca        TEXT,
  modelo       TEXT,
  potencia_hp  NUMERIC,
  caudal_m3h   NUMERIC,
  funcion      TEXT NOT NULL DEFAULT 'riego' CHECK (funcion IN ('riego','helada')),
  orden        INTEGER,
  revisar      BOOLEAN NOT NULL DEFAULT false,  -- true = inferida del texto, verificar
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bombas_equipo ON bombas(equipo_id);

ALTER TABLE bombas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura bombas" ON bombas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "escritura bombas" ON bombas FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "actualizacion bombas" ON bombas FOR UPDATE USING (is_admin());
CREATE POLICY "eliminacion bombas" ON bombas FOR DELETE USING (is_admin());

-- 2. Relacion N:N sector <-> bombas (que bombas usa cada sector)
CREATE TABLE IF NOT EXISTS sector_bombas (
  sector_id UUID NOT NULL REFERENCES sectores(id) ON DELETE CASCADE,
  bomba_id  UUID NOT NULL REFERENCES bombas(id) ON DELETE CASCADE,
  PRIMARY KEY (sector_id, bomba_id)
);
CREATE INDEX IF NOT EXISTS idx_sector_bombas_bomba ON sector_bombas(bomba_id);

ALTER TABLE sector_bombas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura sector_bombas" ON sector_bombas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "escritura sector_bombas" ON sector_bombas FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "eliminacion sector_bombas" ON sector_bombas FOR DELETE USING (is_admin());

-- 3. Disposicion de las bombas en cada sector
ALTER TABLE sectores ADD COLUMN IF NOT EXISTS config_bombas TEXT
  CHECK (config_bombas IN ('serie','paralelo','mixta'));
