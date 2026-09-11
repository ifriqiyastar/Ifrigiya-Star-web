"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, fail, ok, type ActionResult } from "@/lib/actions/result";
import type { PaymentStatus, SubscriptionStatus } from "@/lib/labels";

/** Actions §10.3 / §12.3 — suivi des paiements et des abonnements. */

const REFRESH = () => revalidatePath("/[locale]/admin", "layout");

/**
 * §10.3 — activation manuelle d'un paiement encaisse hors ligne (especes,
 * virement). Le statut dedie `active_manuellement` existe justement pour ne
 * pas confondre ces encaissements avec ceux du prestataire de paiement, et
 * les colonnes `manually_activated_by/at` gardent la trace de qui a valide.
 */
export async function activatePaymentManually(paymentId: string): Promise<ActionResult> {
  const admin = await requirePermission("finance.manage");
  const supabase = await createClient();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("payments")
    .update({
      status: "active_manuellement",
      manually_activated_by: admin.userId,
      manually_activated_at: now,
      paid_at: now,
    })
    .eq("id", paymentId);

  if (error) return fail(describeError(error));

  await logAdminAction("activate_payment_manually", "payment", paymentId);
  REFRESH();
  return ok("Paiement active manuellement.");
}

export async function setPaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  reason?: string,
): Promise<ActionResult> {
  await requirePermission("finance.manage");
  const supabase = await createClient();

  const { error } = await supabase
    .from("payments")
    .update({
      status,
      // `paid_at` est ce que lit la vue des revenus : il ne doit etre pose que
      // pour un encaissement effectif.
      paid_at: status === "reussi" ? new Date().toISOString() : null,
    })
    .eq("id", paymentId);

  if (error) return fail(describeError(error));

  await logAdminAction(`payment_${status}`, "payment", paymentId, {
    status,
    reason: reason?.trim() || null,
  });
  REFRESH();
  return ok(`Paiement : ${status.replace(/_/g, " ")}.`);
}

export async function setSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
): Promise<ActionResult> {
  await requirePermission("finance.manage");
  const supabase = await createClient();

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status,
      cancelled_at: status === "annulee" ? new Date().toISOString() : null,
    })
    .eq("id", subscriptionId);

  if (error) return fail(describeError(error));

  await logAdminAction(`subscription_${status}`, "subscription", subscriptionId, { status });
  REFRESH();
  return ok(`Abonnement : ${status.replace(/_/g, " ")}.`);
}
