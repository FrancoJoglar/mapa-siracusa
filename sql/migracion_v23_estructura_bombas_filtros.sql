-- ============================================================
-- MAPA SIRACUSA 2025 - Migracion v23
-- Bombas: campos nuevos + Filtros como entidad independiente
-- ============================================================

-- 1. Campos nuevos en bombas
ALTER TABLE bombas ADD COLUMN IF NOT EXISTS rodamientos TEXT;
ALTER TABLE bombas ADD COLUMN IF NOT EXISTS sello_mecanico TEXT;
ALTER TABLE bombas ADD COLUMN IF NOT EXISTS modelo_motor TEXT;
ALTER TABLE bombas ADD COLUMN IF NOT EXISTS rodete TEXT;
ALTER TABLE bombas ADD COLUMN IF NOT EXISTS tension TEXT;
ALTER TABLE bombas ADD COLUMN IF NOT EXISTS presion NUMERIC;

-- 2. Tabla filtros (entidad independiente)
CREATE TABLE IF NOT EXISTS filtros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  tipo TEXT,
  marca TEXT,
  modelo TEXT,
  valvulas_retrolavado TEXT,
  cantidad_cuerpos INTEGER,
  controlador_retrolavado TEXT,
  alimentacion_controlador TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_filtros_equipo ON filtros(equipo_id);
ALTER TABLE filtros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura filtros" ON filtros FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "escritura filtros" ON filtros FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "actualizacion filtros" ON filtros FOR UPDATE USING (is_admin());
CREATE POLICY "eliminacion filtros" ON filtros FOR DELETE USING (is_admin());

-- 3. Relacion N:N sector <-> filtros
CREATE TABLE IF NOT EXISTS sector_filtros (
  sector_id UUID NOT NULL REFERENCES sectores(id) ON DELETE CASCADE,
  filtro_id UUID NOT NULL REFERENCES filtros(id) ON DELETE CASCADE,
  PRIMARY KEY (sector_id, filtro_id)
);
CREATE INDEX IF NOT EXISTS idx_sector_filtros_filtro ON sector_filtros(filtro_id);
ALTER TABLE sector_filtros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura sector_filtros" ON sector_filtros FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "escritura sector_filtros" ON sector_filtros FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "eliminacion sector_filtros" ON sector_filtros FOR DELETE USING (is_admin());

-- 4. Asignar primera bomba de cada equipo a todos sus sectores
INSERT INTO sector_bombas (sector_id, bomba_id)
SELECT s.id, (
  SELECT b.id FROM bombas b
  WHERE b.equipo_id = s.equipo_id
  ORDER BY b.orden LIMIT 1
)
FROM sectores s
WHERE NOT EXISTS (
  SELECT 1 FROM sector_bombas sb WHERE sb.sector_id = s.id
);
