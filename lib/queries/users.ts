import { createClient } from "@/lib/supabase/server";
import { PROFILE_COLUMNS, fetchProfilesByIds, type ProfileSummary } from "@/lib/queries/profiles";

export const USERS_PAGE_SIZE = 25;

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

  const rows: UserListRow[] = profiles.map((profile) => {
    const player = playerById.get(profile.id);
    const pro = proById.get(profile.id);
    return {
      ...profile,
      // Joueur : `profile_photo_url` ; professionnel : `photo_url` (migration
      // mobile 0039). Cf. ProfileSummary.avatar_url.
      avatar_url:
        (player?.profile_photo_url as string | null) ?? proPhotoById.get(profile.id) ?? null,
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
