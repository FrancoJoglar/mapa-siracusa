import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(
  supabaseUrl || "",
  supabaseAnonKey || ""
);

/**
 * Cuando RLS filtra una fila (ej. un usuario sin permiso de admin intenta
 * actualizar/borrar), Postgres no lo trata como error: el UPDATE/DELETE
 * simplemente no encuentra filas visibles y responde "éxito" con 0 filas
 * afectadas. Sin pedir `.select()` en la mutación no hay forma de detectar
 * esto — por eso los hooks de escritura piden `.select("id")` y después
 * llaman a este helper para confirmar que realmente se tocó algo.
 */
export function assertRowsAffected(data: unknown[] | null, accion: string) {
  if (!data || data.length === 0) {
    throw new Error(`${accion}: no se modificó ninguna fila (¿permisos insuficientes o el registro ya no existe?)`);
  }
}
