const { Client } = require('pg');

const sql1 = `DROP FUNCTION IF EXISTS get_cuarteles_con_sectores()`;
const sql2 = `CREATE OR REPLACE FUNCTION get_cuarteles_con_sectores()
RETURNS TABLE(
  id UUID, nombre TEXT, especie TEXT, variedad TEXT,
  anio_plantacion INTEGER, superficie_ha NUMERIC, plantas INTEGER,
  polinizante TEXT, jefe_campo TEXT, centro_costo TEXT,
  sector_ids JSONB, geojson JSONB
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.nombre, c.especie, c.variedad,
    c.anio_plantacion, c.superficie_ha, c.plantas,
    c.polinizante, c.jefe_campo, c.centro_costo,
    COALESCE((SELECT jsonb_agg(cs.sector_id) FROM cuartel_sector cs WHERE cs.cuartel_id = c.id), '[]'::jsonb) AS sector_ids,
    ST_AsGeoJSON(c.geometria)::jsonb AS geojson
  FROM cuarteles c;
END;
$$`;

const sql3 = `DROP FUNCTION IF EXISTS set_cuartel_sectores(UUID, UUID[])`;
const sql4 = `CREATE OR REPLACE FUNCTION set_cuartel_sectores(
  p_cuartel_id UUID, p_sector_ids UUID[]
) RETURNS TABLE(result TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM cuartel_sector WHERE cuartel_id = p_cuartel_id;
  IF array_length(p_sector_ids, 1) > 0 THEN
    INSERT INTO cuartel_sector (cuartel_id, sector_id)
    SELECT p_cuartel_id, unnest(p_sector_ids);
    PERFORM init_unidad_riego(p_cuartel_id, s_id)
    FROM unnest(p_sector_ids) AS s_id;
  END IF;
  UPDATE cuarteles SET updated_at = now() WHERE id = p_cuartel_id;
  RETURN QUERY SELECT 'OK'::TEXT;
END;
$$`;

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

  await c.query(sql1);
  console.log('Drop get_cuarteles_con_sectores OK');

  await c.query(sql2);
  console.log('Create get_cuarteles_con_sectores OK');

  await c.query(sql3);
  console.log('Drop set_cuartel_sectores OK');

  await c.query(sql4);
  console.log('Create set_cuartel_sectores OK');

  await c.end();
  console.log('All done');
}

run().catch(e => { console.error('Error:', e.message); c.end(); });
