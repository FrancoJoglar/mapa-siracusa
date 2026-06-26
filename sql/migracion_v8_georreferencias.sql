-- ============================================================
-- MAPA SIRACUSA 2025 - Migración v8: Georreferencias
-- ============================================================
CREATE TABLE IF NOT EXISTS georreferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id UUID REFERENCES equipos(id) ON DELETE CASCADE,
  bounds JSONB NOT NULL,
  rotation INTEGER DEFAULT 0,
  opacity REAL DEFAULT 0.6,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE georreferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "lectura georreferencias" ON georreferencias FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "escritura georreferencias" ON georreferencias FOR INSERT WITH CHECK (is_admin());
CREATE POLICY IF NOT EXISTS "actualizacion georreferencias" ON georreferencias FOR UPDATE USING (is_admin());
