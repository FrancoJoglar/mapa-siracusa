import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(
  supabaseUrl || "",
  supabaseAnonKey || "",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Retry helper para errores JWT transitorios ("JWT issued at future").
 * Ocurre cuando hay desfase de reloj entre el cliente y Supabase durante
 * el refresh del token. Al recargar la sesión, se genera un token válido.
 */
export async function withJwtRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = e?.message || e?.error_description || "";
      const isJwtError = msg.includes("JWT") || msg.includes("jwt") || msg.includes("issued at future");
      if (isJwtError && i < maxRetries) {
        console.warn(`JWT error (attempt ${i + 1}/${maxRetries + 1}), refreshing session...`);
        await supabase.auth.getSession();
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Max retries exceeded");
}

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
