import { DEFAULT_ADMIN_LOCALE, type AdminLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { storageUrl } from "@/lib/supabase/config";

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
   * reelle). Elle est reconstituee a partir des deux tables metier :
   * `player_profiles.profile_photo_url` pour un joueur,
   * `professional_profiles.photo_url` pour un professionnel (migration mobile
   * `0039`, bucket `avatars`). Elle reste nulle pour un admin.
   *
   * ⚠️ **Elle est SIGNEE ici, une fois pour toutes.** `avatars` est prive
   * depuis la migration mobile 0051 (sonde du 2026-09-24), donc l'URL publique
   * stockee en base repond 400 et aucune vignette ne s'affichait nulle part
   * dans le back-office. La signature est faite a la source parce que
   * `avatar_url` est consomme par une vingtaine de `<UserCell>` : corriger
   * chaque appelant, c'est en oublier un.
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
  // Les deux requetes photo sont volontairement separees de celle des profils :
  // si la migration mobile `0039` n'est pas appliquee, `photo_url` repond en
  // 42703 et seule cette requete-la retourne vide — les identites restent
  // affichees, sans vignette.
  const [profiles, playerPhotos, proPhotos] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).in("id", unique),
    supabase.from("player_profiles").select("id, profile_photo_url").in("id", unique),
    supabase.from("professional_profiles").select("id, photo_url").in("id", unique),
  ]);

  const photoById = new Map<string, string | null>([
    ...(playerPhotos.data ?? []).map(
      (row) => [row.id as string, row.profile_photo_url as string | null] as const,
    ),
    ...(proPhotos.data ?? []).map(
      (row) => [row.id as string, row.photo_url as string | null] as const,
    ),
  ]);

  return new Map(
    (profiles.data ?? []).map((row) => [
      row.id as string,
      {
        ...row,
        avatar_url: accountAvatarUrl(photoById.get(row.id as string)),
      } as ProfileSummary,
    ]),
  );
}

/**
 * La photo d'un compte, signee, quelle que soit la table d'ou elle vient.
 *
 * ⚠️ **Une seule implementation, et c'est le point.** Trois endroits
 * calculaient la meme chose — ici, `lib/queries/users.ts` et la fiche
 * `utilisateurs/[id]` — donc trois endroits a corriger le jour ou le bucket
 * est passe prive, et trois a oublier. Tout nouveau lecteur d'avatar passe
 * par cette fonction.
 *
 * `avatars` etant prive depuis la migration mobile 0051, la valeur stockee
 * (une URL publique) ne s'affiche pas telle quelle : `storageUrl()` la
 * ramene a son chemin et la fait signer par la route d'administration.
 */
export function accountAvatarUrl(
  playerPhoto: string | null | undefined,
  professionalPhoto?: string | null | undefined,
) {
  return storageUrl("avatars", playerPhoto ?? professionalPhoto ?? null);
}

/** Nom affichable d'un profil, avec repli sur l'email puis l'identifiant. */
export function displayName(
  profile: ProfileSummary | undefined,
  fallbackParts?: (string | null | undefined)[],
  locale: AdminLocale = DEFAULT_ADMIN_LOCALE,
) {
  const composed = fallbackParts?.filter(Boolean).join(" ").trim();
  return profile?.full_name?.trim() || composed || profile?.email || (locale === "en" ? "Unnamed account" : "Compte sans nom");
}
