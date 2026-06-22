const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://nnelrvctqjbwfucccxfh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk'
);

async function main() {
  const { data: sector } = await supabase.from('sectores').select('id,codigo,especie,geometria').eq('codigo', 'E6S3').single();
  console.log('=== E6S3 ===');
  console.log('codigo:', sector.codigo, '| especie:', sector.especie);
  const g = sector.geometria;
  if (g) {
    console.log('sector geometria type:', g.type);
    console.log('sector polys:', g.coordinates?.length);
    g.coordinates?.forEach((poly, i) => {
      const ring = poly?.[0];
      const first = ring?.[0];
      const last = ring?.[ring.length - 1];
      console.log('  poly ' + i + ': ' + ring?.length + ' pts, first: ' + (first ? first.map(x => x.toFixed(4)).join(',') : 'N/A'));
    });
  }

  const { data: rels } = await supabase.from('cuartel_sector').select('cuartel_id, geometria').eq('sector_id', sector.id);
  console.log('\ncuartel_sector rows:', rels?.length || 0);
  for (const r of rels || []) {
    const { data: c } = await supabase.from('cuarteles').select('nombre, especie').eq('id', r.cuartel_id).single();
    const geo = r.geometria;
    if (geo) {
      const first = geo.coordinates?.[0]?.[0];
      console.log('  ' + c?.nombre + ' (' + c?.especie + ') | type: ' + geo.type + ' | pts: ' + geo.coordinates?.[0]?.length + ' | first: ' + (first ? first.map(x => x.toFixed(4)).join(',') : 'N/A'));
    }
  }
}
main().catch(console.error);
