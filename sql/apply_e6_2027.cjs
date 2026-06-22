const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://nnelrvctqjbwfucccxfh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk'
);

async function main() {
  // Login as admin
  const { error: loginErr } = await supabase.auth.signInWithPassword({ email: 'francojoglar@gmail.com', password: 'Siracusa2026' });
  if (loginErr) { console.log('Login error:', loginErr.message); return; }
  console.log('Logged in as admin');

  // Get sector codes → IDs
  const { data: sectores } = await supabase.from('sectores').select('id, codigo').in('codigo', ['E6S1','E6S2','E6S3','E6S4','E6S5']);
  const sMap = Object.fromEntries(sectores.map(s => [s.codigo, s.id]));

  // Get cuartel names → IDs
  const names = ['C 171','C 173','C 175','C 176','C 178','C 179','C 180','C 181','C 182','C 184'];
  const { data: cuarteles } = await supabase.from('cuarteles').select('id, nombre, especie').in('nombre', names);
  const cMap = Object.fromEntries(cuarteles.map(c => [c.nombre, c.id]));

  // Assignments per Excel 2027
  const assigns = [
    { c: 'C 171', sectors: ['E6S1'] },
    { c: 'C 173', sectors: ['E6S1'] },
    { c: 'C 175', sectors: ['E6S1'] },
    { c: 'C 176', sectors: ['E6S1', 'E6S2'] },
    { c: 'C 179', sectors: ['E6S2'] },
    { c: 'C 180', sectors: ['E6S2'] },
    { c: 'C 181', sectors: ['E6S2'] },
    { c: 'C 182', sectors: ['E6S2'] },
    { c: 'C 178', sectors: ['E6S3', 'E6S4'] },
    { c: 'C 184', sectors: ['E6S4', 'E6S5'] },
  ];

  for (const {c, sectors} of assigns) {
    const cId = cMap[c];
    const sIds = sectors.map(s => sMap[s]).filter(Boolean);
    if (!cId || sIds.length !== sectors.length) { console.log('SKIP', c, '- missing ids'); continue; }
    const { data, error } = await supabase.rpc('set_cuartel_sectores', { p_cuartel_id: cId, p_sector_ids: sIds });
    if (error) console.log('ERROR', c, ':', error.message);
    else console.log('OK', c, '→', sectors.join(', '), '| eq:', data?.[0]?.equipo_riego, 'sr:', data?.[0]?.sector_raw);
  }

  // Verify
  console.log('\n=== VERIFICACIÓN ===');
  for (const cod of ['E6S1','E6S2','E6S3','E6S4','E6S5']) {
    const { data: sec } = await supabase.from('sectores').select('id, codigo, especie').eq('codigo', cod).single();
    const { data: rels } = await supabase.from('cuartel_sector').select('cuartel_id').eq('sector_id', sec.id);
    const ids = (rels||[]).map(r => r.cuartel_id);
    const { data: cts } = ids.length ? await supabase.from('cuarteles').select('nombre').in('id', ids) : { data: [] };
    const names = (cts||[]).map(c => c.nombre).join(', ');
    console.log(cod + ' (' + sec.especie + '):', names || '—');
  }
}
main().catch(console.error);
