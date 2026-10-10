/*
 * Configuración de Revela
 * ------------------------------------------------------------------
 * 1. Crea un proyecto en https://supabase.com (plan gratuito sirve).
 * 2. Ejecuta supabase/schema.sql en el SQL Editor.
 * 3. Copia aquí los valores de Project Settings → API:
 *      - Project URL        → SUPABASE_URL
 *      - anon public key    → SUPABASE_ANON_KEY
 *
 * La "anon key" es pública por diseño: la seguridad la dan las reglas
 * (RLS y funciones) del esquema. NUNCA pongas aquí la "service_role key".
 *
 * Mientras SUPABASE_URL esté vacío, la app corre en MODO DEMO: todo se
 * guarda en este navegador, ideal para probar el flujo completo.
 */
window.REVELA_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Nombre que aparece en el pie de página y en la pestaña del navegador
  BRAND: "Revela",

  // Idioma/región para formatear fechas
  LOCALE: "es-MX"
};
