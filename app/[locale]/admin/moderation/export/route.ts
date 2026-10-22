import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { csvCell, csvDocument, csvResponse } from "@/lib/csv";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { createClient } from "@/lib/supabase/server";

const COLUMNS = [
  "id",
  "target_type",
  "target_id",
  "reason",
  "status",
  "moderation_action",
  "quarantined",
  "reporter_id",
  "proposed_by",
  "proposed_at",
  "proposed_action",
  "proposal_reason",
  "decision_reason",
  "handled_by",
  "handled_at",
  "created_at",
] as const;

/**
 * Registre des signalements en CSV — le « Exporter le registre » de l'ecran.
 *
 * Il reprend les filtres de la file (statut, cible), pour que le fichier
 * corresponde a ce qui est affiche. Il ne contient **aucun contenu signale** :
 * seulement les identifiants, le motif ecrit par le signaleur et la trace des
 * decisions. Sortir les publications ou les messages du perimetre du
 * back-office serait une diffusion, pas un export.
 */
export async function GET(request: NextRequest) {
  await requirePermission("moderation.manage");
  const params = request.nextUrl.searchParams;
  const i18n = await getRequestAdminI18n();
  const supabase = await createClient();

  let query = supabase
    .from("reports")
    // `count` : la derniere ligne du fichier doit pouvoir dire combien de
    // signalements le plafond a laisses dehors.
    .select(COLUMNS.join(","), { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(5000);

  const statut = params.get("statut");
  const cible = params.get("cible");
  if (statut) query = query.eq("status", statut);
  if (cible) query = query.eq("target_type", cible);

  const { data, error, count } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const total = count ?? rows.length;
  const content = csvDocument({
    columns: COLUMNS,
    rows: rows.map((row) => COLUMNS.map((column) => csvCell(row[column]))),
    notice:
      total > rows.length
        ? i18n.t(
            "Export limite aux {limite} premieres lignes sur {total}. Affinez les filtres de l'ecran pour obtenir le reste.",
            { limite: i18n.format.formatNumber(rows.length), total: i18n.format.formatNumber(total) },
          )
        : null,
  });

  return csvResponse(content, "signalements");
}
