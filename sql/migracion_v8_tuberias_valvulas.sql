-- ============================================================
-- MAPA SIRACUSA 2025 - Migración v8: Tuberías y Válvulas
-- Crea tablas para matrices/submatrices de riego
-- ============================================================

-- 1. TUBERÍAS (cada fila = un segmento LINESTRING)
CREATE TABLE IF NOT EXISTS tuberias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  equipo_id UUID REFERENCES equipos(id) ON DELETE RESTRICT,
  nivel TEXT NOT NULL CHECK (nivel IN ('matriz', 'submatriz')),
  nombre TEXT,
  material TEXT,
  diametro_mm NUMERIC,
  geometria GEOMETRY(LINESTRING, 4326),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. VÁLVULAS (puntos sobre las tuberías)
CREATE TABLE IF NOT EXISTS valvulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  tuberia_id UUID REFERENCES tuberias(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('transicion', 'purga', 'aire', 'compuerta', 'otro')),
  diametro_mm NUMERIC,
  geometria GEOMETRY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS
ALTER TABLE tuberias ENABLE ROW LEVEL SECURITY;
ALTER TABLE valvulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lectura tuberias" ON tuberias FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "escritura tuberias" ON tuberias FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "actualizacion tuberias" ON tuberias FOR UPDATE USING (is_admin());
CREATE POLICY "eliminacion tuberias" ON tuberias FOR DELETE USING (is_admin());

CREATE POLICY "lectura valvulas" ON valvulas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "escritura valvulas" ON valvulas FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "actualizacion valvulas" ON valvulas FOR UPDATE USING (is_admin());
CREATE POLICY "eliminacion valvulas" ON valvulas FOR DELETE USING (is_admin());

-- 4. RPC para forzar 2D en geometrías
CREATE OR REPLACE FUNCTION update_tuberia_geom(p_id UUID, p_geojson JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo admin puede modificar geometrias'; END IF;
  UPDATE tuberias SET geometria = ST_Force2D(ST_GeomFromGeoJSON(p_geojson::text)) WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_valvula_geom(p_id UUID, p_geojson JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Solo admin puede modificar geometrias'; END IF;
  UPDATE valvulas SET geometria = ST_Force2D(ST_GeomFromGeoJSON(p_geojson::text)) WHERE id = p_id;
END;
$$;
