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
      let geometry = geojson?.geometry;
      if (!geometry) {
        if (geojson?.type === "FeatureCollection") {
          geometry = geojson.features?.[0]?.geometry || geojson.features?.[0];
        } else if (geojson?.coordinates) {
          geometry = geojson;
        }
      }
      if (!geometry?.type || !geometry?.coordinates) {
        console.error("Geometria invalida. geojson:", geojson);
        throw new Error("Geometria invalida");
      }
      const { error: err } = await supabase
        .from("sectores")
        .update({ geometria: geometry })
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
        const ewkt = data.geometria as string;
        if (ewkt.includes("MULTIPOLYGON")) {
          const inner = ewkt.replace("SRID=4326;MULTIPOLYGON(", "").slice(0, -1);
          const rings: number[][][] = [];
          const polyRe = /\(\(([^)]+)\)\)/g;
          let match;
          while ((match = polyRe.exec(inner)) !== null) {
            rings.push(match[1].split(",").map(p => {
              const [lng, lat] = p.trim().split(" ").map(Number);
              return [lng, lat];
            }));
          }
          return {
            type: "Feature" as const,
            geometry: { type: "MultiPolygon" as const, coordinates: [rings] },
            properties: {},
          };
        }
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
