import fs from 'fs';

const SUPABASE_URL = 'https://nnelrvctqjbwfucccxfh.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk';

const outPath = process.argv[2] || 'backup.sql';
const lines = [];

const headers = {
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
  'Accept': 'application/json',
};

const ORDER_COLS = {
  equipos: 'id',
  sectores: 'id',
  cuarteles: 'id',
  cuartel_sector: 'cuartel_id',
  edificaciones: 'id',
};

async function fetchAll(table) {
  const rows = [];
  let page = 0;
  const pageSize = 1000;
  const order = ORDER_COLS[table] || 'id';
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=${order}&offset=${page * pageSize}&limit=${pageSize}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${table}`);
    const data = await res.json();
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return rows;
}

lines.push('-- ============================================================');
lines.push('-- MAPA SIRACUSA 2025 - Full database backup');
lines.push('-- Generated: ' + new Date().toISOString());
lines.push('-- ============================================================');
lines.push('');

// Schema from migration files
['sql/migracion.sql', 'sql/migracion_v2.sql'].forEach(f => {
  const p = `C:\\Users\\Usuario\\OneDrive - auraoiliveoil.com\\Escritorio\\Mapeo SIracusa 2025\\mapa-siracusa\\${f}`;
  if (fs.existsSync(p)) {
    lines.push('-- Schema from: ' + f);
    lines.push(fs.readFileSync(p, 'utf8'));
    lines.push('');
  }
});

// Data
lines.push('-- ============================================================');
lines.push('-- DATA');
lines.push('-- ============================================================');
lines.push('');

const TABLES = ['equipos', 'sectores', 'cuarteles', 'cuartel_sector', 'edificaciones'];

for (const table of TABLES) {
  try {
    const data = await fetchAll(table);
    if (data.length === 0) {
      lines.push(`-- ${table}: 0 rows`);
      lines.push('');
      continue;
    }
    lines.push(`-- ${table}: ${data.length} rows`);
    const keys = Object.keys(data[0]);
    for (const row of data) {
      const vals = keys.map(k => {
        const v = row[k];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        if (typeof v === 'number') return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      lines.push(`INSERT INTO "${table}" (${keys.join(', ')}) VALUES (${vals.join(', ')});`);
    }
    lines.push('');
  } catch (e) {
    lines.push(`-- ERROR ${table}: ${e.message}`);
    lines.push('');
  }
}

lines.push('-- ============================================================');
lines.push('-- RPCs NOT exported via REST API.');
lines.push('-- Restore from migration SQL files.');
lines.push('-- ============================================================');
lines.push('');
lines.push('-- Backup complete: ' + new Date().toISOString());

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Backup: ${outPath}`);
console.log(`Lines: ${lines.length}`);
