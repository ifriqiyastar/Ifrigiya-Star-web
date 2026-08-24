import { createHmac, timingSafeEqual } from "node:crypto";

import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  const signature = request.headers.get("x-webhook-signature");
  if (!secret || !signature) return Response.json({ error: "Webhook non configure" }, { status: 503 });
  const raw = await request.text();
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const valid = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return Response.json({ error: "Signature invalide" }, { status: 401 });

  let event: { reference?: string; status?: string; amount?: number };
  try { event = JSON.parse(raw); } catch { return Response.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!event.reference || !["paid", "failed", "cancelled", "refunded", "partially_refunded"].includes(event.status ?? "")) {
    return Response.json({ error: "Evenement invalide" }, { status: 400 });
  }
  const service = createServiceClient();
  if (!service) return Response.json({ error: "Service role non configure" }, { status: 503 });
  const statusMap: Record<string, string> = { paid: "reussi", failed: "echoue", cancelled: "echoue", refunded: "rembourse", partially_refunded: "rembourse" };
  const { error } = await service.from("payments").update({ status: statusMap[event.status!], paid_at: event.status === "paid" ? new Date().toISOString() : null }).eq("provider_reference", event.reference);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ received: true });
}
