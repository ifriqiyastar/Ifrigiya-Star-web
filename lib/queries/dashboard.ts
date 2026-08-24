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

  const [
    rpc,
    visiblePlayers,
    active7d,
    active30d,
    pendingReports,
    pendingPayments,
    docsPending,
    activePeriod,
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
  ]);

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
  };
}
