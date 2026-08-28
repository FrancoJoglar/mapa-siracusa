const { Client } = require('pg');

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

  await c.query("ALTER TABLE bombas DROP CONSTRAINT IF EXISTS bombas_funcion_check");
  console.log('Drop constraint OK');

  await c.query("ALTER TABLE bombas ADD CONSTRAINT bombas_funcion_check CHECK (funcion IN ('riego', 'helada', 'impulsion'))");
  console.log('Add constraint OK');

  await c.end();
  console.log('Done');
}

run().catch(e => { console.error('Error:', e.message); c.end(); });
