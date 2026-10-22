import { isMissingRpc } from "@/lib/actions/result";
import {
  periodRevenueFromRow,
  type PeriodRevenue,
  type RawRevenueKeys,
} from "@/lib/queries/dashboard-revenue";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Formes renvoyees par `public.get_admin_dashboard()` (migration 0011 de l'app
 * mobile, deja appliquee sur le projet Supabase). La fonction est
 * SECURITY DEFINER et leve « Reserve aux administrateurs » si `is_admin()` est
 * faux : c'est notre garantie que ces agregats ne fuient pas.
 */
// Les formes des revenus vivent dans un module neutre, pour etre testables
// sans client Supabase ; on les re-expose ici, ou les appelants les cherchent
// deja.
export type {
  MonthlyRevenueRow,
  PeriodRevenue,
  RevenueBucket,
  RevenueSeriesRow,
} from "@/lib/queries/dashboard-revenue";
export { monthlySeries } from "@/lib/queries/dashboard-revenue";

export type DashboardPayload = {
  users: { role: string; total: number; actifs: number; nouveaux_30j: number }[] | null;
  players: { status: string; total: number }[] | null;
  subscriptions: { plan: string; status: string; total: number }[] | null;
  revenue:
    | {
        mois: string | null;
        payment_type: string;
        revenu_encaisse: number | null;
        nb_transactions_reussies: number | null;
      }[]
    | null;
  scout_days: {
    total_evenements: number;
    publies: number;
    total_inscriptions: number;
  } | null;
};

/**
 * Les chiffres du tableau de bord qui ne viennent pas de
 * `get_admin_dashboard()`. Une seule forme, deux chemins pour la remplir.
 */
export type DashboardExtras = {
  visiblePlayers: number;
  active7d: number;
  active30d: number;
  pendingReports: number;
  docsPending: number;
  activePeriod: number;
  paymentsTotal: number;
  paymentsSucceeded: number;
  nextEvent: NextEvent | null;
  nextEventRegistrations: number;
  /** `null` = la base ne sait pas fenetrer les revenus ; voir `PeriodRevenue`. */
  revenue: PeriodRevenue | null;
  /** En millisecondes. `null` quand aucun dossier n'est exploitable. */
  approvalDelay: number | null;
  plans: DashboardPlan[];
};

export type NextEvent = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  location: string | null;
  capacity: number | null;
};

export type DashboardPlan = {
  id: string;
  code: string;
  label: string;
  targetRole: string;
  priceAmount: number;
  priceCurrency: string;
  billingPeriodMonths: number;
  isActive: boolean;
  activeCount: number;
};

export async function getDashboard(periodDays = 30) {
  const supabase = await createClient();

  // ⚠️ DEUX APPELS, PAS QUINZE. `get_admin_dashboard()` vient de l'app mobile
  // (migration 0011) et rend les agregats ; `admin_dashboard_counts()` est
  // propre a ce depot (202610220001, puis 202610230001 pour le fenetrage des
  // revenus) et rend les douze lectures que ce fichier posait a cote,
  // inscriptions du prochain evenement comprises — elles coutaient une vague
  // de plus, puisqu'elles dependaient de l'evenement trouve par la
  // precedente.
  const [rpc, fast] = await Promise.all([
    supabase.rpc("get_admin_dashboard"),
    supabase.rpc("admin_dashboard_counts", { p_period_days: periodDays }),
  ]);

  // La regle du depot : degrader a l'ouverture. Fonction absente (migration
  // pas passee) ou execution revoquee, et les douze lectures d'origine
  // reprennent la main — l'ecran est plus lent, il n'est pas casse.
  let extras: DashboardExtras;
  if (fast.error) {
    // ⚠️ `42501` EST SIGNALE ICI, contrairement a `loadAdminGuard()`. Pour
    // cette fonction-la il ne veut pas dire « execution deliberement
    // revoquee » mais « le `grant execute ... to authenticated` de la
    // migration n'est pas passe » : l'appelant est deja administrateur, et
    // l'ecran retomberait alors sur ses treize lectures en silence —
    // resultat juste, lenteur d'avant, et rien pour le dire. Seule l'absence
    // de la fonction (`PGRST202`) est un etat normal : projet non migre.
    if (!isMissingRpc(fast.error)) {
      console.error("admin_dashboard_counts:", fast.error.code, fast.error.message);
    }
    extras = await dashboardExtrasBySeparateReads(supabase, periodDays);
  } else {
    extras = extrasFromRow((fast.data ?? {}) as CountsRow);
  }

  return {
    payload: (rpc.data ?? null) as DashboardPayload | null,
    error: rpc.error?.message ?? null,
    ...extras,
  };
}

/**
 * La ligne rendue par `public.admin_dashboard_counts()`.
 *
 * ⚠️ Les cles de revenus viennent de `RawRevenueKeys` et sont toutes
 * OPTIONNELLES : une base portant la version precedente de la fonction ne les
 * rend pas, et `periodRevenueFromRow()` repond alors `null` plutot que zero.
 */
type CountsRow = RawRevenueKeys & {
  visible_players?: number;
  active_7d?: number;
  active_30d?: number;
  active_period?: number;
  pending_reports?: number;
  docs_pending?: number;
  payments_total?: number;
  payments_succeeded?: number;
  approval_delay_ms?: number | string | null;
  next_event?: NextEvent | null;
  next_event_registrations?: number;
  plans?:
    | {
        id: string;
        code: string;
        label: string;
        target_role: string;
        price_amount: number | string | null;
        price_currency: string | null;
        billing_period_months: number | string | null;
        is_active: boolean | null;
        active_count: number | string | null;
      }[]
    | null;
};

/**
 * La meme reponse que le chemin d'origine, lue sur une ligne au lieu de
 * treize requetes. Les deux doivent rendre les memes nombres : deux facons
 * de repondre a la meme question finissent toujours par diverger, et c'est la
 * seule raison pour laquelle ce fichier garde les deux cote a cote.
 */
function extrasFromRow(row: CountsRow): DashboardExtras {
  const delay = row.approval_delay_ms;
  return {
    visiblePlayers: Number(row.visible_players ?? 0),
    active7d: Number(row.active_7d ?? 0),
    active30d: Number(row.active_30d ?? 0),
    pendingReports: Number(row.pending_reports ?? 0),
    docsPending: Number(row.docs_pending ?? 0),
    activePeriod: Number(row.active_period ?? 0),
    paymentsTotal: Number(row.payments_total ?? 0),
    paymentsSucceeded: Number(row.payments_succeeded ?? 0),
    nextEvent: row.next_event ?? null,
    nextEventRegistrations: Number(row.next_event_registrations ?? 0),
    revenue: periodRevenueFromRow(row),
    // ⚠️ `Number(null)` vaut 0, et un delai d'approbation de zero se lirait
    // comme une decision instantanee : l'absence reste `null`.
    approvalDelay: delay === null || delay === undefined ? null : Number(delay),
    plans: (row.plans ?? []).map((plan) => ({
      id: plan.id,
      code: plan.code,
      label: plan.label,
      targetRole: plan.target_role,
      priceAmount: Number(plan.price_amount ?? 0),
      priceCurrency: plan.price_currency ?? "TND",
      billingPeriodMonths: Number(plan.billing_period_months ?? 1),
      isActive: Boolean(plan.is_active),
      activeCount: Number(plan.active_count ?? 0),
    })),
  };
}

/**
 * Le chemin d'origine : douze lectures en une vague, plus une treizieme pour
 * les inscriptions du prochain evenement. Il sert quand
 * `admin_dashboard_counts()` n'est pas deployee.
 *
 * ⚠️ IL NE SAIT PAS FENETRER LES REVENUS, et c'est assume : il rend
 * `revenue: null`, ce qui fait afficher les douze derniers mois de la vue
 * mobile **en le disant**. Reproduire ici le decoupage a la journee voudrait
 * dire ramener les paiements de la periode ligne a ligne pour les agreger en
 * JavaScript — donc un plafond de lignes, donc une somme silencieusement
 * tronquee sous un intitule qui promet un total.
 */
async function dashboardExtrasBySeparateReads(
  supabase: SupabaseClient,
  periodDays: number,
): Promise<DashboardExtras> {
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const sincePeriod = new Date(Date.now() - periodDays * 86_400_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [
    visiblePlayers,
    active7d,
    active30d,
    pendingReports,
    docsPending,
    activePeriod,
    paymentsTotal,
    paymentsSucceeded,
    nextEvent,
    approvals,
    plans,
    planSubscriptions,
  ] = await Promise.all([
    // Metriques absentes des vues SQL de la migration 0011.
    supabase
      .from("player_profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_visible", true)
      .eq("status", "valide"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_login_at", since7d),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_login_at", since30d),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "en_attente"),
    // Les paiements en attente ne sont plus lus ici : la tuile « Encaissements
    // en attente » les compte avec les inscriptions a encaisser, depuis le
    // comptage des files que la mise en page a deja fait. Une lecture de
    // moins, et un seul chiffre pour la tuile, la cloche et la pastille.
    supabase
      .from("professional_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_login_at", sincePeriod),
    // Taux de reussite des encaissements : deux comptes, pas une moyenne
    // calculee sur un echantillon de lignes.
    supabase.from("payments").select("id", { count: "exact", head: true }),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .in("status", ["reussi", "active_manuellement"]),
    // Prochain evenement publie : le bandeau de bas d'ecran du tableau de
    // bord. `event_date` est un `date` Postgres, compare en chaine.
    supabase
      .from("scout_days")
      .select("id, title, event_date, start_time, location, capacity")
      .eq("status", "publie")
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    // Delai d'approbation administrative : ecart entre la creation du profil
    // et la decision, sur les 200 derniers profils valides. Deux horodatages
    // reels, aucune moyenne inventee.
    supabase
      .from("player_profiles")
      .select("created_at, status_updated_at")
      .eq("status", "valide")
      .not("status_updated_at", "is", null)
      .order("status_updated_at", { ascending: false })
      .limit(200),
    // Catalogue d'offres et souscriptions actives par offre : le tableau de
    // bord affiche le tarif tel qu'il est enregistre, il ne le calcule pas.
    supabase
      .from("subscription_plans")
      .select(
        "id, code, label, target_role, price_amount, price_currency, billing_period_months, is_active",
      )
      .order("price_amount", { ascending: false }),
    supabase.from("subscriptions").select("plan_id, status"),
  ]);

  // Inscriptions de ce seul evenement : une requete de plus, et seulement s'il
  // y a un evenement a annoncer.
  const nextEventRegistrations = nextEvent.data
    ? ((
        await supabase
          .from("scout_day_registrations")
          .select("id", { count: "exact", head: true })
          .eq("scout_day_id", nextEvent.data.id)
          .not("status", "in", "(annule,refuse)")
      ).count ?? 0)
    : 0;

  return {
    visiblePlayers: visiblePlayers.count ?? 0,
    active7d: active7d.count ?? 0,
    active30d: active30d.count ?? 0,
    pendingReports: pendingReports.count ?? 0,
    docsPending: docsPending.count ?? 0,
    activePeriod: activePeriod.count ?? 0,
    paymentsTotal: paymentsTotal.count ?? 0,
    paymentsSucceeded: paymentsSucceeded.count ?? 0,
    nextEvent: (nextEvent.data ?? null) as NextEvent | null,
    nextEventRegistrations,
    // ⚠️ PAS DE FENETRE A LA JOURNEE SANS LA FONCTION, et c'est volontaire.
    // La reproduire ici voudrait dire ramener les paiements de la periode
    // ligne a ligne pour les agreger en JavaScript — donc un plafond de
    // lignes, donc un total silencieusement tronque sous un intitule qui
    // promet une somme. L'ecran retombe sur les mois de la vue mobile, qui
    // sont exacts, et annonce « 12 derniers mois » au lieu de la periode
    // choisie : la fonction disparait, le chiffre reste vrai.
    revenue: null,
    approvalDelay: averageDelay(approvals.data ?? []),
    plans: (plans.data ?? []).map((plan) => ({
      id: plan.id as string,
      code: plan.code as string,
      label: plan.label as string,
      targetRole: plan.target_role as string,
      priceAmount: Number(plan.price_amount ?? 0),
      priceCurrency: (plan.price_currency as string | null) ?? "TND",
      billingPeriodMonths: Number(plan.billing_period_months ?? 1),
      isActive: Boolean(plan.is_active),
      activeCount: (planSubscriptions.data ?? []).filter(
        (row) => row.plan_id === plan.id && row.status === "active",
      ).length,
    })),
  };
}

/**
 * Moyenne, en millisecondes, de l'ecart entre deux horodatages d'une meme
 * ligne. Renvoie `null` quand aucune ligne n'est exploitable — un « 0 » se
 * lirait comme une decision instantanee.
 */
function averageDelay(rows: { created_at: string; status_updated_at: string | null }[]) {
  const delays = rows
    .filter((row) => row.status_updated_at)
    .map((row) => new Date(row.status_updated_at!).getTime() - new Date(row.created_at).getTime())
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (!delays.length) return null;
  return delays.reduce((acc, value) => acc + value, 0) / delays.length;
}
