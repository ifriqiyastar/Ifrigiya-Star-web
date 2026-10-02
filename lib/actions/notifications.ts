"use server";

import { getRequestAdminI18n } from "@/lib/i18n/admin";


import { revalidatePath } from "next/cache";

import { randomUUID } from "node:crypto";

import { makeErrors, fail, ok, type ActionResult } from "@/lib/actions/result";
import { logAdminAction, requirePermission } from "@/lib/auth";
import {
  MAX_EMAIL_RECIPIENTS,
  emailChannelKey,
  sendCampaignEmails,
  type CampaignDelivery,
  type CampaignEmailResult,
  type CampaignRecipient,
} from "@/lib/email/campaign";
import { fetchCopyForSend } from "@/lib/queries/email-template";
import { orLikeTerm } from "@/lib/queries/notifications";
import { renderCampaignEmail } from "@/lib/email/preview";
import { isLocale } from "@/lib/i18n/config";
import { parseRichText, richToPlainText } from "@/lib/rich-text/server";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Le canal email d'une diffusion : resolution des adresses, envoi, et trace.
 *
 * ⚠️ **Les destinataires ne sont pas recalcules ici.**
 * `admin_broadcast_recipients()` (migration `202609300001`) rejoue le meme
 * ciblage que `admin_broadcast_notification()` et y ajoute les deux
 * exclusions propres au courriel : adresse vide, desabonnement. Recopier
 * cette clause en TypeScript ferait exister deux definitions de « qui
 * recoit », et le jour ou elles divergeraient une partie des gens recevrait
 * le courriel sans la notification, ou l'inverse.
 *
 * ⚠️ **Un echec du courriel ne fait jamais echouer la diffusion.** La
 * notification in-app et le push sont deja partis quand cette fonction est
 * appelee ; rendre la campagne « en echec » parce que Resend a eu une panne
 * inviterait a rappuyer sur « Reessayer », ce qui **redoublerait** les
 * notifications deja recues.
 */
async function broadcastEmails(
  supabase: Supabase,
  {
    campaignKey,
    title,
    body,
    targetType,
    targetValue,
    templateId,
    bodyHtml,
  }: {
    campaignKey: string;
    /** L'objet du courriel : le sien s'il en a un, celui de la campagne sinon. */
    title: string;
    body: string;
    /** Le message mis en forme ; le courriel seul s'en sert. */
    bodyHtml: string | null;
    targetType: string;
    targetValue: string | null;
    /** Le modele choisi a l'envoi ; a defaut, celui marque par defaut. */
    templateId: string | null;
  },
): Promise<CampaignEmailResult & { unavailable?: string; templateId?: string | null }> {
  const empty: CampaignEmailResult = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    deliveries: [],
  };
  if (!emailChannelKey()) return { ...empty, unavailable: "unconfigured" };

  const { data, error } = await supabase.rpc("admin_broadcast_recipients", {
    p_target_type: targetType,
    p_target_value: targetValue,
  });
  if (error) {
    const missing =
      error.code === "PGRST202" || /admin_broadcast_recipients/i.test(error.message ?? "");
    return { ...empty, unavailable: missing ? "migration" : error.message };
  }

  // L'habillage du modele choisi, langue par langue. `fetchCopyForSend()`
  // retombe sur le modele par defaut puis sur les textes livres : une
  // campagne ne doit pas echouer parce qu'un modele a ete supprime entre la
  // redaction et l'envoi.
  const chosen = await fetchCopyForSend(templateId);
  const sent = await sendCampaignEmails({
    campaignKey,
    title,
    body,
    // ⚠️ Reanalyse cote serveur, jamais pose tel quel : un POST direct
    // n'emprunte pas l'editeur, et le schema Tiptap est la liste blanche.
    bodyDoc: parseRichText(bodyHtml),
    blocks: chosen.blocks,
    recipients: (data ?? []) as CampaignRecipient[],
    copy: chosen.copy,
  });
  return { ...sent, templateId: chosen.id };
}

/**
 * La trace par destinataire, dans la table prevue pour elle.
 *
 * `provider_reference` porte l'identifiant Resend : c'est ce qui permettra a
 * un webhook de remonter plus tard un rebond ou une plainte sur la bonne
 * ligne. L'insertion est **tolerante a l'echec et par paquets** — une
 * campagne de deux mille lignes ne doit ni tenir dans une requete, ni faire
 * echouer un envoi deja parti.
 */
async function recordDeliveries(
  supabase: Supabase,
  campaignId: string,
  deliveries: CampaignDelivery[],
) {
  for (let index = 0; index < deliveries.length; index += 500) {
    const rows = deliveries.slice(index, index + 500).map((delivery) => ({
      campaign_id: campaignId,
      recipient_id: delivery.recipient_id,
      channel: "email",
      status: delivery.status,
      provider_reference: delivery.provider_reference,
      error_message: delivery.error_message,
      sent_at: delivery.status === "sent" ? new Date().toISOString() : null,
    }));
    const { error } = await supabase.from("admin_notification_deliveries").upsert(rows, {
      onConflict: "campaign_id,recipient_id,channel",
    });
    if (error) return;
  }
}

type AdminI18n = Awaited<ReturnType<typeof getRequestAdminI18n>>;

/**
 * La phrase qui rend compte du courriel, ajoutee au message de l'action.
 *
 * Elle nomme separement les trois issues — canal absent, migration absente,
 * envoi partiel — parce que ce sont trois gestes differents cote exploitant :
 * renseigner une cle, appliquer un fichier SQL, ou regarder les adresses en
 * echec.
 */
function emailSummary(
  i18n: AdminI18n,
  result: CampaignEmailResult & { unavailable?: string },
): string {
  if (result.unavailable === "unconfigured") {
    return i18n.t("Canal email ignore : aucune cle d'envoi n'est configuree.");
  }
  if (result.unavailable === "migration") {
    return i18n.t("Canal email ignore : la migration du canal email n'est pas appliquee.");
  }
  if (result.unavailable) {
    return i18n.t("Canal email en echec : {0}", { "0": result.unavailable });
  }
  const parts = [i18n.t("{0} e-mail(s) envoye(s)", { "0": result.sent })];
  if (result.failed) parts.push(i18n.t("{0} en echec", { "0": result.failed }));
  if (result.skipped) {
    parts.push(
      i18n.t("{0} hors plafond de {1} par diffusion", {
        "0": result.skipped,
        "1": MAX_EMAIL_RECIPIENTS,
      }),
    );
  }
  return `${parts.join(", ")}.`;
}

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
  const i18n = await getRequestAdminI18n();

  const admin = await requirePermission("notifications.manage");
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const targetType = String(formData.get("target_type") ?? "all");
  const targetValue = String(formData.get("target_value") ?? "").trim() || null;
  const channels = formData.getAll("channels").map(String);
  const templateId = String(formData.get("email_template") ?? "").trim() || null;
  const bodyHtml = String(formData.get("body_html") ?? "").trim() || null;
  /**
   * ⚠️ Le courriel peut porter son propre texte. Absents, ces champs
   * signifient « le meme que la notification » — et non « pas de courriel »,
   * que seul `channels` dit.
   */
  const emailSubject = String(formData.get("email_subject") ?? "").trim() || null;
  const emailBody = String(formData.get("email_body") ?? "").trim() || null;
  const emailBodyHtml = String(formData.get("email_body_html") ?? "").trim() || null;
  if (!title || !body || channels.length === 0) return fail(i18n.t("Titre, message et canal requis."));

  /**
   * ⚠️ **Une diffusion par courriel seul n'ecrit aucune notification.**
   *
   * L'envoi appelait `admin_broadcast_notification()` dans tous les cas, si
   * bien qu'un courriel ne pouvait pas partir sans deposer aussi une
   * notification dans la cloche de chacun et un push sur son telephone. Pour
   * une lettre d'information, c'est deux interruptions de trop.
   *
   * L'in-app reste indissociable du push — c'est l'ecriture de la
   * notification qui le declenche — mais le **couple** in-app/push est
   * desormais facultatif, exactement comme l'email. Ce qui n'est pas
   * possible, et ne l'a jamais ete, c'est le push sans l'in-app.
   */
  const wantsNotification = channels.includes("in_app");
  if (!wantsNotification && !channels.includes("email")) {
    return fail(i18n.t("Choisissez au moins un canal : notification ou e-mail."));
  }

  // ⚠️ Le texte brut du formulaire est **reconstruit** a partir de la mise en
  // forme quand elle existe. Sans cela, un appel direct pourrait envoyer un
  // courriel disant une chose et une notification en disant une autre.
  const parsed = parseRichText(bodyHtml);
  const plain = parsed ? richToPlainText(parsed) : "";
  const plainBody = plain || body;

  if (!wantsNotification) {
    // Courriel seul : rien a ecrire dans `notifications`, donc rien a
    // appeler. Le nombre de destinataires servis sera celui du courriel.
    return finishCampaign({
      supabase,
      i18n,
      admin,
      title,
      body: plainBody,
      targetType,
      targetValue,
      channels,
      templateId,
      bodyHtml,
      email: { subject: emailSubject, body: emailBody, bodyHtml: emailBodyHtml },
      count: 0,
    });
  }

  // ⚠️ Le push se decoche, l'in-app non : l'insertion dans `notifications`
  // **est** la notification in-app, et c'est elle qui declenche le push. La
  // version a cinq arguments de la RPC (migration `202609300002`) pose le
  // drapeau que son trigger lit pour s'abstenir.
  const withPush = channels.includes("push");
  const { data: recipients, error: sendError } = await supabase.rpc(
    "admin_broadcast_notification",
    {
      p_title: title,
      p_body: plainBody,
      p_target_type: targetType,
      p_target_value: targetValue,
      p_push: withPush,
    },
  );

  if (sendError) {
    const missing =
      sendError.code === "PGRST202" || /admin_broadcast_notification/i.test(sendError.message ?? "");
    if (!missing) return fail(makeErrors(i18n.locale).describeError(sendError));
    // ⚠️ Sans cette migration, le push part **quoi qu'il arrive**. Retomber
    // silencieusement sur l'ancienne signature enverrait sur les telephones
    // une alerte que l'expediteur venait explicitement de refuser : on
    // refuse l'envoi et on le dit. Avec le push demande, en revanche, le
    // repli est fidele a l'intention.
    if (!withPush) {
      return fail(i18n.t("Le push ne peut pas etre decoche sur cette installation : appliquez la migration du choix des canaux."));
    }
    const legacy = await supabase.rpc("admin_broadcast_notification", {
      p_title: title,
      p_body: plainBody,
      p_target_type: targetType,
      p_target_value: targetValue,
    });
    if (legacy.error) {
      const absent =
        legacy.error.code === "PGRST202" ||
        /admin_broadcast_notification/i.test(legacy.error.message ?? "");
      return fail(
        absent
          ? i18n.t("Envoi indisponible : appliquez la migration 0046_admin_broadcast_notification.sql (depot mobile).")
          : makeErrors(i18n.locale).describeError(legacy.error),
      );
    }
    return finishCampaign({
      supabase,
      i18n,
      admin,
      title,
      body: plainBody,
      targetType,
      targetValue,
      channels,
      templateId,
      bodyHtml,
      email: { subject: emailSubject, body: emailBody, bodyHtml: emailBodyHtml },
      count: Number(legacy.data ?? 0),
    });
  }

  return finishCampaign({
    supabase,
    i18n,
    admin,
    title,
    body: plainBody,
    targetType,
    targetValue,
    channels,
    templateId,
    bodyHtml,
    email: { subject: emailSubject, body: emailBody, bodyHtml: emailBodyHtml },
    count: Number(recipients ?? 0),
  });
}

/**
 * Ce qui suit la diffusion in-app : le courriel, l'historique, la trace.
 *
 * Extrait de `sendNotification()` parce que le repli sur l'ancienne signature
 * de la RPC doit finir exactement de la meme maniere — deux copies de cette
 * fin divergeraient a la premiere correction.
 */
async function finishCampaign({
  supabase,
  i18n,
  admin,
  title,
  body,
  targetType,
  targetValue,
  channels,
  templateId,
  bodyHtml,
  email: ownEmail,
  count,
}: {
  supabase: Supabase;
  i18n: AdminI18n;
  admin: { userId: string };
  title: string;
  body: string;
  targetType: string;
  targetValue: string | null;
  channels: string[];
  templateId: string | null;
  bodyHtml: string | null;
  /** Le texte propre au courriel, ou `null` s'il reprend celui au-dessus. */
  email: { subject: string | null; body: string | null; bodyHtml: string | null };
  count: number;
}): Promise<ActionResult> {
  // ⚠️ Le courriel part **apres** la notification, jamais avant : si Resend
  // echoue, les gens ont recu la notification et le push, ce qui est
  // l'essentiel ; l'inverse enverrait un courriel annoncant une notification
  // que personne n'aurait dans son application.
  const email = channels.includes("email")
    ? await broadcastEmails(supabase, {
        campaignKey: randomUUID(),
        // Le courriel prend son propre texte quand il en a un.
        title: ownEmail.subject ?? title,
        body: ownEmail.body ?? body,
        bodyHtml: ownEmail.bodyHtml ?? bodyHtml,
        targetType,
        targetValue,
        templateId,
      })
    : null;

  // L'historique enregistre ce qui est **parti**, pas ce qui est en file.
  // `delivered_count` ne compte que les courriels acceptes par Resend : la
  // remise effective d'un push n'est connue que des « receipts » Expo, et
  // celle d'un courriel que des webhooks, qu'aucun worker ne relit ici.
  /**
   * ⚠️ « Destinataires servis » doit parler du canal qui a tourne. Sur une
   * diffusion par courriel seul, `count` vaut zero — il compte les
   * notifications ecrites — et le journal aurait affiche « 0 servis » sur un
   * envoi parti chez des centaines de personnes.
   */
  const served = count > 0 ? count : (email?.sent ?? 0);
  const nothingSent = served <= 0;

  const { data, error } = await supabase
    .from("admin_notification_campaigns")
    .insert({
      title,
      body,
      target_type: targetType,
      target_value: targetValue,
      channels,
      status: nothingSent ? "failed" : "sent",
      recipient_count: served,
      delivered_count: email?.sent ?? 0,
      failed_count: email?.failed ?? 0,
      // Quel habillage est parti : le modele peut avoir ete modifie depuis,
      // mais le journal dit au moins lequel a servi.
      email_template_id: email?.templateId ?? null,
      body_html: ownEmail.bodyHtml ?? bodyHtml,
      // Nul = le courriel a porte le meme objet que la notification.
      email_subject: ownEmail.subject,
      error_message: nothingSent ? i18n.t("Aucun destinataire ne correspond a cette cible.") : null,
      created_by: admin.userId,
    })
    .select("id")
    .single();
  if (error) return fail(makeErrors(i18n.locale).describeError(error));

  if (email?.deliveries.length) await recordDeliveries(supabase, data.id, email.deliveries);

  await logAdminAction("send_notification", "notification_campaign", data.id, {
    targetType,
    targetValue,
    channels,
    recipients: count,
    emails: email ? { sent: email.sent, failed: email.failed, skipped: email.skipped } : null,
  });
  revalidatePath("/[locale]/admin", "layout");

  if (nothingSent) {
    return fail(i18n.t("Aucun destinataire ne correspond a cette cible : rien n'a ete envoye."));
  }
  // Sur un courriel seul, il n'y a pas de notification a annoncer.
  const notified =
    count > 0 ? i18n.t("Notification envoyee a {0} destinataire(s).", { "0": count }) : "";
  const summary = email ? emailSummary(i18n, email) : "";
  return ok([notified, summary].filter(Boolean).join(" "));
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
  const i18n = await getRequestAdminI18n();

  const admin = await requirePermission("notifications.manage");
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const bodyHtml = String(formData.get("body_html") ?? "").trim() || null;
  /**
   * ⚠️ Le courriel peut porter son propre texte. Absents, ces champs
   * signifient « le meme que la notification » — et non « pas de courriel »,
   * que seul `channels` dit.
   */
  const emailSubject = String(formData.get("email_subject") ?? "").trim() || null;
  const emailBody = String(formData.get("email_body") ?? "").trim() || null;
  const emailBodyHtml = String(formData.get("email_body_html") ?? "").trim() || null;
  const channels = formData.getAll("channels").map(String);
  const templateId = String(formData.get("email_template") ?? "").trim() || null;
  if (!title || !body) return fail(i18n.t("Titre et message requis pour un envoi test."));

  const parsed = parseRichText(bodyHtml);
  const plainBody = parsed ? richToPlainText(parsed) || body : body;
  // Le test doit montrer le courriel **tel qu'il partira**, texte propre
  // compris : sinon il validerait un message que personne ne recevra.
  const mailParsed = parseRichText(emailBodyHtml ?? bodyHtml);
  const mailTitle = emailSubject ?? title;
  const mailBody = mailParsed ? richToPlainText(mailParsed) || (emailBody ?? body) : (emailBody ?? body);

  // ⚠️ Le test doit reproduire le **mode** choisi. Sur une diffusion par
  // courriel seul, deposer quand meme une notification de test dans sa propre
  // cloche donnerait a verifier un canal qui ne partira pas.
  const wantsNotification = channels.includes("in_app");
  let served = true;

  if (wantsNotification) {
    const { data: recipients, error } = await supabase.rpc("admin_broadcast_notification", {
      p_title: `[Test] ${title}`.slice(0, 120),
      p_body: plainBody,
      p_target_type: "user",
      p_target_value: admin.userId,
    });

    if (error) {
      const missing =
        error.code === "PGRST202" || /admin_broadcast_notification/i.test(error.message ?? "");
      return fail(
        missing
          ? i18n.t("Envoi indisponible : appliquez la migration 0046_admin_broadcast_notification.sql (depot mobile).")
          : makeErrors(i18n.locale).describeError(error),
      );
    }
    served = Number(recipients ?? 0) > 0;
  }

  /**
   * ⚠️ **Le test envoie le vrai courriel, a soi.**
   *
   * C'est le seul garde-fou avant une diffusion : une notification part chez
   * des milliers de personnes et ne se rappelle pas. Un « test » qui
   * n'enverrait que la version in-app ne dirait rien de l'habillage, du
   * modele choisi, de la mise en forme ni du rendu chez un vrai client de
   * messagerie — c'est-a-dire de tout ce qui peut se voir mal.
   *
   * Il emprunte exactement le meme chemin que la diffusion : meme modele,
   * meme analyse du message, meme gabarit. Rien n'est enregistre dans
   * l'historique — un test n'est pas une diffusion.
   */
  let emailNote = "";
  if (channels.includes("email")) {
    if (!admin.email) {
      emailNote = ` ${i18n.t("Aucun e-mail de test : votre compte n'a pas d'adresse.")}`;
    } else {
      const chosen = await fetchCopyForSend(templateId);
      const { data: profile } = await supabase
        .from("profiles")
        .select("locale, full_name")
        .eq("id", admin.userId)
        .maybeSingle();
      const result = await sendCampaignEmails({
        // Une cle par seconde : reappuyer sur « test » doit renvoyer, alors
        // qu'une diffusion rejouee ne doit pas se doubler.
        campaignKey: `test-${admin.userId}-${Math.floor(Date.now() / 1000)}`,
        title: `[Test] ${mailTitle}`,
        body: mailBody,
        bodyDoc: mailParsed,
        blocks: chosen.blocks,
        recipients: [
          {
            id: admin.userId,
            email: admin.email,
            locale: (profile?.locale as string | null) ?? null,
            full_name: (profile?.full_name as string | null) ?? admin.fullName,
          },
        ],
        copy: chosen.copy,
      });
      emailNote = result.sent
        ? ` ${i18n.t("E-mail de test envoye a {0}.", { "0": admin.email })}`
        : ` ${i18n.t("E-mail de test non parti : {0}", { "0": result.deliveries[0]?.error_message ?? result.error ?? "?" })}`;
    }
  }

  if (!served) {
    return fail(i18n.t("Votre compte n'a pas recu le test : il doit etre actif pour etre destinataire."));
  }
  // En courriel seul, il n'y a pas de notification a annoncer.
  const note = wantsNotification ? i18n.t("Envoi test recu sur votre propre compte.") : "";
  return ok(`${note}${emailNote}`.trim());
}

/**
 * Le courriel tel qu'il partirait, rendu pour l'apercu du composeur.
 *
 * ⚠️ Rendu par le **meme** gabarit et le meme modele que l'envoi : un apercu
 * approximatif finirait par diverger, et c'est precisement ici qu'on lui
 * fait confiance pour appuyer sur « Envoyer ». Rien n'est envoye ni
 * enregistre ; la sortie est posee dans une `iframe` en bac a sable.
 */
export async function previewCampaignEmail(input: {
  title: string;
  body: string;
  bodyHtml: string | null;
  templateId: string | null;
  locale: string;
}): Promise<{ html: string }> {
  await requirePermission("notifications.manage");

  const locale = isLocale(input.locale) ? input.locale : "fr";
  const chosen = await fetchCopyForSend(input.templateId);
  const parsed = parseRichText(input.bodyHtml);

  const html = await renderCampaignEmail({
    title: input.title.trim() || "—",
    body: (parsed ? richToPlainText(parsed) : input.body).trim() || "—",
    bodyDoc: parsed,
    blocks: chosen.blocks,
    locale,
    copy: chosen.copy[locale],
  });
  return { html };
}

/**
 * Reessaie une campagne restee sans destinataire ou en echec : on rediffuse
 * avec les memes parametres plutot que de remettre un statut « queued » que
 * personne ne depile — c'etait le cas jusqu'ici.
 */
export async function retryNotification(campaignId: string): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();

  const admin = await requirePermission("notifications.manage");
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("admin_notification_campaigns")
    .select("id, title, body, body_html, email_subject, target_type, target_value, status, channels, email_template_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return fail(i18n.t("Campagne introuvable."));
  if (campaign.status === "sent") return fail(i18n.t("Cette campagne a deja ete envoyee."));

  // La relance rejoue les canaux enregistres, push compris.
  const campaignChannels: string[] = campaign.channels ?? [];
  const { data: recipients, error: sendError } = await supabase.rpc(
    "admin_broadcast_notification",
    {
      p_title: campaign.title,
      p_body: campaign.body,
      p_target_type: campaign.target_type,
      p_target_value: campaign.target_value,
      p_push: campaignChannels.includes("push"),
    },
  );
  if (sendError) return fail(makeErrors(i18n.locale).describeError(sendError));

  const count = Number(recipients ?? 0);

  // La relance rejoue **les memes canaux** que la campagne d'origine. La cle
  // d'idempotence est derivee de l'identifiant de campagne : deux clics sur
  // « Reessayer » ne produisent pas deux courriels chez la meme personne.
  const email = campaignChannels.includes("email")
    ? await broadcastEmails(supabase, {
        campaignKey: `retry-${campaignId}`,
        // ⚠️ L'objet distinct est rejoue tel quel : une relance doit renvoyer
        // ce qui avait ete envoye, pas le titre de la notification.
        title: campaign.email_subject ?? campaign.title,
        body: campaign.body,
        targetType: campaign.target_type,
        targetValue: campaign.target_value,
        // La relance rejoue le modele d'origine, pas celui devenu defaut
        // depuis : le destinataire doit recevoir ce qui avait ete decide.
        templateId: campaign.email_template_id ?? null,
        bodyHtml: campaign.body_html ?? null,
      })
    : null;

  const { error } = await supabase
    .from("admin_notification_campaigns")
    .update({
      status: count > 0 ? "sent" : "failed",
      recipient_count: count,
      delivered_count: email?.sent ?? 0,
      failed_count: email?.failed ?? 0,
      error_message: count > 0 ? null : i18n.t("Aucun destinataire ne correspond a cette cible."),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (error) return fail(makeErrors(i18n.locale).describeError(error));

  if (email?.deliveries.length) await recordDeliveries(supabase, campaignId, email.deliveries);

  await logAdminAction("retry_notification", "notification_campaign", campaignId, {
    recipients: count,
    emails: email ? { sent: email.sent, failed: email.failed } : null,
    by: admin.userId,
  });
  revalidatePath("/[locale]/admin", "layout");
  if (count <= 0) return fail(i18n.t("Aucun destinataire ne correspond a cette cible."));
  const notified = i18n.t("Notification renvoyee a {0} destinataire(s).", { "0": count });
  return ok(email ? `${notified} ${emailSummary(i18n, email)}` : notified);
}


/**
 * Cherche un compte destinataire, pour l'envoi nominatif.
 *
 * ⚠️ **Le composeur ne recoit plus les comptes d'avance.** Il en portait
 * jusqu'a deux mille, serialises dans la page a chaque ouverture de l'ecran,
 * pour un choix qu'on ne fait presque jamais — et un `<select>` natif de deux
 * mille lignes ne se parcourt de toute facon pas. La recherche part d'ici, au
 * fil de la frappe, et ne rend que ce qui s'affiche.
 *
 * ⚠️ Le terme est echappe (`%`, `_`, `\`) : sans cela, chercher « 100% »
 * ramenerait tout ce qui commence par « 100 ». Meme raison que le journal.
 */
export async function searchAccounts(
  query: string,
): Promise<{ id: string; name: string; email: string | null; role: string }[]> {
  await requirePermission("notifications.manage");

  const term = query.trim();
  if (term.length < 2) return [];

  const supabase = await createClient();
  const pattern = orLikeTerm(term);
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("is_active", true)
    .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
    .order("full_name")
    // Une liste de resultats se lit ; au-dela, on affine sa recherche.
    .limit(12);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.full_name as string | null)?.trim() || (row.email as string | null) || "",
    email: (row.email as string | null) ?? null,
    role: (row.role as string | null) ?? "",
  }));
}

/** Le compte deja choisi, pour le reafficher sans le rechercher. */
export async function fetchAccount(
  id: string,
): Promise<{ id: string; name: string; email: string | null; role: string } | null> {
  await requirePermission("notifications.manage");
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    name: (data.full_name as string | null)?.trim() || (data.email as string | null) || "",
    email: (data.email as string | null) ?? null,
    role: (data.role as string | null) ?? "",
  };
}
