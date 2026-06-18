import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Tuberia } from "../lib/types";
import type { Feature } from "geojson";

export function useTuberias() {
  const [tuberias, setTuberias] = useState<Tuberia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTuberias = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("tuberias")
        .select("*")
        .order("codigo");
      if (err) throw err;
      const parsed: Tuberia[] = (data || []).map((r: any) => ({
        ...r,
        geojson: r.geometria
          ? { type: "Feature" as const, geometry: r.geometria, properties: {} }
          : undefined,
      }));
      setTuberias(parsed);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTuberias(); }, []);

  const createTuberia = async (data: Partial<Tuberia>) => {
    const { error: err } = await supabase.from("tuberias").insert(data);
    if (err) throw err;
    await fetchTuberias();
  };

  const updateTuberia = async (id: string, data: Partial<Tuberia>) => {
    const { error: err } = await supabase.from("tuberias").update(data).eq("id", id);
    if (err) throw err;
    await fetchTuberias();
  };

  const deleteTuberia = async (id: string) => {
    const { error: err } = await supabase.from("tuberias").delete().eq("id", id);
    if (err) throw err;
    await fetchTuberias();
  };

  const fetchGeometriaTuberia = async (id: string): Promise<Feature | null> => {
    const { data } = await supabase
      .from("tuberias")
      .select("geometria")
      .eq("id", id)
      .single();
    if (!data?.geometria) return null;
    return { type: "Feature", geometry: data.geometria, properties: {} } as any;
  };

  return { tuberias, loading, error, refetch: fetchTuberias, createTuberia, updateTuberia, deleteTuberia, fetchGeometriaTuberia };
}
