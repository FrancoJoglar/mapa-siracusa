-- Migracion v9: Agregar columna variedad a sectores y poblar datos
-- Ejecutar en el SQL Editor de Supabase

-- 1. Agregar columna variedad
ALTER TABLE sectores ADD COLUMN IF NOT EXISTS variedad TEXT;

-- 2. Poblar especie y variedad segun datos actualizados
UPDATE sectores s SET
  especie = CASE
    WHEN u.variedad IN ('Arbequina','Arbosana','Korinenki') THEN 'Olivo'
    WHEN u.variedad = 'Giffoni' THEN 'Avellano'
    WHEN u.variedad IN ('Santina','Lapins','Sweet Aryana','Pacific Red') THEN 'Cerezo'
    WHEN u.variedad = 'Hayward' THEN 'Kiwi'
    ELSE s.especie
  END,
  variedad = u.variedad,
  hectareas = u.hectareas,
  dist_entre_hilera = u.dist_hilera,
  dist_entre_plantas = u.dist_planta
FROM (VALUES
  (1,1,16.97,'Korinenki',3.8,2),(1,2,17.37,'Arbequina',3.8,1.8),(1,3,16.99,'Arbequina',3.8,1.8),(1,4,17.88,'Arbosana',3.8,1.5),(1,5,18.61,'Arbequina',3.8,1.8),
  (2,1,24.18,'Arbosana',3.8,1.5),(2,2,24.35,'Arbequina',3.8,1.8),(2,3,24.09,'Arbequina',3.8,1.8),(2,4,23.13,'Arbequina',3.8,1.8),(2,5,23.19,'Arbosana',3.8,1.5),
  (3,1,18.42,'Arbosana',3.5,1.3),(3,2,17.49,'Arbequina',3.8,1.8),(3,3,8.77,'Giffoni',5,2.5),(3,4,8.76,'Giffoni',5,2.5),(3,5,17.33,'Arbequina',3.8,1.8),
  (4,1,10.19,'Arbosana',3.5,1.3),(4,2,14.54,'Arbequina',3.8,1.8),(4,3,14.27,'Arbosana',3.8,1.5),(4,4,14.25,'Arbequina',3.8,1.8),(4,5,13.12,'Arbosana',3.8,1.5),
  (5,1,9.09,'Giffoni',5,2.5),(5,2,9.08,'Giffoni',5,2.5),(5,3,9.07,'Giffoni',5,2.5),(5,4,9.09,'Giffoni',5,2.5),(5,5,18.64,'Arbosana',3.5,1.3),
  (6,1,13.6,'Arbosana',3.5,1.3),(6,2,13.66,'Arbosana',3.5,1.3),(6,3,6.13,'Giffoni',5,2.5),(6,4,6.14,'Giffoni',5,2.5),(6,5,6.15,'Giffoni',5,2.5),
  (7,1,5.12,'Arbosana',3.8,1.5),(7,2,4.78,'Arbosana',3.8,1.5),(7,3,4.91,'Arbosana',3.8,1.5),(7,4,5.34,'Arbosana',3.8,1.5),(7,5,5.24,'Arbosana',3.8,1.5),
  (9,1,11.51,'Arbequina',6,4),(9,2,9.72,'Arbequina',6,4),(9,3,11.3,'Arbequina',6,4),(9,4,14.47,'Arbequina',6,4),
  (10,1,11.02,'Arbequina',3.8,1.5),(10,2,7.01,'Giffoni',5,3),(10,3,13.9,'Arbequina',3.8,1.5),(10,4,12.82,'Arbosana',3.8,1.3),(10,6,6.2,'Giffoni',5,3),
  (11,1,13.44,'Arbosana',3.8,1.3),(11,2,11.87,'Arbequina',3.8,1.5),(11,3,12.14,'Arbosana',3.8,1.3),(11,4,12.2,'Arbequina',3.8,1.5),(11,5,12.9,'Arbequina',3.8,1.5),
  (12,1,8.64,'Giffoni',5,3),(12,2,10.47,'Giffoni',5,3),(12,3,10.3,'Giffoni',5,3),(12,5,17.19,'Arbequina',3.8,1.5),(12,6,8.46,'Giffoni',5,3),(12,7,7.89,'Giffoni',5,3),(12,8,8.37,'Giffoni',5,3),
  (13,1,8.91,'Giffoni',5,3),(13,2,15.8,'Arbosana',3.8,1.3),(13,3,12.61,'Arbosana',3.8,1.3),(13,4,13.58,'Arbequina',3.8,1.5),(13,5,13.1,'Arbosana',3.8,1.3),(13,6,8.91,'Giffoni',5,3),
  (15,1,12.68,'Arbequina',3.8,1.5),(15,2,4.69,'Sweet Aryana',4,2),(15,3,10.95,'Arbequina',3.8,1.5),(15,4,5.3,'Pacific Red',4,2),(15,5,12.08,'Arbequina',3.8,1.5),(15,6,5.3,'Pacific Red',4,2),
  (16,1,9.57,'Arbosana',3.8,1.3),(16,2,11.29,'Arbosana',3.8,1.3),(16,3,11.42,'Arbosana',3.8,1.3),(16,4,5.09,'Pacific Red',4,2),(16,5,10.57,'Arbosana',3.8,1.3),
  (17,1,10.26,'Arbosana',3.5,1.3),(17,2,6.51,'Arbosana',3.5,1.3),(17,3,5.91,'Lapins',4.5,2.5),(17,4,5.79,'Lapins',4.5,2.5),(17,5,7.49,'Korinenki',3.8,1.7),
  (18,1,6.46,'Santina',4,2),(18,2,6.26,'Santina',4.5,2.5),(18,3,5.27,'Santina',4,2),(18,4,5.75,'Santina',4,2),(18,5,3.01,'Santina',4,2),
  (19,1,19.41,'Arbosana',3.8,1.3),(19,2,8.84,'Giffoni',5,3),(19,3,19.72,'Arbosana',3.8,1.3),(19,4,20.25,'Arbosana',3.5,1.3),(19,5,19.54,'Arbosana',3.5,1.3),(19,6,8.79,'Giffoni',5,3),
  (20,1,6.97,'Lapins',4.5,2.5),(20,2,5.72,'Lapins',4.5,2.5),(20,3,7.03,'Lapins',4.5,2.5),(20,4,5.07,'Lapins',4.5,2.5),
  (21,1,7.88,'Santina',4.5,2.5),(21,2,7.9,'Santina',4.5,2.5),(21,3,8.16,'Santina',4.5,2.5),(21,4,8.07,'Santina',4.5,2.5),
  (22,1,5.29,'Giffoni',5,3),(22,2,6.06,'Giffoni',5,3),(22,3,5.02,'Giffoni',5,3),(22,4,4.93,'Santina',4,2),(22,5,4.27,'Santina',4,2),
  (23,1,5.61,'Giffoni',5,2.5),(23,2,5.61,'Giffoni',5,2.5),(23,3,5.61,'Giffoni',5,2.5),(23,4,6.13,'Giffoni',5,2.5),(23,5,6.11,'Giffoni',5,2.5),
  (24,1,6.36,'Giffoni',5,2.5),(24,2,6.36,'Giffoni',5,2.5),(24,3,5.49,'Giffoni',5,2.5),(24,4,5.49,'Giffoni',5,2.5),(24,5,5.49,'Giffoni',5,2.5),
  (25,1,4.2,'Giffoni',5,2.5),(25,2,4.21,'Giffoni',5,2.5),(25,3,5.31,'Giffoni',5,2.5),(25,4,4.58,'Giffoni',5,2.5),(25,5,4.57,'Giffoni',5,2.5),
  (26,1,6.12,'Hayward',4.3,2),(26,2,6.12,'Hayward',4.3,2),(26,3,5.96,'Hayward',4.3,2),(26,4,5.41,'Hayward',4.3,2)
) AS u(equipo, sector, hectareas, variedad, dist_hilera, dist_planta)
WHERE s.numero = u.sector AND s.equipo_id = (SELECT id FROM equipos WHERE codigo::text = u.equipo::text);

-- 3. Verificar actualizacion
SELECT e.codigo as equipo, s.numero, ROUND(s.hectareas::numeric,2) as has, s.especie, s.variedad,
  s.dist_entre_hilera as dist_h, s.dist_entre_plantas as dist_p
FROM sectores s JOIN equipos e ON e.id = s.equipo_id
ORDER BY e.codigo, s.numero;
