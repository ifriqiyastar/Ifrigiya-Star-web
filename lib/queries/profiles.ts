import { createClient } from "@/lib/supabase/server";

export type ProfileSummary = {
  id: string;
  role: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  /**
   * Photo affichable. **Elle ne vient pas de `profiles`** : la table de ce
   * projet Supabase n'a pas de colonne `avatar_url` (contrairement a ce que
   * laisse croire `00_ALL_IN_ONE.sql` cote app mobile — verifie contre la base
   * reelle). La seule photo disponible est `player_profiles.profile_photo_url`,
   * donc elle est renseignee pour les joueurs et nulle pour les autres roles.
   */
  avatar_url: string | null;
  is_active: boolean;
  is_minor: boolean;
  last_login_at: string | null;
  created_at: string;
  deletion_requested_at: string | null;
};

/** Colonnes reellement presentes sur `public.profiles`. */
export const PROFILE_COLUMNS =
  "id, role, email, phone, full_name, is_active, is_minor, last_login_at, created_at, deletion_requested_at";

/**
 * Charge des fiches `profiles` par identifiant et les indexe.
 *
 * On ne passe pas par les jointures imbriquees de PostgREST pour ces tables :
 * `player_profiles` et `professional_profiles` ont **deux** cles etrangeres
 * vers `profiles` (`id` et `status_updated_by`), ce qui rend l'embed
 * `profiles(...)` ambigu et force a nommer la contrainte exacte. Deux requetes
 * explicites sont plus robustes et se lisent mieux.
 */
export async function fetchProfilesByIds(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, ProfileSummary>();

  const supabase = await createClient();
  const [profiles, photos] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).in("id", unique),
    supabase.from("player_profiles").select("id, profile_photo_url").in("id", unique),
  ]);

  const photoById = new Map(
    (photos.data ?? []).map((row) => [row.id as string, row.profile_photo_url as string | null]),
  );

  return new Map(
    (profiles.data ?? []).map((row) => [
      row.id as string,
      { ...row, avatar_url: photoById.get(row.id as string) ?? null } as ProfileSummary,
    ]),
  );
}

/** Nom affichable d'un profil, avec repli sur l'email puis l'identifiant. */
export function displayName(
  profile: ProfileSummary | undefined,
  fallbackParts?: (string | null | undefined)[],
) {
  const composed = fallbackParts?.filter(Boolean).join(" ").trim();
  return profile?.full_name?.trim() || composed || profile?.email || "Compte sans nom";
}
