-- Migracion v10: Agregar equipo_id y color a antenas y sondas
-- Ejecutar en el SQL Editor de Supabase (una sola vez)

-- Antenas
ALTER TABLE antenas ADD COLUMN IF NOT EXISTS equipo_id UUID REFERENCES equipos(id) ON DELETE CASCADE;
ALTER TABLE antenas ADD COLUMN IF NOT EXISTS color TEXT;

-- Sondas
ALTER TABLE sondas ADD COLUMN IF NOT EXISTS equipo_id UUID REFERENCES equipos(id) ON DELETE CASCADE;
ALTER TABLE sondas ADD COLUMN IF NOT EXISTS color TEXT;

-- Crear indices para filtrar por equipo
CREATE INDEX IF NOT EXISTS idx_antenas_equipo_id ON antenas(equipo_id);
CREATE INDEX IF NOT EXISTS idx_sondas_equipo_id ON sondas(equipo_id);

-- Verificar
SELECT 'antenas' as tabla, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('antenas', 'sondas')
  AND column_name IN ('equipo_id', 'color')
ORDER BY table_name, column_name;
