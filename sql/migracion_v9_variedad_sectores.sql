-- Migracion v9: Agregar columna variedad a sectores y poblar datos
-- YA EJECUTADO via REST API PATCH con service_role key (121 registros actualizados)

-- 1. Agregar columna variedad (si no existe)
ALTER TABLE sectores ADD COLUMN IF NOT EXISTS variedad TEXT;

COMMENT ON COLUMN sectores.variedad IS 'Variedad especifica del cultivo (Arbequina, Giffoni, Santina, etc.)';

-- 2. Verificar datos actualizados
SELECT e.codigo as equipo, s.numero, ROUND(s.hectareas::numeric,2) as has, s.especie, s.variedad,
  s.dist_entre_hilera as dist_h, s.dist_entre_plantas as dist_p
FROM sectores s JOIN equipos e ON e.id = s.equipo_id
ORDER BY e.codigo, s.numero;
