const { Client } = require('pg');

const sql1 = `
INSERT INTO filtros (equipo_id, tipo, marca, modelo)
SELECT DISTINCT
  e.id,
  CASE
    WHEN e.filtro LIKE '%Grava%' THEN 'Grava'
    WHEN e.filtro LIKE '%Spin Klin%' THEN 'Spin Klin'
    WHEN e.filtro LIKE '%Azud%' THEN 'Azud'
    WHEN e.filtro LIKE '%Amiad%' THEN 'Amiad'
    ELSE 'Otro'
  END,
  CASE
    WHEN e.filtro LIKE '%Spin Klin%' THEN 'Spin Klin'
    WHEN e.filtro LIKE '%Azud%' THEN 'Azud'
    WHEN e.filtro LIKE '%Amiad%' THEN 'Amiad'
    WHEN e.filtro LIKE '%Grava%' THEN 'Grava'
    ELSE NULL
  END,
  e.filtro
FROM equipos e
WHERE e.filtro IS NOT NULL AND e.filtro != '';
`;

const sql2 = `
INSERT INTO sector_filtros (sector_id, filtro_id)
SELECT s.id, f.id
FROM sectores s
JOIN filtros f ON f.equipo_id = s.equipo_id
WHERE NOT EXISTS (
  SELECT 1 FROM sector_filtros sf WHERE sf.sector_id = s.id AND sf.filtro_id = f.id
);
`;

const c = new Client({
  host: 'db.nnelrvctqjbwfucccxfh.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'nnelrvctqjbwfucccxfh',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await c.connect();
  console.log('Connected');

  const r1 = await c.query(sql1);
  console.log('Filtros creados:', r1.rowCount);

  const r2 = await c.query(sql2);
  console.log('Relaciones sector_filtros creadas:', r2.rowCount);

  await c.end();
  console.log('Done');
}

run().catch(e => { console.error('Error:', e.message); c.end(); });
