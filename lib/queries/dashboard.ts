import { createClient } from "@/lib/supabase/server";

/**
 * Formes renvoyees par `public.get_admin_dashboard()` (migration 0011 de l'app
 * mobile, deja appliquee sur le projet Supabase). La fonction est
 * SECURITY DEFINER et leve « Reserve aux administrateurs » si `is_admin()` est
 * faux : c'est notre garantie que ces agregats ne fuient pas.
 */
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

export async function getDashboard(periodDays = 30) {
  const supabase = await createClient();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const sincePeriod = new Date(Date.now() - periodDays * 86_400_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [
    rpc,
    visiblePlayers,
    active7d,
    active30d,
    pendingReports,
    pendingPayments,
    docsPending,
    activePeriod,
    paymentsTotal,
    paymentsSucceeded,
    nextEvent,
    approvals,
    plans,
    planSubscriptions,
  ] = await Promise.all([
    supabase.rpc("get_admin_dashboard"),
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
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente"),
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
    payload: (rpc.data ?? null) as DashboardPayload | null,
    error: rpc.error?.message ?? null,
    visiblePlayers: visiblePlayers.count ?? 0,
    active7d: active7d.count ?? 0,
    active30d: active30d.count ?? 0,
    pendingReports: pendingReports.count ?? 0,
    pendingPayments: pendingPayments.count ?? 0,
    docsPending: docsPending.count ?? 0,
    activePeriod: activePeriod.count ?? 0,
    paymentsTotal: paymentsTotal.count ?? 0,
    paymentsSucceeded: paymentsSucceeded.count ?? 0,
    nextEvent: nextEvent.data as {
      id: string;
      title: string;
      event_date: string;
      start_time: string | null;
      location: string | null;
      capacity: number | null;
    } | null,
    nextEventRegistrations,
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
