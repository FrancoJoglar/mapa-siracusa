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
      // Sort client-side by equipo codigo then numero for cardinal order
      const sorted = (data || []).sort((a: any, b: any) => {
        const ea = a.equipo?.codigo || 0;
        const eb = b.equipo?.codigo || 0;
        return ea - eb || (a.numero || 0) - (b.numero || 0);
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
