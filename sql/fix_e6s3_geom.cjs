const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://nnelrvctqjbwfucccxfh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk'
);

async function main() {
  // Login as admin
  await supabase.auth.signInWithPassword({ email: 'francojoglar@gmail.com', password: 'Siracusa2026' });
  console.log('Logged in as admin');

  // Get E6S3
  const { data: sector } = await supabase.from('sectores').select('id, codigo').eq('codigo', 'E6S3').single();

  // Get its OWN cuartel_sector geometries (should be C 178 now)
  const { data: rels } = await supabase
    .from('cuartel_sector')
    .select('cuartel_id, geometria')
    .eq('sector_id', sector.id)
    .not('geometria', 'is', null);

  console.log('cuartel_sector rows for E6S3:', rels?.length);
  
  if (!rels?.length) {
    console.log('No geometries yet for E6S3 - need to check C 178');
    return;
  }

  const coords = [];
  for (const r of rels) {
    const g = r.geometria;
    const { data: c } = await supabase.from('cuarteles').select('nombre').eq('id', r.cuartel_id).single();
    console.log(' - ' + c?.nombre + ': ' + g.type + ' | ' + (g.coordinates?.[0]?.length || '?') + ' pts');
    if (g.type === 'Polygon') coords.push(g.coordinates);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => coords.push(p));
  }

  // Build MultiPolygon from just these
  const multipoly = { type: 'MultiPolygon', coordinates: coords };
  console.log('Rebuilding with', coords.length, 'polygons (from E6S3 own cuarteles)');

  // Use supabase client with admin session (RLS allows it)
  const { error } = await supabase
    .from('sectores')
    .update({ geometria: multipoly })
    .eq('id', sector.id);
    
  if (error) console.log('Error:', error.message);
  else console.log('E6S3 geometry fixed!');

  // Verify
  const { data: check } = await supabase.from('sectores').select('geometria').eq('id', sector.id).single();
  const g2 = check?.geometria;
  console.log('After restore:', g2?.type, '| polys:', g2?.coordinates?.length);
}
main().catch(console.error);
