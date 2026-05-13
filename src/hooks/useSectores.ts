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

  return {
    sectores, loading, error, refetch: fetchSectores,
    createSector, updateSector, deleteSector,
    updateGeometria: async (id: string, geojson: any) => {
      const wkt = geojsonToWKT(geojson);
      if (!wkt) throw new Error("Geometria invalida");
      const { error: err } = await supabase
        .from("sectores")
        .update({ geometria: `SRID=4326;${wkt}` })
        .eq("id", id);
      if (err) throw err;
      await fetchSectores();
    },
    fetchGeometriaSector: async (id: string) => {
      const { data, error: err } = await supabase
        .from("sectores")
        .select("geometria")
        .eq("id", id)
        .single();
      if (err || !data?.geometria) return null;
      try {
        // Parse EWKT to GeoJSON
        const ewkt = data.geometria as string;
        const coordsStr = ewkt.replace("SRID=4326;POLYGON((", "").replace("))", "");
        const points = coordsStr.split(",").map(p => {
          const [lng, lat] = p.trim().split(" ").map(Number);
          return [lng, lat];
        });
        return {
          type: "Feature" as const,
          geometry: { type: "Polygon" as const, coordinates: [points] },
          properties: {},
        };
      } catch { return null; }
    },
  };
}

function geojsonToWKT(geojson: any): string | null {
  try {
    if (!geojson?.geometry || geojson.geometry.type !== "Polygon") return null;
    const coords = geojson.geometry.coordinates[0];
    const points = coords.map((c: number[]) => `${c[0]} ${c[1]}`).join(", ");
    return `POLYGON((${points}))`;
  } catch { return null; }
}
