import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { UnidadRiego } from "../lib/types";

export function useUnidadesRiego() {
  const [unidades, setUnidades] = useState<UnidadRiego[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUnidades = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc("get_unidades_riego_geojson");
      if (err) throw err;
      const parsed: UnidadRiego[] = (data || []).map((r: any) => ({
        ...r,
        geojson: r.geojson
          ? { type: "Feature", geometry: r.geojson, properties: {} }
          : undefined,
      }));
      setUnidades(parsed);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnidades();
  }, []);

  const updatePorcentajeAgua = async (cuartelId: string, sectorId: string, porcentaje: number | null) => {
    const { error: err } = await supabase
      .from("cuartel_sector")
      .update({ porcentaje_agua: porcentaje })
      .eq("cuartel_id", cuartelId)
      .eq("sector_id", sectorId);
    if (err) throw err;
    await fetchUnidades();
  };

  return { unidades, loading, error, refetch: fetchUnidades, updatePorcentajeAgua };
}
