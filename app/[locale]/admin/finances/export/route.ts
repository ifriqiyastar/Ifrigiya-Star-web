import { requirePermission } from "@/lib/auth";
import { csvCell, csvDocument, csvResponse } from "@/lib/csv";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { createClient } from "@/lib/supabase/server";

const COLUMNS = [
  "id",
  "profile_id",
  "payment_type",
  "amount",
  "currency",
  "method",
  "status",
  "provider_reference",
  "paid_at",
  "created_at",
] as const;

/** Dix mille lignes : au-dela, c'est une extraction SQL qu'il faut. */
const EXPORT_LIMIT = 10_000;

export async function GET() {
  await requirePermission("finance.manage");
  const i18n = await getRequestAdminI18n();
  const supabase = await createClient();

  // `count` : sans lui, un fichier arrete au plafond se lit comme le registre
  // complet. Avec lui, la derniere ligne dit ce qui manque.
  const { data, error, count } = await supabase
    .from("payments")
    .select(COLUMNS.join(","), { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(EXPORT_LIMIT);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const total = count ?? rows.length;
  return csvResponse(
    csvDocument({
      columns: COLUMNS,
      rows: rows.map((row) => COLUMNS.map((column) => csvCell(row[column]))),
      notice:
        total > rows.length
          ? i18n.t(
              "Export limite aux {limite} premieres lignes sur {total}. Affinez les filtres de l'ecran pour obtenir le reste.",
              { limite: i18n.format.formatNumber(rows.length), total: i18n.format.formatNumber(total) },
            )
          : null,
    }),
    "paiements",
  );
}
