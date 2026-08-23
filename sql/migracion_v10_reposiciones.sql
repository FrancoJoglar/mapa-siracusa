-- ============================================================
-- MAPA SIRACUSA 2025 - Migración v10
-- Historial de reposición de riego (módulo Riego)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE reposiciones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
  sector_id           UUID NOT NULL REFERENCES sectores(id) ON DELETE CASCADE,
  periodo_desde       DATE NOT NULL,
  periodo_hasta       DATE NOT NULL,
  et0_promedio        NUMERIC(6,2) NOT NULL,
  precipitacion_mm    NUMERIC(6,2) NOT NULL,
  kc_base             NUMERIC(4,3) NOT NULL,
  kc_ajustado         NUMERIC(4,3) NOT NULL,
  etc_semanal_mm      NUMERIC(6,2) NOT NULL,
  reposicion_mm       NUMERIC(6,2) NOT NULL,
  volumen_m3          NUMERIC(10,2) NOT NULL,
  accion              TEXT NOT NULL CHECK (accion IN ('REGAR', 'MONITOREAR', 'SIN_REGAR')),
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sector_id, fecha)
);

CREATE INDEX idx_reposiciones_fecha ON reposiciones(fecha DESC);
CREATE INDEX idx_reposiciones_sector ON reposiciones(sector_id);

ALTER TABLE reposiciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select" ON reposiciones FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON reposiciones FOR INSERT WITH CHECK (true);

-- Vista: última reposición calculada por sector (para el dashboard)
CREATE VIEW reposiciones_ultima AS
SELECT DISTINCT ON (sector_id) *
FROM reposiciones
ORDER BY sector_id, fecha DESC;
