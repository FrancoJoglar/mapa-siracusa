import { useState, useEffect, useCallback } from "react";
import { supabase, assertRowsAffected } from "../lib/supabase";
import { Filtro } from "../lib/types";

export function useFiltros(equipoId?: string) {
  const [filtros, setFiltros] = useState<Filtro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiltros = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from("filtros").select("*").order("created_at");
      if (equipoId) query = query.eq("equipo_id", equipoId);
      const { data, error: err } = await query;
      if (err) throw err;
      setFiltros(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [equipoId]);

  useEffect(() => { fetchFiltros(); }, [fetchFiltros]);

  const createFiltro = async (filtro: Omit<Filtro, "id" | "created_at">) => {
    const { error: err } = await supabase.from("filtros").insert(filtro);
    if (err) throw err;
    await fetchFiltros();
  };

  const updateFiltro = async (id: string, cambios: Partial<Filtro>) => {
    const { data, error: err } = await supabase.from("filtros").update(cambios).eq("id", id).select("id");
    if (err) throw err;
    assertRowsAffected(data, "Actualizar filtro");
    await fetchFiltros();
  };

  const deleteFiltro = async (id: string) => {
    const { data, error: err } = await supabase.from("filtros").delete().eq("id", id).select("id");
    if (err) throw err;
    assertRowsAffected(data, "Eliminar filtro");
    await fetchFiltros();
  };

  return { filtros, loading, error, refetch: fetchFiltros, createFiltro, updateFiltro, deleteFiltro };
}
