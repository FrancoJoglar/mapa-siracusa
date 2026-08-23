-- ============================================================
-- AUDITORÍA DE SEGURIDAD — solo lectura, no modifica nada.
-- Ejecutar en el SQL Editor de Supabase y pegar el resultado.
-- ============================================================

-- 1. Definición completa de is_admin() — ¿lee de user_metadata (inseguro,
--    el usuario lo puede cambiar el mismo) o app_metadata (seguro)?
SELECT pg_get_functiondef('is_admin'::regproc);

-- 2. Definición completa de los RPCs que guardan geometrías
SELECT pg_get_functiondef('update_cuartel_geom'::regproc);
SELECT pg_get_functiondef('update_cuartel_sector_geom'::regproc);

-- 3. Todas las políticas RLS activas hoy, tabla por tabla
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- 4. Quién tiene rol admin ahora mismo (para no romperle el acceso al migrar)
SELECT id, email, raw_user_meta_data, raw_app_meta_data
FROM auth.users;
