-- ============================================================
-- MAPA SIRACUSA 2025 - Migracion v13
-- Corrige dos huecos sistemicos encontrados al comparar la base
-- contra la planilla real del campo:
--   1. jefe_campo estaba vacio en el 100% de los sectores (124/124)
--   2. m3_ha era NULL en el 100% de los sectores (124/124)
-- Fuente: planilla de campo (tabla_referencia.tsv), confirmada por
-- Franco como version correcta para estos dos campos.
-- ============================================================

UPDATE sectores s SET
  jefe_campo = u.jefe_campo,
  m3_ha = u.m3_ha
FROM (VALUES
  (1,1,'David',9.3),(1,2,'David',9.3),(1,3,'David',9.3),(1,4,'David',9.3),(1,5,'David',9.3),(2,1,'Benito',9.3),(2,2,'Benito',9.3),(2,3,'Benito/david',9.3),(2,4,'David',9.3),(2,5,'David',9.3),(3,1,'David',9.2),(3,2,'David',9.3),(3,3,'Gonzalo',19.0),(3,4,'Gonzalo',18.8),(3,5,'David',9.3),(4,1,'David',9.2),(4,2,'David',9.3),(4,3,'David',9.3),(4,4,'David',9.3),(4,5,'David',9.3),(5,1,'Gonzalo',19.1),(5,2,'Gonzalo',19.0),(5,3,'Gonzalo',19.0),(5,4,'Gonzalo',19.0),(5,5,'Benito',9.2),(6,1,'Benito',9.2),(6,2,'Benito',9.2),(6,3,'Gonzalo',19.0),(6,4,'Gonzalo',19.1),(6,5,'Gonzalo',18.8),(7,1,'David',8.9),(7,2,'David',8.9),(7,3,'David',8.9),(7,4,'David',8.9),(7,5,'David',8.9),(9,1,'Moises',6.7),(9,2,'Moises',6.7),(9,3,'Moises',6.7),(9,4,'Moises',6.7),(10,1,'Benito',9.3),(10,2,'Gonzalo',18.4),(10,3,'Benito',9.3),(10,4,'Benito',9.3),(10,6,'Gonzalo',18.4),(11,1,'Benito',9.3),(11,2,'Benito',9.3),(11,3,'Benito',9.3),(11,4,'Benito',9.3),(11,5,'Benito',9.3),(12,1,'Gonzalo',18.4),(12,2,'Gonzalo',18.4),(12,3,'Gonzalo',18.4),(12,5,'Moises',9.2),(12,6,'Gonzalo',18.4),(12,7,'Gonzalo',18.4),(12,8,'Gonzalo',18.4),(13,1,'Gonzalo',15.3),(13,2,'Moises',9.2),(13,3,'Moises',9.2),(13,4,'Moises',9.2),(13,5,'Moises',9.2),(13,6,'Gonzalo',15.3),(14,1,'Moises',9.2),(14,2,'Moises',9.2),(14,5,'Moises',9.1),(15,1,'Moises',9.4),(15,2,NULL,19.7),(15,3,'Moises',9.4),(15,4,NULL,19.6),(15,5,'Moises',9.2),(15,6,NULL,19.8),(16,1,'Moises',9.2),(16,2,'Moises',9.2),(16,3,'Moises',9.2),(16,4,NULL,19.8),(16,5,'Moises',9.2),(17,1,'Moises',9.2),(17,2,'Moises',9.2),(17,3,'Daniel',17.8),(17,4,'Daniel',17.8),(17,5,'Moises',9.2),(18,1,'Marco',20.0),(18,2,'Daniel',17.8),(18,3,'Marco',20.0),(18,4,'Marco',20.0),(18,5,'Marco',20.0),(19,1,'Benito',9.3),(19,2,'Gonzalo',18.4),(19,3,'Benito',9.3),(19,4,'Benito',9.2),(19,5,'Benito',9.2),(19,6,'Gonzalo',18.4),(20,1,'Marco',17.8),(20,2,'Marco',17.8),(20,3,'Marco',17.8),(20,4,'Marco',17.8),(21,1,'Daniel',17.8),(21,2,'Daniel',17.8),(21,3,'Daniel',17.8),(21,4,'Daniel',17.8),(22,1,'Gonzalo',15.3),(22,2,'Gonzalo',15.3),(22,3,'Gonzalo',15.3),(22,4,'Marco',19.2),(22,5,'Marco',19.2),(23,1,'Gonzalo',19.2),(23,2,'Gonzalo',19.0),(23,3,'Gonzalo',19.0),(23,4,'Gonzalo',18.9),(23,5,'Gonzalo',19.2),(24,1,'Gonzalo',18.9),(24,2,'Gonzalo',18.9),(24,3,'Gonzalo',19.1),(24,4,'Gonzalo',19.0),(24,5,'Gonzalo',19.1),(25,1,'Gonzalo',19.0),(25,2,'Gonzalo',19.0),(25,3,'Gonzalo',18.8),(25,4,'Gonzalo',19.3),(25,5,'Gonzalo',19.0),(26,1,'Moises',22.3),(26,2,'Moises',22.1),(26,3,'Moises',22.0),(26,4,'Moises',21.9)
) AS u(equipo, sector, jefe_campo, m3_ha)
WHERE s.numero = u.sector
  AND s.equipo_id = (SELECT id FROM equipos WHERE codigo = u.equipo);

-- Correcciones puntuales confirmadas por Franco (no todas las diferencias
-- encontradas se resuelven a favor de la planilla - caso por caso):

-- Equipo 1 Sector 1: caudal_nominal tenia un valor placeholder (99999)
UPDATE sectores s SET caudal_nominal = 158
FROM equipos e WHERE e.id = s.equipo_id AND e.codigo = 1 AND s.numero = 1;

-- Equipo 12: filtro real es 3"x10 Spin Klin (la base tenia 3"x6 mal cargado
-- para los 6 sectores)
UPDATE sectores s SET filtro = '3"x10 Spin Klin'
FROM equipos e WHERE e.id = s.equipo_id AND e.codigo = 12;

-- Equipo 15 Sector 4: año de plantacion real es 2024 (ni la base -2026-
-- ni la planilla -2009- tenian el valor correcto)
UPDATE sectores s SET anio = 2024
FROM equipos e WHERE e.id = s.equipo_id AND e.codigo = 15 AND s.numero = 4;

-- Equipo 16 Sector 1: hectareas real es 11.49 (la base tenia 9.57)
UPDATE sectores s SET hectareas = 11.49
FROM equipos e WHERE e.id = s.equipo_id AND e.codigo = 16 AND s.numero = 1;

-- Equipo 2: bomba real es "2x Vogt N640 30HP" - la base ya tenia el valor
-- correcto, la planilla estaba desactualizada. Sin cambios (documentado
-- para que quede registrado por que no se toco).
