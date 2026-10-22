import { DEFAULT_ADMIN_LOCALE, type AdminLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { storageUrl } from "@/lib/supabase/config";
import { signStorageUrls } from "@/lib/queries/signed-media";
import { PROFILE_NAME_COLUMNS, orSearchClause } from "@/lib/queries/search-term";

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
  /**
   * Pays declare. **Il ne vient pas de `profiles` non plus** — la table n'a pas
   * de colonne `country` (sonde du 2026-10-19 : `42703`). Il vit sur les tables
   * metier, `player_profiles.country` et `professional_profiles.country`, et il
   * est reconstitue ici par les deux memes requetes que la photo : **aucun
   * aller-retour de plus**. C'est la condition a laquelle l'apercu d'un compte
   * peut l'afficher sur chaque ligne de chaque liste.
   *
   * C'est du **texte**, le nom du pays, pas un code ISO (voir
   * `lib/countries-api.ts`) : le drapeau s'en deduit par `countryFlag()`.
   */
  country: string | null;
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
export async function fetchProfilesByIds(
  ids: string[],
  /** `signAvatars` : photos signees en une seule demande (`signAvatarUrls`)
   * plutot qu'une redirection par vignette. Faux par defaut — un aller-retour
   * de plus, qui ne vaut la peine que pour une liste de vignettes. */
  options: { signAvatars?: boolean } = {},
) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, ProfileSummary>();

  const supabase = await createClient();
  // Les deux requetes metier sont volontairement separees de celle des profils :
  // si la migration mobile `0039` n'est pas appliquee, `photo_url` repond en
  // 42703 et seule cette requete-la retourne vide — les identites restent
  // affichees, sans vignette.
  //
  // ⚠️ `country` voyage dans CES MEMES requetes, pas dans une troisieme vague.
  // C'est ce qui permet a l'apercu d'un compte de montrer le pays sans rien
  // couter : la colonne existe sur les deux tables depuis le schema d'origine
  // (sonde du 2026-10-19 — une colonne absente repond `42703` avant la RLS,
  // une colonne presente `42501`), donc elle n'elargit pas le risque que
  // `profile_photo_url` / `photo_url` portent deja.
  const [profiles, playerRows, proRows] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).in("id", unique),
    supabase.from("player_profiles").select("id, profile_photo_url, country").in("id", unique),
    supabase.from("professional_profiles").select("id, photo_url, country").in("id", unique),
  ]);

  const photoById = new Map<string, string | null>([
    ...(playerRows.data ?? []).map(
      (row) => [row.id as string, row.profile_photo_url as string | null] as const,
    ),
    ...(proRows.data ?? []).map(
      (row) => [row.id as string, row.photo_url as string | null] as const,
    ),
  ]);

  const countryById = new Map<string, string | null>(
    [...(playerRows.data ?? []), ...(proRows.data ?? [])].map(
      (row) => [row.id as string, (row.country as string | null) ?? null] as const,
    ),
  );

  const signed = options.signAvatars
    ? await signAvatarUrls(supabase, [...photoById.values()])
    : new Map<string, string>();

  return new Map(
    (profiles.data ?? []).map((row) => {
      const photo = photoById.get(row.id as string);
      return [
        row.id as string,
        {
          ...row,
          avatar_url: (photo && signed.get(photo)) || accountAvatarUrl(photo),
          country: countryById.get(row.id as string) ?? null,
        } as ProfileSummary,
      ];
    }),
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
/**
 * Les identifiants des comptes dont le nom ou l'e-mail correspond au terme.
 *
 * Sert aux ecrans dont la liste ne porte PAS le nom : `payments` et
 * `subscriptions` ne connaissent qu'un `profile_id`, et aucun embed imbrique
 * vers `profiles` n'est possible ici (deux cles etrangeres rendent l'embed
 * ambigu). Les deux ecrans cherchaient donc en JavaScript, sur la page deja
 * paginee — un nom present a la 200e ligne restait introuvable et `count`
 * ignorait la recherche, donc le pied du tableau annoncait un total que la
 * liste ne montrait pas. Avec cette lecture, le filtre redevient un
 * `profile_id in (…)` **dans la requete**.
 *
 * ⚠️ PLAFOND ASSUME, et c'est pourquoi il est large : au-dela de `limit`
 * comptes correspondants, les suivants ne seraient pas filtres. Deux mille
 * homonymes sur un terme tape a la main ne se produisent pas dans ce produit,
 * et un plafond atteint en silence vaut mieux qu'une URL `in (…)` de 60 000
 * caracteres que PostgREST refuserait en bloc.
 */
export async function searchProfileIds(term: string, limit = 2_000) {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .or(orSearchClause(PROFILE_NAME_COLUMNS, trimmed))
    .limit(limit);
  return (data ?? []).map((row) => row.id as string);
}

/**
 * Identifiant impossible : rend une liste vide exploitable par `in (…)`, que
 * PostgREST refuse autrement. Meme valeur et meme role que `EMPTY_ID` des
 * files de validation.
 */
export const NO_PROFILE = "00000000-0000-0000-0000-000000000000";

export function accountAvatarUrl(
  playerPhoto: string | null | undefined,
  professionalPhoto?: string | null | undefined,
) {
  return storageUrl("avatars", playerPhoto ?? professionalPhoto ?? null);
}

/**
 * Signe en UNE demande les photos d'une page entiere.
 *
 * Simple specialisation de `signStorageUrls()` sur le bucket `avatars` : le
 * mecanisme (demande groupee, cache en memoire, repli silencieux) est le meme
 * pour toutes les vignettes du back-office et n'est ecrit qu'une fois.
 */
export async function signAvatarUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  values: (string | null | undefined)[],
): Promise<Map<string, string>> {
  return signStorageUrls(supabase, "avatars", values);
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
