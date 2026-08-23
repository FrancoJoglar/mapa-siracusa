-- ============================================================
-- MAPA SIRACUSA 2025 - Migracion v19
-- Corrige el reparto del cuartel C 601 segun la medicion de campo.
-- El vinculo Eq16 S2 ya existia pero con porcentaje en NULL.
-- Reparto correcto (planilla): S2=34.7%, S3=48.74%, S5=16.48% (=99.92%).
-- ============================================================

UPDATE cuartel_sector cs SET porcentaje_agua = 34.70
  FROM cuarteles c, sectores s, equipos e
  WHERE cs.cuartel_id = c.id AND cs.sector_id = s.id AND s.equipo_id = e.id
    AND c.nombre = 'C 601' AND e.codigo = 16 AND s.numero = 2;
UPDATE cuartel_sector cs SET porcentaje_agua = 48.74
  FROM cuarteles c, sectores s, equipos e
  WHERE cs.cuartel_id = c.id AND cs.sector_id = s.id AND s.equipo_id = e.id
    AND c.nombre = 'C 601' AND e.codigo = 16 AND s.numero = 3;
UPDATE cuartel_sector cs SET porcentaje_agua = 16.48
  FROM cuarteles c, sectores s, equipos e
  WHERE cs.cuartel_id = c.id AND cs.sector_id = s.id AND s.equipo_id = e.id
    AND c.nombre = 'C 601' AND e.codigo = 16 AND s.numero = 5;
