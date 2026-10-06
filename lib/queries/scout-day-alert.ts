import { createClient } from "@/lib/supabase/server";
import { ALERT_LIMIT, type PendingScoutDay } from "@/lib/scout-day-alert";

/**
 * Les Scout Days qui attendent une validation, du dernier soumis au plus
 * ancien — meme convention que toutes les listes du back-office. Le temps
 * d'attente affiche sur chaque carte dit lequel est en retard.
 *
 * Lu par le layout pour l'alerte de `components/admin/scout-day-alert.tsx`,
 * et seulement pour qui detient `events.validate` : l'alerte propose
 * « Valider », et ce bouton ne doit apparaitre qu'a qui l'action laissera
 * passer.
 *
 * Tolerante : une erreur (migration 0040 absente, RLS) rend une liste vide.
 * Une alerte qui ne s'ouvre pas vaut mieux qu'un back-office qui ne se charge
 * plus — elle est rendue sur toutes les pages.
 */
export async function fetchPendingScoutDays(): Promise<{ rows: PendingScoutDay[]; total: number }> {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("scout_days")
    .select(
      "id, title, event_date, start_time, location, capacity, is_paid, price_amount, price_currency, submitted_at, organizer_id",
      { count: "exact" },
    )
    .eq("status", "en_attente_validation")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(ALERT_LIMIT);

  if (error) {
    console.error("scout-day alert read:", error);
    return { rows: [], total: 0 };
  }

  const organizerIds = [...new Set((data ?? []).map((row) => row.organizer_id).filter(Boolean))];
  const { data: organizers } = organizerIds.length
    ? await supabase
        .from("professional_profiles")
        .select("id, contact_full_name, organization_name")
        .in("id", organizerIds)
    : { data: [] as { id: string; contact_full_name: string | null; organization_name: string | null }[] };
  const organizerById = new Map(
    (organizers ?? []).map((row) => [
      row.id,
      [row.contact_full_name, row.organization_name].filter(Boolean).join(" — ") || null,
    ]),
  );

  return {
    rows: (data ?? []).map(({ organizer_id, ...row }) => ({
      ...row,
      organizer: organizerById.get(organizer_id) ?? null,
    })),
    total: count ?? data?.length ?? 0,
  };
}
