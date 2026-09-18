import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "./config";

/**
 * Client `service_role`, qui contourne le RLS **et les privileges de colonne**,
 * et donne acces a l'API Auth Admin. Quatre usages, et quatre seulement :
 *
 * 1. **Suppression definitive d'un compte** (§12.1) : supprimer la ligne
 *    `auth.users`, ce que la cle publishable ne peut pas faire — et supprimer
 *    seulement `public.profiles` laisserait le JWT de l'appareil valide (piege
 *    documente dans le CLAUDE.md de l'app mobile).
 * 2. **Masquage d'une publication ou d'un commentaire** (§12.2) : les
 *    migrations 0033 et 0035 ont revoque `update (is_hidden)` au role
 *    `authenticated` pour qu'un auteur ne puisse pas se demasquer lui-meme.
 *    Un privilege de colonne se verifie avant la RLS, donc la session
 *    administrateur est refusee elle aussi : les deux migrations disent
 *    explicitement que le masquage passe par `service_role`.
 * 3. **Webhook de paiement**, qui n'a aucune session utilisateur.
 * 4. **Envoi d'un code de reinitialisation de mot de passe** (§12.1, geste du
 *    super administrateur) : la protection anti-robot du projet couvre
 *    `/recover`, et un serveur n'a pas de defi a resoudre. GoTrue dispense du
 *    defi les appels porteurs d'identifiants d'administration — c'est le seul
 *    chemin par lequel le back-office peut declencher cet envoi. Voir
 *    `sendPasswordReset()` dans `lib/actions/users.ts`.
 *
 * ⚠️ Ne **jamais** l'utiliser pour un geste que Postgres doit arbitrer sur
 * l'identite de l'appelant : `is_deleted`, la publication d'un Scout Day, la
 * validation d'un retrait. Ces triggers lisent `auth.uid()`, qui est nul ici,
 * et la regle se contournerait en silence.
 *
 * Renvoie `null` si `SUPABASE_SERVICE_ROLE_KEY` n'est pas configuree.
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
