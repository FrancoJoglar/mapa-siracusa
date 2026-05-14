import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Cuartel } from "../lib/types";

export function useCuarteles() {
  const [cuarteles, setCuarteles] = useState<Cuartel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCuarteles = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc(
        "get_cuarteles_con_sectores"
      );
      if (err) throw err;
      const parsed: Cuartel[] = (data || []).map((r: any) => ({
        ...r,
        sector_ids: Array.isArray(r.sector_ids)
          ? r.sector_ids
          : r.sector_ids
          ? [r.sector_ids]
          : [],
        geojson: r.geojson
          ? {
              type: "Feature",
              geometry: r.geojson,
              properties: {},
            }
          : undefined,
      }));
      setCuarteles(parsed);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCuarteles();
  }, []);

  const createCuartel = async (cuartel: Omit<Cuartel, "id" | "created_at" | "updated_at">) => {
    const { error: err } = await supabase.rpc("create_cuartel", {
      c_nombre: cuartel.nombre,
      c_especie: cuartel.especie,
      c_variedad: cuartel.variedad,
      c_anio: cuartel.anio_plantacion,
      c_superficie: cuartel.superficie_ha,
      c_plantas: cuartel.plantas,
      c_polinizante: cuartel.polinizante,
      c_jefe: cuartel.jefe_campo,
      c_centro: cuartel.centro_costo,
      c_equipo: null,
      c_sector_raw: null,
      c_geometria: cuartel.geojson?.geometry ? JSON.stringify(cuartel.geojson.geometry) : null,
      c_sector_ids: cuartel.sector_ids,
    } as any);
    if (err) throw err;
    await fetchCuarteles();
  };

  const updateCuartel = async (id: string, cuartel: Partial<Cuartel>) => {
    const updates: Record<string, any> = {};
    if (cuartel.nombre !== undefined) updates.nombre = cuartel.nombre;
    if (cuartel.especie !== undefined) updates.especie = cuartel.especie;
    if (cuartel.variedad !== undefined) updates.variedad = cuartel.variedad;
    if (cuartel.anio_plantacion !== undefined) updates.anio_plantacion = cuartel.anio_plantacion;
    if (cuartel.superficie_ha !== undefined) updates.superficie_ha = cuartel.superficie_ha;
    if (cuartel.plantas !== undefined) updates.plantas = cuartel.plantas;
    if (cuartel.polinizante !== undefined) updates.polinizante = cuartel.polinizante;
    if (cuartel.jefe_campo !== undefined) updates.jefe_campo = cuartel.jefe_campo;
    if (cuartel.centro_costo !== undefined) updates.centro_costo = cuartel.centro_costo;
    updates.updated_at = new Date().toISOString();

    const { error: err } = await supabase
      .from("cuarteles")
      .update(updates)
      .eq("id", id);
    if (err) throw err;

    if (cuartel.sector_ids) {
      await supabase.from("cuartel_sector").delete().eq("cuartel_id", id);
      if (cuartel.sector_ids.length > 0) {
        const inserts = cuartel.sector_ids.map((sectorId) => ({
          cuartel_id: id,
          sector_id: sectorId,
        }));
        await supabase.from("cuartel_sector").insert(inserts);
      }
    }
    await fetchCuarteles();
  };

  const deleteCuartel = async (id: string) => {
    const { error: err } = await supabase
      .from("cuarteles")
      .delete()
      .eq("id", id);
    if (err) throw err;
    await fetchCuarteles();
  };

  return {
    cuarteles,
    loading,
    error,
    refetch: fetchCuarteles,
    createCuartel,
    updateCuartel,
    deleteCuartel,
    updateGeometria: async (id: string, geojson: any) => {
      if (!geojson?.geometry) throw new Error("Geometria invalida");
      const { error: err } = await supabase
        .from("cuarteles")
        .update({ geometria: geojson.geometry })
        .eq("id", id);
      if (err) throw err;
      await fetchCuarteles();
    },
  };
}
