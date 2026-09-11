"use server";

import { revalidatePath } from "next/cache";

import { describeError, fail, ok, type ActionResult } from "@/lib/actions/result";
import { logAdminAction, requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * §11/§12 — envoi reel d'une notification depuis le back-office.
 *
 * L'ecran creait jusqu'ici une campagne `queued` et s'arretait la : la
 * livraison attendait « un worker » qui n'existait pas, donc rien n'arrivait
 * jamais chez personne. L'envoi passe desormais par
 * `admin_broadcast_notification()` (migration 0046), qui insere **une ligne
 * par destinataire** dans `public.notifications` — ce qui declenche le push
 * Expo de la migration 0023 et remplit la boite in-app. Une seule logique
 * d'envoi, celle qui existait deja.
 *
 * La campagne reste enregistree : c'est l'historique de ce qui a ete diffuse,
 * avec le nombre de destinataires reellement servis.
 */
export async function sendNotification(formData: FormData): Promise<ActionResult> {
  const admin = await requirePermission("notifications.manage");
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const targetType = String(formData.get("target_type") ?? "all");
  const targetValue = String(formData.get("target_value") ?? "").trim() || null;
  const channels = formData.getAll("channels").map(String);
  if (!title || !body || channels.length === 0) return fail("Titre, message et canal requis.");

  const { data: recipients, error: sendError } = await supabase.rpc(
    "admin_broadcast_notification",
    {
      p_title: title,
      p_body: body,
      p_target_type: targetType,
      p_target_value: targetValue,
    },
  );

  if (sendError) {
    const missing =
      sendError.code === "PGRST202" || /admin_broadcast_notification/i.test(sendError.message ?? "");
    return fail(
      missing
        ? "Envoi indisponible : appliquez la migration 0046_admin_broadcast_notification.sql (depot mobile)."
        : describeError(sendError),
    );
  }

  const count = Number(recipients ?? 0);

  // L'historique enregistre ce qui est **parti**, pas ce qui est en file.
  // `delivered_count` reste a zero : la remise effective d'un push n'est
  // connue que des « receipts » Expo, qu'aucun worker ne relit pour l'instant.
  const { data, error } = await supabase
    .from("admin_notification_campaigns")
    .insert({
      title,
      body,
      target_type: targetType,
      target_value: targetValue,
      channels,
      status: count > 0 ? "sent" : "failed",
      recipient_count: count,
      error_message: count > 0 ? null : "Aucun destinataire ne correspond a cette cible.",
      created_by: admin.userId,
    })
    .select("id")
    .single();
  if (error) return fail(describeError(error));

  await logAdminAction("send_notification", "notification_campaign", data.id, {
    targetType,
    targetValue,
    channels,
    recipients: count,
  });
  revalidatePath("/[locale]/admin", "layout");

  return count > 0
    ? ok(`Notification envoyee a ${count} destinataire(s).`)
    : fail("Aucun destinataire ne correspond a cette cible : rien n'a ete envoye.");
}

/**
 * Envoi test : la meme diffusion, ciblee sur **l'administrateur connecte**.
 *
 * C'est le seul « test » honnete que permette le schema — la RPC insere une
 * notification reelle, il n'existe pas de mode simulation. L'administrateur
 * recoit donc dans son application ce que recevrait la cible, et rien n'est
 * ecrit dans l'historique des campagnes : un test n'est pas une diffusion.
 */
export async function sendTestNotification(formData: FormData): Promise<ActionResult> {
  const admin = await requirePermission("notifications.manage");
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return fail("Titre et message requis pour un envoi test.");

  const { data: recipients, error } = await supabase.rpc("admin_broadcast_notification", {
    p_title: `[Test] ${title}`.slice(0, 120),
    p_body: body,
    p_target_type: "user",
    p_target_value: admin.userId,
  });

  if (error) {
    const missing =
      error.code === "PGRST202" || /admin_broadcast_notification/i.test(error.message ?? "");
    return fail(
      missing
        ? "Envoi indisponible : appliquez la migration 0046_admin_broadcast_notification.sql (depot mobile)."
        : describeError(error),
    );
  }

  return Number(recipients ?? 0) > 0
    ? ok("Envoi test recu sur votre propre compte.")
    : fail("Votre compte n'a pas recu le test : il doit etre actif pour etre destinataire.");
}

/**
 * Reessaie une campagne restee sans destinataire ou en echec : on rediffuse
 * avec les memes parametres plutot que de remettre un statut « queued » que
 * personne ne depile — c'etait le cas jusqu'ici.
 */
export async function retryNotification(campaignId: string): Promise<ActionResult> {
  const admin = await requirePermission("notifications.manage");
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("admin_notification_campaigns")
    .select("id, title, body, target_type, target_value, status")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return fail("Campagne introuvable.");
  if (campaign.status === "sent") return fail("Cette campagne a deja ete envoyee.");

  const { data: recipients, error: sendError } = await supabase.rpc(
    "admin_broadcast_notification",
    {
      p_title: campaign.title,
      p_body: campaign.body,
      p_target_type: campaign.target_type,
      p_target_value: campaign.target_value,
    },
  );
  if (sendError) return fail(describeError(sendError));

  const count = Number(recipients ?? 0);
  const { error } = await supabase
    .from("admin_notification_campaigns")
    .update({
      status: count > 0 ? "sent" : "failed",
      recipient_count: count,
      error_message: count > 0 ? null : "Aucun destinataire ne correspond a cette cible.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (error) return fail(describeError(error));

  await logAdminAction("retry_notification", "notification_campaign", campaignId, {
    recipients: count,
    by: admin.userId,
  });
  revalidatePath("/[locale]/admin", "layout");
  return count > 0
    ? ok(`Notification renvoyee a ${count} destinataire(s).`)
    : fail("Aucun destinataire ne correspond a cette cible.");
}
