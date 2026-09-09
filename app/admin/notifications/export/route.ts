import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

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

/** Journal des campagnes en CSV, filtre par statut comme l'ecran. */
export async function GET(request: NextRequest) {
  await requirePermission("notifications.manage");
  const supabase = await createClient();

  let query = supabase
    .from("admin_notification_campaigns")
    .select(COLUMNS.join(","))
    .order("created_at", { ascending: false })
    .limit(5000);

  const statut = request.nextUrl.searchParams.get("statut");
  if (statut) query = query.eq("status", statut);

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
      "content-disposition": `attachment; filename="ifriqiya-campagnes-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
