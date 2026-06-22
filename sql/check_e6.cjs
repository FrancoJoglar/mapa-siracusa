const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://nnelrvctqjbwfucccxfh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWxydmN0cWpid2Z1Y2NjeGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk4MDAsImV4cCI6MjA5MzgzNTgwMH0.1pM_cFSx4kyqwqt503BPsulBmZ__njIN9EnZ4gUfbmk'
);

async function main() {
  for (const cod of ['E6S1', 'E6S2', 'E6S3', 'E6S4']) {
    const { data: sector } = await supabase.from('sectores').select('id,codigo,especie').eq('codigo', cod).single();
    const { data: rels } = await supabase.from('cuartel_sector').select('cuartel_id').eq('sector_id', sector.id);
    const cuartelIds = (rels || []).map(r => r.cuartel_id);
    const { data: cuarteles } = cuartelIds.length
      ? await supabase.from('cuarteles').select('nombre, especie').in('id', cuartelIds)
      : { data: [] };
    const names = (cuarteles || []).map(c => c.nombre + '(' + c.especie + ')').join(', ');
    console.log(cod + ' (' + sector.especie + '): ' + (names || '— SIN CUARTELES —'));
  }
}
main().catch(console.error);
