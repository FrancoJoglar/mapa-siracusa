import { useState, useEffect, useCallback } from "react";
import { supabase, assertRowsAffected } from "../lib/supabase";
import { Bomba } from "../lib/types";

// Gestiona las bombas de un equipo. Pasar equipoId para filtrar.
export function useBombas(equipoId?: string) {
  const [bombas, setBombas] = useState<Bomba[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBombas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from("bombas").select("*").order("orden");
      if (equipoId) query = query.eq("equipo_id", equipoId);
      const { data, error: err } = await query;
      if (err) throw err;
      setBombas(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [equipoId]);

  useEffect(() => {
    fetchBombas();
  }, [fetchBombas]);

  const createBomba = async (bomba: Omit<Bomba, "id" | "created_at">) => {
    const { error: err } = await supabase.from("bombas").insert(bomba);
    if (err) throw err;
    await fetchBombas();
  };

  const updateBomba = async (id: string, cambios: Partial<Bomba>) => {
    const { data, error: err } = await supabase
      .from("bombas")
      .update(cambios)
      .eq("id", id)
      .select("id");
    if (err) throw err;
    assertRowsAffected(data, "Actualizar bomba");
    await fetchBombas();
  };

  const deleteBomba = async (id: string) => {
    const { data, error: err } = await supabase
      .from("bombas")
      .delete()
      .eq("id", id)
      .select("id");
    if (err) throw err;
    assertRowsAffected(data, "Eliminar bomba");
    await fetchBombas();
  };

  return { bombas, loading, error, refetch: fetchBombas, createBomba, updateBomba, deleteBomba };
}

// Bombas asignadas a un sector (relacion N:N) + helpers de guardado.
export function useSectorBombas(sectorId?: string) {
  const [bombaIds, setBombaIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!sectorId) { setBombaIds([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("sector_bombas")
      .select("bomba_id")
      .eq("sector_id", sectorId);
    setBombaIds((data || []).map((r) => r.bomba_id as string));
    setLoading(false);
  }, [sectorId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Reemplaza el set completo de bombas del sector.
  const guardar = async (nuevoSectorId: string, ids: string[]) => {
    const { error: delErr } = await supabase
      .from("sector_bombas")
      .delete()
      .eq("sector_id", nuevoSectorId);
    if (delErr) throw delErr;
    if (ids.length > 0) {
      const filas = ids.map((bomba_id) => ({ sector_id: nuevoSectorId, bomba_id }));
      const { error: insErr } = await supabase.from("sector_bombas").insert(filas);
      if (insErr) throw insErr;
    }
  };

  return { bombaIds, loading, refetch: fetch, guardar };
}
