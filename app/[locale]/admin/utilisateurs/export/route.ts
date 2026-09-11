import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { listUsers } from "@/lib/queries/users";

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

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
  const params = request.nextUrl.searchParams;

  const rows: Record<string, unknown>[] = [];
  const PAGE_LIMIT = 40; // 40 x 25 = 1 000 lignes au plus, sans requete illimitee.
  for (let page = 1; page <= PAGE_LIMIT; page += 1) {
    const result = await listUsers({
      q: params.get("q") ?? undefined,
      role: params.get("role") ?? undefined,
      statut: params.get("statut") ?? undefined,
      actif: params.get("actif") ?? undefined,
      suppression: params.get("suppression") ?? undefined,
      page,
    });
    if (result.error) return Response.json({ error: result.error }, { status: 500 });
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

  const content = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csv(row[column])).join(",")),
  ].join("\n");

  // BOM en tete : sans lui, Excel lit l'UTF-8 comme du Latin-1 et casse les
  // accents des noms.
  return new Response(`﻿${content}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ifriqiya-comptes-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
