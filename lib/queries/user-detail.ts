import { createClient } from "@/lib/supabase/server";
import type { ProfileSummary } from "@/lib/queries/profiles";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

/** Fiche complete d'un compte, cote §12.1 « consultation et modification ». */
export async function getUserDetail(profileId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, role, email, phone, full_name, locale, is_active, is_minor, deactivated_at, deletion_requested_at, cgu_accepted_at, privacy_accepted_at, last_login_at, created_at, updated_at",
    )
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) return null;

  const isPlayer = profile.role === "player";
  const isProfessional = profile.role === "professional";

  const [player, professional] = await Promise.all([
    isPlayer
      ? supabase.from("player_profiles").select("*").eq("id", profileId).maybeSingle()
      : Promise.resolve({ data: null }),
    isProfessional
      ? supabase.from("professional_profiles").select("*").eq("id", profileId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    profile: profile as Omit<ProfileSummary, "avatar_url"> & {
      locale: string | null;
      deactivated_at: string | null;
      cgu_accepted_at: string | null;
      privacy_accepted_at: string | null;
      updated_at: string;
    },
    player: player.data as Record<string, unknown> | null,
    professional: professional.data as Record<string, unknown> | null,
  };
}

/** Pieces justificatives et KYC rattaches au compte. */
export async function getUserDossier(profileId: string, role: string) {
  const supabase = await createClient();

  const [identity, guardians, documents] = await Promise.all([
    role === "player"
      ? supabase
          .from("identity_verifications")
          .select(
            "id, document_type, storage_path, status, rejection_reason, facial_check_provider, facial_check_passed, reviewed_at, created_at",
          )
          .eq("player_id", profileId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    role === "player"
      ? supabase
          .from("legal_guardians")
          .select(
            "id, full_name, relationship, email, phone, consent_given, consent_given_at, status, id_document_storage_path, consent_document_storage_path",
          )
          .eq("player_id", profileId)
      : Promise.resolve({ data: [] }),
    role === "professional"
      ? supabase
          .from("professional_documents")
          .select("id, document_label, storage_path, status, reviewed_at, created_at")
          .eq("professional_id", profileId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return {
    identity: (identity.data ?? []) as Record<string, string | boolean | null>[],
    guardians: (guardians.data ?? []) as Record<string, string | boolean | null>[],
    documents: (documents.data ?? []) as Record<string, string | null>[],
  };
}

/** Contenus produits par le compte, pour la moderation ciblee (§12.2). */
/**
 * Les medias du compte, plus quatre compteurs.
 *
 * Les publications, commentaires, signalements et blocages ne sont plus
 * *listes* sur la fiche — ils se traitent dans « Moderation ». On n'en garde
 * donc que le nombre, et on le demande en `count: exact, head: true` : la
 * version precedente chargeait cinquante lignes de chaque table pour en lire
 * la longueur.
 */
export async function getUserContent(profileId: string, role: string) {
  const supabase = await createClient();

  const [videos, photos, cvs, posts, reportsAbout, blocksReceived] = await Promise.all([
    role === "player"
      ? supabase
          .from("player_videos")
          .select("id, title, youtube_url, storage_path, thumbnail_url, duration_sec, created_at")
          .eq("player_id", profileId)
          .order("position")
      : Promise.resolve({ data: [] }),
    role === "player"
      ? supabase
          .from("player_photos")
          .select("id, storage_path, caption, created_at")
          .eq("player_id", profileId)
          .order("position")
      : Promise.resolve({ data: [] }),
    role === "player"
      ? supabase
          .from("player_cv_documents")
          .select("id, storage_path, generated_at, is_current")
          .eq("player_id", profileId)
          .order("generated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", profileId),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("target_id", profileId),
    // Blocages recus : lisibles par l'administration (`blocks_admin_read`)
    // mais jamais modifiables par elle — c'est une decision d'utilisateur.
    supabase
      .from("user_blocks")
      .select("blocker_id", { count: "exact", head: true })
      .eq("blocked_id", profileId),
  ]);

  return {
    videos: (videos.data ?? []) as Record<string, string | number | null>[],
    photos: (photos.data ?? []) as Record<string, string | null>[],
    cvs: (cvs.data ?? []) as Record<string, string | boolean | null>[],
    postsCount: posts.count ?? 0,
    reportsAboutCount: reportsAbout.count ?? 0,
    blocksReceivedCount: blocksReceived.count ?? 0,
  };
}

/** Abonnements, paiements, inscriptions et activite mesurable du compte. */
export async function getUserFinances(profileId: string, role: string) {
  const supabase = await createClient();

  const [subscriptions, payments, plans, registrations, views, favorites] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("id, plan_id, status, starts_at, ends_at, cancelled_at, auto_renew, created_at")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select(
          "id, payment_type, amount, currency, method, status, provider_reference, paid_at, manually_activated_at, created_at",
        )
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false }),
      supabase.from("subscription_plans").select("id, code, label, price_amount, price_currency"),
      role === "player"
        ? supabase
            .from("scout_day_registrations")
            .select("id, scout_day_id, status, is_eligible, registered_at")
            .eq("player_id", profileId)
            .order("registered_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      role === "player"
        ? supabase
            .from("profile_views")
            .select("id", { count: "exact", head: true })
            .eq("player_id", profileId)
        : Promise.resolve({ count: 0 }),
      role === "player"
        ? supabase
            .from("favorites")
            .select("player_id", { count: "exact", head: true })
            .eq("player_id", profileId)
        : Promise.resolve({ count: 0 }),
    ]);

  const scoutDayIds = (registrations.data ?? []).map(
    (row: Record<string, unknown>) => row.scout_day_id as string,
  );
  const { data: scoutDays } = await supabase
    .from("scout_days")
    .select("id, title, event_date, location")
    .in("id", scoutDayIds.length ? scoutDayIds : [EMPTY_UUID]);

  return {
    subscriptions: (subscriptions.data ?? []) as Record<string, string | boolean | null>[],
    payments: (payments.data ?? []) as Record<string, string | number | null>[],
    plans: new Map(
      (plans.data ?? []).map((row: Record<string, unknown>) => [row.id as string, row]),
    ),
    registrations: (registrations.data ?? []) as Record<string, string | boolean | null>[],
    scoutDays: new Map(
      (scoutDays ?? []).map((row: Record<string, unknown>) => [row.id as string, row]),
    ),
    viewsCount: ("count" in views ? views.count : 0) ?? 0,
    favoritesCount: ("count" in favorites ? favorites.count : 0) ?? 0,
  };
}
