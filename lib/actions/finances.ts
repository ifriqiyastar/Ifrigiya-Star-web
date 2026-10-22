"use server";

import { getRequestAdminI18n } from "@/lib/i18n/admin";


import { PAYMENT_STATUS, SUBSCRIPTION_STATUS } from "@/lib/labels";

import { revalidatePath } from "next/cache";

import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { makeErrors, fail, ok, type ActionResult } from "@/lib/actions/result";
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
  const i18n = await getRequestAdminI18n();

  const admin = await requirePermission("finance.manage");
  const supabase = await createClient();

  const now = new Date().toISOString();
  // ⚠️ `.select("id")` : PostgREST ne LÈVE PAS quand la RLS écarte la ligne
  // visée — la mise à jour touche zéro ligne et répond « succès ». Sans ce
  // retour, l'écran annonçait « Paiement activé » alors que rien n'avait
  // changé. C'est la première règle du dépôt, et elle manquait ici.
  const { data: updated, error } = await supabase
    .from("payments")
    .update({
      status: "active_manuellement",
      manually_activated_by: admin.userId,
      manually_activated_at: now,
      paid_at: now,
    })
    .eq("id", paymentId)
    .select("id");

  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  if (!updated?.length) return fail(i18n.t("Ce paiement n'a pas pu etre active."));

  await logAdminAction("activate_payment_manually", "payment", paymentId);
  REFRESH();
  return ok(i18n.t("Paiement active manuellement."));
}

/**
 * §10.3 — l'administrateur enregistre l'encaissement d'une inscription qui
 * n'a encore AUCUNE ligne de paiement.
 *
 * ⚠️⚠️ PAR LA RPC, PAS PAR UN `insert` DANS `payments`. `record_scout_day_payment`
 * porte des gardes que l'écriture directe perdrait : elle refuse un événement
 * gratuit (une ligne de paiement y serait forcément une erreur de saisie qui
 * fausse le relevé), elle refuse une inscription déjà réglée, elle prend le
 * montant dans le TARIF de l'événement plutôt que d'une saisie — un montant
 * retapé divergerait du prix affiché au joueur — et elle pose
 * `active_manuellement`, le statut qui distingue un encaissement hors ligne
 * de celui d'un prestataire. L'application mobile appelle exactement la même
 * fonction depuis l'écran de l'organisateur : un seul comportement, deux
 * interfaces.
 *
 * ⚠️ La RPC autorise déjà l'administrateur en plus de l'organisateur
 * (`... or public.is_admin()`), donc aucune migration n'est nécessaire.
 */
export async function recordScoutDayPayment(registrationId: string): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();

  await requirePermission("finance.manage");
  const supabase = await createClient();

  const { error } = await supabase.rpc("record_scout_day_payment", {
    p_registration_id: registrationId,
  });
  if (error) return fail(makeErrors(i18n.locale).describeError(error));

  await logAdminAction("record_scout_day_payment", "scout_day_registration", registrationId);
  REFRESH();
  return ok(i18n.t("Encaissement enregistre."));
}

/**
 * §10.3 — annuler un encaissement.
 *
 * ⚠️ La ligne n'est pas SUPPRIMÉE, elle passe à « rembourse » : un relevé
 * comptable ne se réécrit pas, il s'annule. La RPC permet ensuite de
 * réencaisser sans buter sur le garde « déjà réglée ».
 */
export async function cancelScoutDayPayment(paymentId: string): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();

  await requirePermission("finance.manage");
  const supabase = await createClient();

  const { error } = await supabase.rpc("refund_scout_day_payment", {
    p_payment_id: paymentId,
  });
  if (error) return fail(makeErrors(i18n.locale).describeError(error));

  await logAdminAction("refund_scout_day_payment", "payment", paymentId);
  REFRESH();
  return ok(i18n.t("Encaissement annule."));
}

export async function setPaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  reason?: string,
): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();

  await requirePermission("finance.manage");
  const supabase = await createClient();

  // ⚠️ `.select("id")` comme pour l'activation manuelle ci-dessus : PostgREST
  // ne leve pas quand la RLS ecarte la ligne visee — zero ligne touchee, et la
  // reponse est un succes. L'ecran annoncait un encaissement que la base
  // n'avait pas enregistre, sur le seul ecran ou un chiffre engage de l'argent.
  const { data: updated, error } = await supabase
    .from("payments")
    .update({
      status,
      // `paid_at` est ce que lit la vue des revenus : il ne doit etre pose que
      // pour un encaissement effectif.
      paid_at: status === "reussi" ? new Date().toISOString() : null,
    })
    .eq("id", paymentId)
    .select("id");

  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  if (!updated?.length) {
    return fail(i18n.t("Aucune ligne modifiee : le statut du paiement n'a pas ete enregistre."));
  }

  await logAdminAction(`payment_${status}`, "payment", paymentId, {
    status,
    reason: reason?.trim() || null,
  });
  REFRESH();
  return ok(i18n.t("Paiement : {0}.", { "0": i18n.labels.label(PAYMENT_STATUS, status) }));
}

export async function setSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();

  await requirePermission("finance.manage");
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("subscriptions")
    .update({
      status,
      cancelled_at: status === "annulee" ? new Date().toISOString() : null,
    })
    .eq("id", subscriptionId)
    .select("id");

  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  if (!updated?.length) {
    return fail(i18n.t("Aucune ligne modifiee : le statut de l'abonnement n'a pas ete enregistre."));
  }

  await logAdminAction(`subscription_${status}`, "subscription", subscriptionId, { status });
  REFRESH();
  return ok(i18n.t("Abonnement : {0}.", { "0": i18n.labels.label(SUBSCRIPTION_STATUS, status) }));
}
