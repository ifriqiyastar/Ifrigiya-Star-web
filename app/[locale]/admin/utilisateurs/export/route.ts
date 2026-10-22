import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { csvCell, csvDocument, csvResponse } from "@/lib/csv";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { listUsers } from "@/lib/queries/users";

/**
 * Export CSV de l'annuaire, **avec les filtres de l'ecran**.
 *
 * Le bouton se trouve a cote des filtres : exporter autre chose que ce qui est
 * affiche serait un piege. Les parametres d'URL sont donc les memes que ceux de
 * la page. L'export s'arrete a 1 000 lignes (40 pages de 25) — au-dela, c'est
 * une extraction SQL qu'il faut, pas un telechargement de navigateur.
 */
export async function GET(request: NextRequest) {
  await requirePermission("users.read");
  const i18n = await getRequestAdminI18n();
  const params = request.nextUrl.searchParams;

  const rows: Record<string, unknown>[] = [];
  // Le total annonce par la requete, garde pour la derniere ligne du fichier :
  // l'export s'arrete a 1 000 lignes et ne le disait pas.
  let total = 0;
  const PAGE_LIMIT = 40; // 40 x 25 = 1 000 lignes au plus, sans requete illimitee.
  for (let page = 1; page <= PAGE_LIMIT; page += 1) {
    const result = await listUsers({
      q: params.get("q") ?? undefined,
      role: params.get("role") ?? undefined,
      statut: params.get("statut") ?? undefined,
      actif: params.get("actif") ?? undefined,
      suppression: params.get("suppression") ?? undefined,
      page,
      signAvatars: false,
    });
    if (result.error) return Response.json({ error: result.error }, { status: 500 });
    total = result.total;
    rows.push(...result.rows);
    if (rows.length >= result.total) break;
  }

  const columns = [
    "id",
    "full_name",
    "email",
    "phone",
    "role",
    "businessStatus",
    "detail",
    "is_active",
    "is_minor",
    "deletion_requested_at",
    "last_login_at",
    "created_at",
  ] as const;

  return csvResponse(
    csvDocument({
      columns,
      rows: rows.map((row) => columns.map((column) => csvCell(row[column]))),
      notice:
        total > rows.length
          ? i18n.t(
              "Export limite aux {limite} premieres lignes sur {total}. Affinez les filtres de l'ecran pour obtenir le reste.",
              { limite: i18n.format.formatNumber(rows.length), total: i18n.format.formatNumber(total) },
            )
          : null,
    }),
    "comptes",
  );
}
