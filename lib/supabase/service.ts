import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "./config";

/**
 * Client `service_role`, qui contourne le RLS et donne acces a l'API Auth
 * Admin. **Optionnel** : il n'est necessaire que pour la suppression
 * definitive d'un compte (§12.1), c'est-a-dire la suppression de la ligne
 * `auth.users` — la cle publishable ne peut pas le faire, et supprimer
 * seulement `public.profiles` laisserait le JWT de l'appareil valide (piege
 * documente dans le CLAUDE.md de l'app mobile).
 *
 * Renvoie `null` si `SUPABASE_SERVICE_ROLE_KEY` n'est pas configuree ; les
 * appelants retombent alors sur une desactivation reversible.
 */
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceKey) return null;

  return createSupabaseClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const hasServiceRole = () =>
  Boolean(SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
