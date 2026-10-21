import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { accountAvatarUrl, signAvatarUrls } from "@/lib/queries/profiles";
import { PROFILE_COLUMNS, fetchProfilesByIds, type ProfileSummary } from "@/lib/queries/profiles";

// Huit lignes par page (demande client) : les files du back-office se
// lisent surtout sur telephone, ou chaque ligne est une rangee compacte de
// deux lignes de texte — vingt d'entre elles faisaient une page qu'on ne
// parcourt plus, on la fait defiler.
export const USERS_PAGE_SIZE = 8;

export type UserListRow = ProfileSummary & {
  /** Statut du profil metier (player_profiles / professional_profiles). */
  businessStatus: string | null;
  /** Complement d'identite : club, organisation, type de compte. */
  detail: string | null;
  isVisible: boolean | null;
};

/**
 * Liste des comptes, avec recherche, filtres et pagination.
 *
 * Le statut de validation ne vit pas dans `profiles` mais dans les deux tables
 * de profil metier ; filtrer par statut demande donc de collecter d'abord les
 * identifiants correspondants, puis de restreindre la requete principale. Sans
 * filtre de statut, on ne paie pas ce detour.
 */
export async function listUsers(params: {
  q?: string;
  role?: string;
  statut?: string;
  actif?: string;
  /** `oui` = seuls les comptes ayant demande leur suppression (§12.1, RGPD). */
  suppression?: string;
  page?: number;
  /** Faux pour l'export CSV : il n'affiche aucune vignette, et la signature
   * groupee y couterait un aller-retour par page de 25 lignes, pour rien. */
  signAvatars?: boolean;
}) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);

  let restrictedIds: string[] | null = null;

  if (params.statut) {
    const wantsPlayers = !params.role || params.role === "player";
    const wantsPros = !params.role || params.role === "professional";

    const [players, pros] = await Promise.all([
      wantsPlayers
        ? supabase.from("player_profiles").select("id").eq("status", params.statut).limit(2000)
        : Promise.resolve({ data: [] as { id: string }[] }),
      wantsPros
        ? supabase
            .from("professional_profiles")
            .select("id")
            .eq("status", params.statut)
            .limit(2000)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);

    restrictedIds = [
      ...(players.data ?? []).map((row) => row.id),
      ...(pros.data ?? []).map((row) => row.id),
    ];
    // Aucun identifiant : on force un resultat vide plutot qu'un `in ()` invalide.
    if (!restrictedIds.length) restrictedIds = ["00000000-0000-0000-0000-000000000000"];
  }

  let query = supabase
    .from("profiles")
    .select(PROFILE_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.role) query = query.eq("role", params.role);
  if (params.actif === "oui") query = query.eq("is_active", true);
  if (params.actif === "non") query = query.eq("is_active", false);
  // Demandes de suppression : `deletion_requested_at` est la seule trace, la
  // suppression elle-meme restant un geste manuel de l'administration.
  if (params.suppression === "oui") query = query.not("deletion_requested_at", "is", null);
  if (restrictedIds) query = query.in("id", restrictedIds);
  if (params.q) {
    const term = params.q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
      );
    }
  }

  const from = (page - 1) * USERS_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + USERS_PAGE_SIZE - 1);

  const profiles = (data ?? []) as Omit<ProfileSummary, "avatar_url">[];
  const ids = profiles.map((row) => row.id);

  const [players, pros, proPhotos] = await Promise.all([
    ids.length
      ? supabase
          .from("player_profiles")
          .select("id, status, current_club, is_visible, profile_photo_url")
          .in("id", ids)
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? supabase
          .from("professional_profiles")
          .select("id, status, professional_type, organization_name")
          .in("id", ids)
      : Promise.resolve({ data: [] as never[] }),
    // Requete a part : `photo_url` vient de la migration mobile `0039` et
    // repondrait 42703 si elle n'est pas appliquee. Isolee, elle ne prive alors
    // la ligne que de sa vignette, pas de son statut ni de son organisation.
    ids.length
      ? supabase.from("professional_profiles").select("id, photo_url").in("id", ids)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const playerById = new Map(
    (players.data ?? []).map((row: Record<string, unknown>) => [row.id as string, row]),
  );
  const proById = new Map(
    (pros.data ?? []).map((row: Record<string, unknown>) => [row.id as string, row]),
  );
  const proPhotoById = new Map(
    (proPhotos.data ?? []).map((row: Record<string, unknown>) => [
      row.id as string,
      row.photo_url as string | null,
    ]),
  );

  // Joueur : `profile_photo_url` ; professionnel : `photo_url` (migration
  // mobile 0039). Le bucket est prive : les photos de la page sont signees en
  // une seule demande, et `accountAvatarUrl` (route de signature) ne sert plus
  // que de repli pour ce que la signature groupee n'a pas couvert.
  const photoOf = (id: string) =>
    (playerById.get(id)?.profile_photo_url as string | null | undefined) ??
    proPhotoById.get(id) ??
    null;
  const signed =
    params.signAvatars === false
      ? new Map<string, string>()
      : await signAvatarUrls(
          supabase,
          profiles.map((profile) => photoOf(profile.id)),
        );

  const rows: UserListRow[] = profiles.map((profile) => {
    const player = playerById.get(profile.id);
    const pro = proById.get(profile.id);
    const photo = photoOf(profile.id);
    return {
      ...profile,
      avatar_url: (photo && signed.get(photo)) || accountAvatarUrl(photo),
      businessStatus: (player?.status ?? pro?.status ?? null) as string | null,
      detail:
        (player?.current_club as string | null) ??
        (pro?.organization_name as string | null) ??
        (pro?.professional_type as string | null) ??
        null,
      isVisible: (player?.is_visible as boolean | undefined) ?? null,
    };
  });

  return { rows, total: count ?? 0, page, error: error?.message ?? null };
}

export { fetchProfilesByIds };

/**
 * Les six tuiles de l'ecran des comptes.
 *
 * ⚠️ **Elles ne dependent pas de la page affichee** — et c'est tout le sujet :
 * elles etaient recomptees a chaque clic sur « Suivant », en six requetes
 * separees posees depuis la page elle-meme. Un clic de pagination demandait
 * une quinzaine d'allers-retours au projet Supabase, pour six nombres qui
 * n'avaient pas bouge.
 *
 * En un seul appel quand la base connait `admin_user_stats`
 * (`202610140001_admin_fast_reads.sql`), en six requetes sinon : meme regle de
 * repli que `countQueues()` dans `lib/queries/admin-queue.ts`.
 */
export type UserStats = {
  /** Tous les comptes. */
  all: number;
  active: number;
  players: number;
  professionals: number;
  /** Lignes de `player_profiles` — le denominateur de la tuile de conformite. */
  playerProfiles: number;
  identityValidated: number;
};

const STAT_KEYS = [
  "all",
  "active",
  "players",
  "professionals",
  "playerProfiles",
  "identityValidated",
] as const;

/**
 * `cache()` (React) : les tuiles de l'annuaire et la pastille de sa tete de
 * page lisent les memes six chiffres. Depuis qu'elles sont rendues sous deux
 * frontieres `<Suspense>` distinctes, elles appellent cette fonction chacune
 * de leur cote — sans memoisation, ce serait deux fois le meme aller-retour
 * par chargement. Memoisation **par requete**, donc rien n'est garde entre
 * deux navigations.
 */
export const fetchUserStats = cache(async function fetchUserStats(): Promise<UserStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_user_stats");

  if (!error && data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    return Object.fromEntries(
      STAT_KEYS.map((key) => [key, Number(row[key] ?? 0)]),
    ) as unknown as UserStats;
  }

  return fetchUserStatsOneByOne();
});

/** Le comptage d'origine, conserve pour les projets sans la fonction. */
async function fetchUserStatsOneByOne(): Promise<UserStats> {
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [all, active, players, professionals, playerProfiles, identityValidated] =
    await Promise.all([
      supabase.from("profiles").select("id", head),
      supabase.from("profiles").select("id", head).eq("is_active", true),
      supabase.from("profiles").select("id", head).eq("role", "player"),
      supabase.from("profiles").select("id", head).eq("role", "professional"),
      supabase.from("player_profiles").select("id", head),
      // Conformite d'identite : nombre de pieces au statut « valide ». Une
      // ligne par joueur au plus dans les faits, et le libelle dit le
      // denominateur — pas un pourcentage flottant sans base.
      supabase.from("identity_verifications").select("id", head).eq("status", "valide"),
    ]);

  return {
    all: all.count ?? 0,
    active: active.count ?? 0,
    players: players.count ?? 0,
    professionals: professionals.count ?? 0,
    playerProfiles: playerProfiles.count ?? 0,
    identityValidated: identityValidated.count ?? 0,
  };
}

/**
 * Le role RBAC des administrateurs d'une page de liste, **en une requete**.
 *
 * L'ecran posait deux lectures enchainees — les attributions, puis les roles
 * cites par ces attributions — soit deux allers-retours de plus a chaque clic
 * de pagination des qu'un administrateur figurait dans la page. L'embed
 * PostgREST les reunit : la relation `admin_user_roles` → `admin_roles` passe
 * par la seule cle etrangere `role_id`, donc elle n'est pas ambigue
 * (verifie en interrogeant PostgREST : une relation introuvable repond
 * `PGRST200`, une relation ambigue `PGRST201` — celle-ci ne repond ni l'un ni
 * l'autre).
 *
 * Rend le code et le libelle bruts : la traduction du nom de role appartient
 * a l'ecran, qui a le dictionnaire.
 */
export async function fetchAdminRoleLabels(
  adminIds: string[],
): Promise<Map<string, { code: string | null; label: string | null }>> {
  const byAdmin = new Map<string, { code: string | null; label: string | null }>();
  if (!adminIds.length) return byAdmin;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_user_roles")
    .select("admin_id, admin_roles(code, label)")
    .in("admin_id", adminIds);

  // Erreur avalee pour l'utilisateur (l'ecran retombe sur le libelle
  // generique), mais pas pour les logs serveur : un `42501` ici signale un
  // GRANT manquant (cf. 202609230005), pas une absence de migration, et se
  // confondrait sinon avec le cas « role non attribue ».
  if (error) {
    console.error("admin_user_roles read:", error);
    return byAdmin;
  }

  for (const row of data ?? []) {
    const record = row as Record<string, unknown>;
    // PostgREST rend un objet pour un embed « plusieurs vers un » ; on accepte
    // aussi le tableau, la cardinalite etant deduite du schema et non promise
    // par le contrat.
    const embedded = record.admin_roles;
    const role = (Array.isArray(embedded) ? embedded[0] : embedded) as
      | { code?: string | null; label?: string | null }
      | null
      | undefined;
    if (!role) continue;
    byAdmin.set(record.admin_id as string, {
      code: role.code ?? null,
      label: role.label ?? null,
    });
  }

  return byAdmin;
}
