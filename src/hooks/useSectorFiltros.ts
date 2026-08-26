import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useSectorFiltros(sectorId?: string) {
  const [filtroIds, setFiltroIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!sectorId) { setFiltroIds([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("sector_filtros")
      .select("filtro_id")
      .eq("sector_id", sectorId);
    setFiltroIds((data || []).map((r) => r.filtro_id as string));
    setLoading(false);
  }, [sectorId]);

  useEffect(() => { fetch(); }, [fetch]);

  const guardar = async (nuevoSectorId: string, ids: string[]) => {
    const { error: delErr } = await supabase
      .from("sector_filtros")
      .delete()
      .eq("sector_id", nuevoSectorId);
    if (delErr) throw delErr;
    if (ids.length > 0) {
      const filas = ids.map((filtro_id) => ({ sector_id: nuevoSectorId, filtro_id }));
      const { error: insErr } = await supabase.from("sector_filtros").insert(filas);
      if (insErr) throw insErr;
    }
  };

  return { filtroIds, loading, refetch: fetch, guardar };
}
