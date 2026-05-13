import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Sector } from "../lib/types";

export function useSectores() {
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSectores = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("sectores")
        .select("*, equipo:equipos(*)")
        .order("numero");
      if (err) throw err;
      const sorted = [...(data || [])].sort((a: any, b: any) => {
        const na = parseInt((a.codigo || '').replace(/\D/g, ''), 10) || 0;
        const nb = parseInt((b.codigo || '').replace(/\D/g, ''), 10) || 0;
        return na - nb;
      });
      setSectores(sorted);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSectores();
  }, []);

  const createSector = async (sector: Omit<Sector, "id" | "created_at" | "equipo">) => {
    const { error: err } = await supabase.from("sectores").insert(sector);
    if (err) throw err;
    await fetchSectores();
  };

  const updateSector = async (id: string, sector: Partial<Sector>) => {
    const { error: err } = await supabase
      .from("sectores")
      .update(sector)
      .eq("id", id);
    if (err) throw err;
    await fetchSectores();
  };

  const deleteSector = async (id: string) => {
    const { error: err } = await supabase
      .from("sectores")
      .delete()
      .eq("id", id);
    if (err) throw err;
    await fetchSectores();
  };

  return { sectores, loading, error, refetch: fetchSectores, createSector, updateSector, deleteSector };
}
