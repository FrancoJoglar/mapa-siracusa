-- ============================================================
-- MAPA SIRACUSA 2025 - Migración inicial
-- Ejecutar en Supabase SQL Editor con PostGIS habilitado
-- ============================================================

-- 1. Habilitar PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Tabla: equipos de riego
CREATE TABLE equipos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      INTEGER NOT NULL UNIQUE,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;

-- 3. Tabla: sectores (nomenclatura E{equipo}S{sector})
CREATE TABLE sectores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      TEXT NOT NULL UNIQUE,
  equipo_id   UUID NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
  numero      INTEGER NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(equipo_id, numero)
);

ALTER TABLE sectores ENABLE ROW LEVEL SECURITY;

-- 4. Tabla: cuarteles
CREATE TABLE cuarteles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL UNIQUE,
  especie         TEXT,
  variedad        TEXT,
  anio_plantacion INTEGER,
  superficie_ha   NUMERIC(10,2),
  plantas         INTEGER,
  polinizante     TEXT,
  jefe_campo      TEXT,
  centro_costo    TEXT,
  equipo_riego    TEXT,
  sector_raw      TEXT,
  geometria       GEOMETRY(POLYGON, 4326),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cuarteles ENABLE ROW LEVEL SECURITY;

-- Índice espacial para queries geográficas
CREATE INDEX idx_cuarteles_geometria ON cuarteles USING GIST (geometria);

-- 5. Tabla: relación cuartel ↔ sector (N:M)
CREATE TABLE cuartel_sector (
  cuartel_id UUID REFERENCES cuarteles(id) ON DELETE CASCADE,
  sector_id  UUID REFERENCES sectores(id) ON DELETE CASCADE,
  PRIMARY KEY (cuartel_id, sector_id)
);

ALTER TABLE cuartel_sector ENABLE ROW LEVEL SECURITY;

-- 6. Tabla: edificaciones
CREATE TABLE edificaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  equipo_riego  TEXT,
  sector_riego  TEXT,
  geometria     GEOMETRY(POLYGON, 4326),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE edificaciones ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies (abiertas para desarrollo - ajustar con auth)
-- ============================================================
CREATE POLICY "Allow all select" ON equipos FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON equipos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON equipos FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON equipos FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON sectores FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON sectores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON sectores FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON sectores FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON cuarteles FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON cuarteles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON cuarteles FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON cuarteles FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON cuartel_sector FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON cuartel_sector FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON cuartel_sector FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON cuartel_sector FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON edificaciones FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON edificaciones FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON edificaciones FOR UPDATE USING (true);
CREATE POLICY "Allow all delete" ON edificaciones FOR DELETE USING (true);

-- ============================================================
-- Función helper: obtener cuarteles con sus sectores en GeoJSON
-- ============================================================
CREATE OR REPLACE FUNCTION get_cuarteles_con_sectores()
RETURNS TABLE(
  id UUID,
  nombre TEXT,
  especie TEXT,
  variedad TEXT,
  anio_plantacion INTEGER,
  superficie_ha NUMERIC,
  plantas INTEGER,
  polinizante TEXT,
  jefe_campo TEXT,
  centro_costo TEXT,
  equipo_riego TEXT,
  sector_raw TEXT,
  sector_ids JSONB,
  geojson JSONB
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.nombre, c.especie, c.variedad,
    c.anio_plantacion, c.superficie_ha, c.plantas,
    c.polinizante, c.jefe_campo, c.centro_costo,
    c.equipo_riego, c.sector_raw,
    COALESCE(
      (SELECT jsonb_agg(cs.sector_id)
       FROM cuartel_sector cs WHERE cs.cuartel_id = c.id),
      '[]'::jsonb
    ) AS sector_ids,
    ST_AsGeoJSON(c.geometria)::jsonb AS geojson
  FROM cuarteles c;
END;
$$;

-- Función helper: obtener edificaciones en GeoJSON
CREATE OR REPLACE FUNCTION get_edificaciones_geojson()
RETURNS TABLE(
  id UUID,
  nombre TEXT,
  equipo_riego TEXT,
  sector_riego TEXT,
  geojson JSONB
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.nombre, e.equipo_riego, e.sector_riego,
    ST_AsGeoJSON(e.geometria)::jsonb AS geojson
  FROM edificaciones e;
END;
$$;
