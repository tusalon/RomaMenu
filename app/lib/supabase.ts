import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null | undefined;

// La URL y la clave publishable identifican este proyecto en el navegador.
// No conceden acceso privilegiado: la seguridad real permanece en las políticas RLS.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://zfozknltebjdxwzwoyjf.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_alE5AiBzLESvnHLT3BD1Pw_51zIM7DH";

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function getSupabase(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;

  browserClient = createClient(supabaseUrl, supabasePublishableKey);
  return browserClient;
}
