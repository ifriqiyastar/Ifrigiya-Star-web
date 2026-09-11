import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

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
  const supabase = await createClient();

  let query = supabase
    .from("reports")
    .select(COLUMNS.join(","))
    .order("created_at", { ascending: false })
    .limit(5000);

  const statut = params.get("statut");
  const cible = params.get("cible");
  if (statut) query = query.eq("status", statut);
  if (cible) query = query.eq("target_type", cible);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const content = [
    COLUMNS.join(","),
    ...rows.map((row) => COLUMNS.map((column) => csv(row[column])).join(",")),
  ].join("\n");

  return new Response(`﻿${content}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ifriqiya-signalements-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
