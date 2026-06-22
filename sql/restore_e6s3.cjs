const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://nnelrvctqjbwfucccxfh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk'
);

async function main() {
  // Get E6S3
  const { data: sector } = await supabase.from('sectores').select('id').eq('codigo', 'E6S3').single();
  
  // Get geometries from neighbor E6 sectors
  const { data: e6ids } = await supabase.from('sectores').select('id').in('codigo', ['E6S1', 'E6S2', 'E6S4']);
  const sIds = e6ids.map(x => x.id);
  
  const { data: otros } = await supabase
    .from('cuartel_sector')
    .select('geometria')
    .in('sector_id', sIds)
    .not('geometria', 'is', null);

  if (!otros?.length) { console.log('No hay geometrias vecinas'); return; }
  
  const coords = [];
  for (const r of otros) {
    const g = r.geometria;
    if (!g) continue;
    if (g.type === 'Polygon') coords.push(g.coordinates);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => coords.push(p));
  }
  
  console.log('Rebuilding E6S3 with', coords.length, 'polygons from E6S1/S2/S4');
  
  const multipoly = { type: 'MultiPolygon', coordinates: coords };
  const url = 'https://nnelrvctqjbwfucccxfh.supabase.co/rest/v1/sectores?id=eq.' + sector.id;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk',
    },
    body: JSON.stringify({ geometria: multipoly }),
  });
  console.log('Restore:', resp.status);
  
  // Verify
  const { data: check } = await supabase.from('sectores').select('geometria').eq('id', sector.id).single();
  const g2 = check?.geometria;
  console.log('After restore:', g2?.type, '| polys:', g2?.coordinates?.length);
}
main().catch(console.error);
