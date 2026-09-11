import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET() {
  await requirePermission("finance.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, profile_id, payment_type, amount, currency, method, status, provider_reference, paid_at, created_at")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const columns = ["id", "profile_id", "payment_type", "amount", "currency", "method", "status", "provider_reference", "paid_at", "created_at"] as const;
  const content = [columns.join(","), ...(data ?? []).map((row) => columns.map((column) => csv(row[column])).join(","))].join("\n");
  return new Response(`\uFEFF${content}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ifriqiya-paiements-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
