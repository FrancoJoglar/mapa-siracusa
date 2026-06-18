import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Valvula } from "../lib/types";

export function useValvulas() {
  const [valvulas, setValvulas] = useState<Valvula[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchValvulas = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("valvulas")
        .select("*")
        .order("codigo");
      if (err) throw err;
      const parsed: Valvula[] = (data || []).map((r: any) => ({
        ...r,
        geojson: r.geometria
          ? { type: "Feature" as const, geometry: r.geometria, properties: {} }
          : undefined,
      }));
      setValvulas(parsed);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchValvulas(); }, []);

  const createValvula = async (data: Partial<Valvula>) => {
    const { error: err } = await supabase.from("valvulas").insert(data);
    if (err) throw err;
    await fetchValvulas();
  };

  const updateValvula = async (id: string, data: Partial<Valvula>) => {
    const { error: err } = await supabase.from("valvulas").update(data).eq("id", id);
    if (err) throw err;
    await fetchValvulas();
  };

  const deleteValvula = async (id: string) => {
    const { error: err } = await supabase.from("valvulas").delete().eq("id", id);
    if (err) throw err;
    await fetchValvulas();
  };

  return { valvulas, loading, error, refetch: fetchValvulas, createValvula, updateValvula, deleteValvula };
}
