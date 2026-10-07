import { createClient } from "@/lib/supabase/server";

/**
 * Le preavis minimum, en jours, entre le depot d'un Scout Day par son
 * organisateur et la date de l'evenement (demande client du 2026-10-07).
 *
 * `available` dit si le reglage existe en base. Les deux cas qu'il distingue
 * n'ont rien a voir :
 *
 *   * `available: true`  — la table est la, la regle est appliquee par le
 *     trigger `trg_scout_day_min_notice`, et l'ecran peut proposer de la
 *     changer ;
 *   * `available: false` — la migration 202610070001 n'a pas tourne. Rien
 *     n'est applique nulle part, donc l'ecran annonce zero jour et dit
 *     pourquoi, plutot que d'afficher un champ dont l'enregistrement
 *     echouerait.
 *
 * Tolerante par construction : la lecture echoue en `42P01` tant que la
 * migration n'est pas appliquee, et ce reglage est un detail de l'ecran des
 * Scout Days — il ne doit pas en emporter la liste.
 */
export type ScoutDayNotice = { days: number; available: boolean };

export async function fetchScoutDayNotice(): Promise<ScoutDayNotice> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("scout_day_min_notice_days")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) {
    // 42P01 (table absente) est le cas attendu avant la migration et ne
    // merite pas une ligne de journal a chaque rendu de la page.
    if (error && error.code !== "42P01") console.error("platform settings read:", error);
    return { days: 0, available: false };
  }

  const days = Number(data.scout_day_min_notice_days);
  return { days: Number.isFinite(days) ? days : 0, available: true };
}
