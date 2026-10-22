import { requirePermission } from "@/lib/auth";
import { csvCell, csvDocument, csvResponse } from "@/lib/csv";
import { EVALUATION_AXES, LEGACY_EVALUATION_AXES } from "@/lib/evaluation-axes";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { fetchProfilesByIds } from "@/lib/queries/profiles";
import { EMPTY_ID } from "@/lib/queries/validations-shared";
import { createClient } from "@/lib/supabase/server";

/**
 * Les rapports de scouting en CSV. Le dernier ecran de liste qui n'avait pas
 * son export, et celui dont les donnees le demandaient le plus : six notes par
 * ligne, un score global calcule par Postgres, et un commentaire.
 *
 * ⚠️⚠️ **LES DIX COLONNES DE NOTES SORTENT, PAS SIX.** Depuis la migration
 * mobile 0091 une evaluation porte six axes (Vitesse, Finition, Precision,
 * Passe, Defense, Cognitif) ; celles ecrites avant en portent quatre
 * (technique, physique, tactique, mental), et **aucune conversion n'existe
 * entre les deux** — personne ne peut deduire une « Precision » d'une
 * « technique ». Le fichier rend donc les deux jeux, vides la ou la ligne n'en
 * porte pas : une colonne vide dit « non note », un zero dirait « nul ».
 *
 * `overall_score` est lu, jamais recalcule : c'est une colonne generee par
 * Postgres, et la recalculer ici ferait diverger deux chiffres du meme nom.
 */
const AXIS_COLUMNS = [...EVALUATION_AXES, ...LEGACY_EVALUATION_AXES].map(
  (axis) => `${axis.key}_score`,
);

const COLUMNS = [
  "id",
  "registration_id",
  "scout_day",
  "joueur",
  "email_joueur",
  "evaluateur",
  ...AXIS_COLUMNS,
  "overall_score",
  "comment",
  "visible_to_player",
  "created_at",
];

/** Deux mille rapports : au-dela, c'est une extraction SQL qu'il faut. */
const EXPORT_LIMIT = 2_000;

export async function GET() {
  await requirePermission("evaluations.manage");
  const i18n = await getRequestAdminI18n();
  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from("scout_evaluations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(EXPORT_LIMIT);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Record<string, unknown>[];
  const registrationIds = rows.map((row) => String(row.registration_id ?? ""));
  const evaluatorIds = rows.map((row) => String(row.evaluator_id ?? ""));

  // Inscriptions et evaluateurs : une requete par table, jamais une par ligne.
  const [{ data: registrations }, { data: evaluators }] = await Promise.all([
    supabase
      .from("scout_day_registrations")
      .select("id, player_id, scout_day_id")
      .in("id", registrationIds.length ? registrationIds : [EMPTY_ID]),
    supabase
      .from("professional_profiles")
      .select("id, contact_full_name, organization_name")
      .in("id", evaluatorIds.length ? evaluatorIds : [EMPTY_ID]),
  ]);

  const registrationById = new Map(
    (registrations ?? []).map((row) => [row.id as string, row]),
  );
  const scoutDayIds = [
    ...new Set((registrations ?? []).map((row) => row.scout_day_id as string).filter(Boolean)),
  ];
  const [{ data: scoutDays }, players] = await Promise.all([
    supabase
      .from("scout_days")
      .select("id, title")
      .in("id", scoutDayIds.length ? scoutDayIds : [EMPTY_ID]),
    fetchProfilesByIds(
      (registrations ?? []).map((row) => row.player_id as string),
      { signAvatars: false },
    ),
  ]);
  const titleById = new Map((scoutDays ?? []).map((row) => [row.id as string, row.title as string]));
  const evaluatorById = new Map((evaluators ?? []).map((row) => [row.id as string, row]));

  const total = count ?? rows.length;
  return csvResponse(
    csvDocument({
      columns: COLUMNS,
      rows: rows.map((row) => {
        const registration = registrationById.get(String(row.registration_id ?? ""));
        const player = registration ? players.get(registration.player_id as string) : undefined;
        const evaluator = evaluatorById.get(String(row.evaluator_id ?? ""));
        return [
          csvCell(row.id),
          csvCell(row.registration_id),
          csvCell(registration ? titleById.get(registration.scout_day_id as string) : null),
          csvCell(player?.full_name),
          csvCell(player?.email),
          csvCell(evaluator?.contact_full_name ?? evaluator?.organization_name),
          // ⚠️ `row[column] ?? null` et non `Number(row[column])` : `Number(null)`
          // vaut 0, et un axe non note sortirait a zero — la ligne se lirait
          // comme un joueur qui a tout rate.
          ...AXIS_COLUMNS.map((column) => csvCell(row[column] ?? null)),
          csvCell(row.overall_score),
          csvCell(row.comment),
          csvCell(row.visible_to_player),
          csvCell(row.created_at),
        ];
      }),
      notice:
        total > rows.length
          ? i18n.t(
              "Export limite aux {limite} premieres lignes sur {total}. Affinez les filtres de l'ecran pour obtenir le reste.",
              { limite: i18n.format.formatNumber(rows.length), total: i18n.format.formatNumber(total) },
            )
          : null,
    }),
    "evaluations",
  );
}
