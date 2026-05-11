import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Equipo } from "../lib/types";

export function useEquipos() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEquipos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("equipos")
        .select("*")
        .order("codigo");
      if (err) throw err;
      setEquipos(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipos();
  }, []);

  const createEquipo = async (equipo: Omit<Equipo, "id" | "created_at">) => {
    const { error: err } = await supabase.from("equipos").insert(equipo);
    if (err) throw err;
    await fetchEquipos();
  };

  const updateEquipo = async (id: string, equipo: Partial<Equipo>) => {
    const { error: err } = await supabase
      .from("equipos")
      .update(equipo)
      .eq("id", id);
    if (err) throw err;
    await fetchEquipos();
  };

  const deleteEquipo = async (id: string) => {
    const { error: err } = await supabase.from("equipos").delete().eq("id", id);
    if (err) throw err;
    await fetchEquipos();
  };

  return { equipos, loading, error, refetch: fetchEquipos, createEquipo, updateEquipo, deleteEquipo };
}
