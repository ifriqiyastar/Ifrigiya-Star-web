import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { csvCell, csvDocument, csvResponse } from "@/lib/csv";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { fetchProfilesByIds } from "@/lib/queries/profiles";
import { orLikeTerm } from "@/lib/queries/search-term";
import { createClient } from "@/lib/supabase/server";

/**
 * Les Scout Days en CSV, **avec les filtres de l'ecran** — statut, gratuit ou
 * payant, recherche sur le titre et le lieu, dans cet ordre et avec le meme
 * echappement que la liste.
 *
 * ⚠️ VOLONTAIREMENT SANS LES COLONNES DE LA MIGRATION 0040
 * (`submitted_at`, `validated_at`…), pour la meme raison que la liste : les
 * demander ferait echouer tout l'export en `42703` tant que 0040 n'est pas
 * appliquee. Les inscriptions sont comptees a part, par evenement exporte, en
 * une requete et non une par ligne.
 */
const PAGE_SIZE = 1_000;

export async function GET(request: NextRequest) {
  await requirePermission("events.manage");
  const i18n = await getRequestAdminI18n();
  const params = request.nextUrl.searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("scout_days")
    .select(
      "id, organizer_id, title, event_date, start_time, location, capacity, is_paid, price_amount, price_currency, status, created_at",
      // `count` : le fichier doit pouvoir dire ce que le plafond laisse dehors.
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const statut = params.get("statut");
  const paye = params.get("paye");
  const q = params.get("q")?.trim();
  if (statut) query = query.eq("status", statut);
  if (paye === "oui") query = query.eq("is_paid", true);
  if (paye === "non") query = query.eq("is_paid", false);
  if (q) {
    const term = orLikeTerm(q);
    query = query.or(`title.ilike.${term},location.ilike.${term}`);
  }

  const { data, error, count } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];
  const total = count ?? rows.length;

  // Organisateurs et inscriptions : deux requetes pour tout l'export, jamais
  // une par ligne. Les inscriptions annulees ou refusees ne comptent pas, comme
  // partout ailleurs dans le back-office.
  const [organizers, registrations] = await Promise.all([
    fetchProfilesByIds(
      rows.map((row) => row.organizer_id as string),
      { signAvatars: false },
    ),
    rows.length
      ? supabase
          .from("scout_day_registrations")
          .select("scout_day_id, status")
          .in(
            "scout_day_id",
            rows.map((row) => row.id as string),
          )
      : Promise.resolve({ data: [] as { scout_day_id: string; status: string }[] }),
  ]);

  const counts = new Map<string, number>();
  for (const row of (registrations.data ?? []) as { scout_day_id: string; status: string }[]) {
    if (row.status === "annule" || row.status === "refuse") continue;
    counts.set(row.scout_day_id, (counts.get(row.scout_day_id) ?? 0) + 1);
  }

  const columns = [
    "id",
    "title",
    "event_date",
    "start_time",
    "location",
    "capacity",
    "status",
    "is_paid",
    "price_amount",
    "price_currency",
    "created_at",
  ] as const;

  return csvResponse(
    csvDocument({
      columns: [...columns, "organisateur", "email_organisateur", "inscriptions"],
      rows: rows.map((row) => {
        const organizer = organizers.get(row.organizer_id as string);
        return [
          ...columns.map((column) => csvCell(row[column])),
          csvCell(organizer?.full_name),
          csvCell(organizer?.email),
          csvCell(counts.get(row.id as string) ?? 0),
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
    "scout-days",
  );
}
