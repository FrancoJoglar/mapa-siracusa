-- ============================================================
-- MAPA SIRACUSA 2025 - Migracion v18
-- Sincroniza superficies y porcentajes de cuarteles con la medicion
-- de campo (planilla Comprobacion datos.ods, Hoja3).
--
-- Solo cambios seguros:
--  - 3 superficies de cuartel que difieren (diferencias menores de conteo).
--  - 2 cuarteles con % de reparto ajustado (siguen sumando 100%).
-- NO se tocan los cuarteles con superficie 0 en la planilla (plantaciones
-- nuevas sin medir), para no pisar valores existentes.
-- PENDIENTE (estructural, no incluido): CC 601 se reparte en 3 sectores en
-- la planilla (Eq16 S2/S3/S5) pero en 2 en la BD (S3/S5). Requiere agregar
-- el vinculo Eq16 S2 y recalcular, se decide aparte.
-- ============================================================

-- Superficies de cuartel (Has CC medida)
UPDATE cuarteles SET superficie_ha = 3.38 WHERE nombre = 'C 120';
UPDATE cuarteles SET superficie_ha = 10.09 WHERE nombre = 'C 114';
UPDATE cuarteles SET superficie_ha = 5.44 WHERE nombre = 'C 101';

-- Porcentajes de reparto (ajustes que mantienen el 100%)
UPDATE cuartel_sector cs SET porcentaje_agua = 45.0
  FROM cuarteles c, sectores s, equipos e
  WHERE cs.cuartel_id = c.id AND cs.sector_id = s.id AND s.equipo_id = e.id
    AND c.nombre = 'C 150' AND e.codigo = 3 AND s.numero = 3;
UPDATE cuartel_sector cs SET porcentaje_agua = 55.0
  FROM cuarteles c, sectores s, equipos e
  WHERE cs.cuartel_id = c.id AND cs.sector_id = s.id AND s.equipo_id = e.id
    AND c.nombre = 'C 150' AND e.codigo = 3 AND s.numero = 4;
UPDATE cuartel_sector cs SET porcentaje_agua = 20.5
  FROM cuarteles c, sectores s, equipos e
  WHERE cs.cuartel_id = c.id AND cs.sector_id = s.id AND s.equipo_id = e.id
    AND c.nombre = 'C 610' AND e.codigo = 13 AND s.numero = 1;
UPDATE cuartel_sector cs SET porcentaje_agua = 79.5
  FROM cuarteles c, sectores s, equipos e
  WHERE cs.cuartel_id = c.id AND cs.sector_id = s.id AND s.equipo_id = e.id
    AND c.nombre = 'C 610' AND e.codigo = 13 AND s.numero = 6;
