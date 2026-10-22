import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { csvCell, csvDocument, csvResponse } from "@/lib/csv";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { orLikeTerm } from "@/lib/queries/search-term";
import { createClient } from "@/lib/supabase/server";

const COLUMNS = [
  "id",
  "title",
  "body",
  "target_type",
  "target_value",
  "channels",
  "status",
  "recipient_count",
  "error_message",
  "created_by",
  "created_at",
] as const;

/**
 * Journal des campagnes en CSV, filtre **exactement comme l'ecran**.
 *
 * Les trois filtres sont rejoues a l'identique : un export qui ignorerait la
 * recherche rendrait un fichier different de ce que l'administrateur a sous
 * les yeux au moment ou il clique.
 */
export async function GET(request: NextRequest) {
  await requirePermission("notifications.manage");
  const i18n = await getRequestAdminI18n();
  const supabase = await createClient();

  let query = supabase
    .from("admin_notification_campaigns")
    // `count` : voir `lib/csv.ts` — un export tronque doit l'avouer.
    .select(COLUMNS.join(","), { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(5000);

  const params = request.nextUrl.searchParams;
  const statut = params.get("statut");
  if (statut) query = query.eq("status", statut);
  const cible = params.get("cible");
  if (cible) query = query.eq("target_type", cible);
  const q = params.get("q");
  if (q) {
    const term = orLikeTerm(q);
    query = query.or(`title.ilike.${term},body.ilike.${term}`);
  }

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

  return csvResponse(content, "campagnes");
}
