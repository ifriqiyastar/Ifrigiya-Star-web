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
import { orLikeTerm } from "@/lib/queries/search-term";
import { renderCampaignEmail } from "@/lib/email/preview";
import { isLocale } from "@/lib/i18n/config";
import { parseRichText, richToPlainText } from "@/lib/rich-text/server";
import { MAX_TYPED_ADDRESSES, parseAddressList } from "@/lib/email/address-list";
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
    heading,
    body,
    targetType,
    targetValue,
    recipients,
    templateId,
    bodyHtml,
  }: {
    campaignKey: string;
    /** L'objet du courriel : le sien s'il en a un, celui de la campagne sinon. */
    title: string;
    /** Le titre affiche en tete du message — jamais l'objet. Voir l'appelant. */
    heading: string | null;
    body: string;
    /** Le message mis en forme ; le courriel seul s'en sert. */
    bodyHtml: string | null;
    targetType: string;
    targetValue: string | null;
    /**
     * Les destinataires, quand ils ne se deduisent pas d'une cible.
     *
     * ⚠️ C'est le **seul** cas ou la liste n'est pas calculee en Postgres.
     * Pour toute cible rattachee a des comptes, `admin_broadcast_recipients()`
     * reste la definition unique de « qui recoit » — la recopier en
     * TypeScript ferait exister deux definitions qui finiraient par diverger.
     * Des adresses tapees a la main ne se deduisent de rien : il n'y a rien a
     * recalculer, donc rien a faire diverger.
     */
    recipients?: CampaignRecipient[];
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

  let list = recipients ?? null;
  if (!list) {
    const { data, error } = await supabase.rpc("admin_broadcast_recipients", {
      p_target_type: targetType,
      p_target_value: targetValue,
    });
    if (error) {
      const missing =
        error.code === "PGRST202" || /admin_broadcast_recipients/i.test(error.message ?? "");
      return { ...empty, unavailable: missing ? "migration" : error.message };
    }
    list = (data ?? []) as CampaignRecipient[];
  }
  if (!list.length) return empty;

  // L'habillage du modele choisi, langue par langue. `fetchCopyForSend()`
  // retombe sur le modele par defaut puis sur les textes livres : une
  // campagne ne doit pas echouer parce qu'un modele a ete supprime entre la
  // redaction et l'envoi.
  const chosen = await fetchCopyForSend(templateId);
  const sent = await sendCampaignEmails({
    campaignKey,
    title,
    heading,
    body,
    // ⚠️ Reanalyse cote serveur, jamais pose tel quel : un POST direct
    // n'emprunte pas l'editeur, et le schema Tiptap est la liste blanche.
    bodyDoc: parseRichText(bodyHtml),
    blocks: chosen.blocks,
    recipients: list,
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
      // Nulle pour un compte : c'est `recipient_id` qui fait foi.
      email: delivery.email,
      channel: "email",
      status: delivery.status,
      provider_reference: delivery.provider_reference,
      error_message: delivery.error_message,
      sent_at: delivery.status === "sent" ? new Date().toISOString() : null,
    }));
    /**
     * ⚠️ **Deux cibles de conflit, parce qu'il y a deux sortes de lignes.**
     * `unique` tient les NULL pour distincts : sur une adresse sans compte,
     * `(campaign_id, recipient_id, channel)` ne contraint plus rien et une
     * relance deposerait un doublon. Les lignes sans compte sont donc
     * reconciliees sur `(campaign_id, email, channel)`, l'index pose par
     * `202611020001`.
     */
    const comptes = rows.filter((row) => row.recipient_id !== null);
    const adresses = rows.filter((row) => row.recipient_id === null);
    if (comptes.length) {
      const { error } = await supabase
        .from("admin_notification_deliveries")
        .upsert(comptes, { onConflict: "campaign_id,recipient_id,channel" });
      if (error) return;
    }
    if (adresses.length) {
      const { error } = await supabase
        .from("admin_notification_deliveries")
        .upsert(adresses, { onConflict: "campaign_id,email,channel" });
      if (error) return;
    }
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
  /**
   * ⚠️⚠️ **Le courriel n'a plus de TEXTE propre, seulement un objet.**
   *
   * `email_body` et `email_body_html` ne sont plus lus — ni ici, ni a
   * l'ecran. Un Server Action est atteignable par un POST direct, donc les
   * retirer de l'interface seule aurait garde accessible une fonction
   * qu'elle ne propose plus ; et ce texte n'avait qu'une langue, alors que
   * l'envoi rend une variante par langue de destinataire. Ce qu'un courriel
   * raconte se compose dans son modele, en blocs, dans les trois langues.
   *
   * `email_subject` reste : en mode « les deux », la section « L'e-mail »
   * porte son propre objet, facultatif. Vide, l'objet du modele s'applique,
   * puis le titre de la notification. En courriel seul, le champ « Objet »
   * **est** `title` — aucune notification ne part.
   */
  const emailSubject = String(formData.get("email_subject") ?? "").trim() || null;
  /**
   * ⚠️ **Le corps n'est obligatoire que pour la notification.** Une
   * notification ne peut pas etre vide — la cloche et l'ecran verrouille
   * n'auraient rien a montrer —, un courriel tient entierement dans son
   * modele.
   */
  if (!title || channels.length === 0) return fail(i18n.t("Titre et canal requis."));
  if (channels.includes("in_app") && !body) {
    return fail(i18n.t("Le corps du message est requis pour une notification."));
  }

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

  /**
   * ⚠️⚠️ **Les adresses saisies : le seul envoi qui ne vise pas des comptes.**
   *
   * Tout le reste de ce fichier part de `profiles` — c'est la cloche, le
   * push, la langue du destinataire et son nom. Une adresse tapee a la main
   * n'a rien de tout cela : pas de compte ou deposer une notification, pas
   * de langue connue, pas de nom a inserer. D'ou les trois regles ci-dessous,
   * qui sont des **refus francs** plutot que des ajustements silencieux.
   *
   * La cible est refusee par `admin_broadcast_notification()` comme par
   * `admin_broadcast_recipients()` ('unknown_target') : rien ne peut partir
   * par megarde vers Postgres avec ce type.
   */
  let typedRecipients: CampaignRecipient[] | undefined;
  let typedNotice = "";
  let typedValue = targetValue;

  if (targetType === "emails") {
    // 1. Une adresse sans compte ne peut pas recevoir de notification.
    if (wantsNotification) {
      return fail(
        i18n.t("Les adresses saisies ne recoivent que des e-mails : une adresse sans compte n'a pas d'application ou recevoir une notification."),
      );
    }

    const parsedList = parseAddressList(targetValue ?? "");
    if (!parsedList.emails.length) {
      return fail(i18n.t("Saisissez au moins une adresse e-mail valide."));
    }

    /**
     * 2. ⚠️ **Le desabonnement est verifie ici, et il doit l'etre.**
     * Pour une cible de comptes, c'est `admin_broadcast_recipients()` qui
     * l'applique en SQL. Cette liste-ci ne passe pas par elle : sans ce
     * filtre, quelqu'un qui s'est desabonne recevrait a nouveau des que son
     * adresse serait recollee dans le champ — et le lien de desabonnement
     * serait un mensonge.
     */
    const { data: optouts, error: optoutError } = await supabase
      .from("admin_email_optouts")
      .select("email")
      .in("email", parsedList.emails);
    if (optoutError && optoutError.code !== "42P01") {
      return fail(makeErrors(i18n.locale).describeError(optoutError));
    }
    const refused = new Set((optouts ?? []).map((row) => String(row.email).toLowerCase()));
    const kept = parsedList.emails.filter((email) => !refused.has(email));
    if (!kept.length) {
      return fail(i18n.t("Toutes les adresses saisies se sont desabonnees : rien n'a ete envoye."));
    }

    typedRecipients = kept.map((email) => ({
      // Pas de compte : le lien de desabonnement se signera sur l'adresse,
      // et la ligne de journal nommera l'adresse.
      id: null,
      email,
      // ⚠️ Langue inconnue, donc celle du produit. La deviner d'apres le
      // domaine de l'adresse serait une invention.
      locale: null,
      // Pas de nom : le gabarit rend alors l'accueil sans nom, prevu pour ca.
      full_name: null,
    }));
    // La campagne garde la liste **reellement visee**, pas le texte tape :
    // c'est elle que la relance rejouera.
    typedValue = kept.join(",");

    // 3. Rien de ce qui a ete ecarte n'est taisable.
    const ecarts = [
      parsedList.invalid.length
        ? i18n.t("{0} adresse(s) illisible(s) ignoree(s) : {1}.", {
            "0": parsedList.invalid.length,
            "1": parsedList.invalid.slice(0, 5).join(", "),
          })
        : "",
      parsedList.duplicates
        ? i18n.t("{0} doublon(s) retire(s).", { "0": parsedList.duplicates })
        : "",
      refused.size ? i18n.t("{0} desabonne(s) ecarte(s).", { "0": refused.size }) : "",
      parsedList.overflow
        ? i18n.t("{0} adresse(s) au-dela du plafond de {1} non servie(s).", {
            "0": parsedList.overflow,
            "1": MAX_TYPED_ADDRESSES,
          })
        : "",
    ].filter(Boolean);
    typedNotice = ecarts.join(" ");
  }

  /**
   * ⚠️ **Plus de mise en forme a reconstruire.** Le champ remontait aussi du
   * HTML, qu'il fallait reanalyser pour que le courriel et la notification ne
   * puissent pas dire deux choses differentes. Le courriel ne reprend plus ce
   * texte : il n'y a plus qu'un canal, et il affiche du texte nu.
   */
  const plainBody = body;

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
      // La liste retenue, pas le texte tape : c'est elle que rejouera une
      // relance, et c'est d'elle que le journal rend compte.
      targetValue: typedValue,
      channels,
      templateId,
      emailSubject,
      count: 0,
      recipients: typedRecipients,
      notice: typedNotice,
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
      emailSubject,
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
    emailSubject,
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
  emailSubject,
  count,
  recipients,
  notice,
}: {
  supabase: Supabase;
  i18n: AdminI18n;
  admin: { userId: string };
  title: string;
  body: string;
  targetType: string;
  targetValue: string | null;
  /** Les destinataires deja resolus — seules les adresses saisies en ont. */
  recipients?: CampaignRecipient[];
  /** Ce que la saisie a ecarte, a dire a l'ecran. Jamais tu. */
  notice?: string;
  channels: string[];
  templateId: string | null;
  /** L'objet propre au courriel, quand la diffusion en porte un. */
  emailSubject: string | null;
  count: number;
}): Promise<ActionResult> {
  // ⚠️ Le courriel part **apres** la notification, jamais avant : si Resend
  // echoue, les gens ont recu la notification et le push, ce qui est
  // l'essentiel ; l'inverse enverrait un courriel annoncant une notification
  // que personne n'aurait dans son application.
  const email = channels.includes("email")
    ? await broadcastEmails(supabase, {
        campaignKey: randomUUID(),
        /**
         * ⚠️ **L'objet de repli, pas l'objet.** Le modele impose le sien,
         * langue par langue (`campaignSubject()` dans
         * `lib/email/campaign.ts`) ; entre les deux, l'objet propre a la
         * diffusion quand sa section « L'e-mail » en porte un ; en dernier
         * ressort le titre de la notification. Il faut un dernier ressort :
         * un modele peut n'imposer aucun objet, et sur un projet ou
         * `202611040001` n'est pas passee la colonne n'existe pas.
         */
        title: emailSubject ?? title,
        /**
         * ⚠️⚠️ **Le courriel ne porte plus aucun texte de la diffusion.**
         *
         * Ni titre affiche, ni corps. Les deux venaient de la notification :
         * son titre se posait en gros sous l'entete, son corps dans le bloc
         * « message » du modele. Deux canaux partageaient donc deux champs
         * sans que rien a l'ecran ne le dise, et en mode « les deux » le
         * courriel n'avait aucun champ a lui. Ils ont chacun leur section
         * desormais, et ce qu'un courriel raconte vit dans son modele, ou il
         * est ecrit dans les trois langues.
         */
        heading: null,
        body: "",
        bodyHtml: null,
        targetType,
        targetValue,
        recipients,
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

  /**
   * ⚠️ **Le journal s'ecrit en dernier, et il ne peut plus faire echouer la
   * diffusion.**
   *
   * Mesure sur le projet reel : `email_subject` n'existait pas (migration
   * `202609300007` non appliquee), et PostgREST rendait `PGRST204`. Comme
   * cet `insert` vient **apres** `admin_broadcast_notification()` et apres
   * l'envoi Resend, l'administrateur lisait « echec » sur une diffusion
   * **deja partie** — et le geste naturel, reappuyer, doublait notification,
   * push et courriels (`campaignKey` est un `randomUUID()` neuf a chaque
   * appel : Resend ne dedoublonne rien). C'est la meme regle que
   * `logAdminAction()`, qui se tait quand sa table est absente : une trace
   * manquante n'annule pas l'acte trace.
   *
   * Les trois colonnes ci-dessous sont celles qu'un projet peut ne pas
   * avoir. Sur `PGRST204` / `42703` la ligne est reecrite sans elles : le
   * journal perd un detail plutot que la diffusion sa trace.
   */
  const CORE = {
    title,
    body,
    target_type: targetType,
    target_value: targetValue,
    channels,
    status: nothingSent ? "failed" : "sent",
    recipient_count: served,
    delivered_count: email?.sent ?? 0,
    failed_count: email?.failed ?? 0,
    error_message: nothingSent ? i18n.t("Aucun destinataire ne correspond a cette cible.") : null,
    created_by: admin.userId,
  };
  const OPTIONAL = {
    // Quel habillage est parti : le modele peut avoir ete modifie depuis,
    // mais le journal dit au moins lequel a servi.
    email_template_id: email?.templateId ?? null,
    // Nul : plus aucune mise en forme n'est saisie. La notification affiche
    // du texte nu, et le courriel ne reprend pas ce texte.
    body_html: null,
    email_subject: emailSubject,
  };

  const write = (payload: Record<string, unknown>) =>
    supabase.from("admin_notification_campaigns").insert(payload).select("id").single();

  let { data, error } = await write({ ...CORE, ...OPTIONAL });
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    ({ data, error } = await write(CORE));
  }

  // `!data` autant que `error` : un `insert` filtre par le RLS rend une ligne
  // absente sans erreur, et la suite deref`erait `data.id`.
  if (error || !data) {
    // Rien n'est parti : l'echec du journal est le seul fait a rapporter.
    if (nothingSent) {
      return fail(
        error
          ? makeErrors(i18n.locale).describeError(error)
          : i18n.t("Rien n'a ete envoye, et l'operation n'a pas pu etre inscrite au journal."),
      );
    }
    // ⚠️ Sinon la diffusion **a eu lieu**. Le dire, et dire aussi qu'elle
    // n'est pas journalisee — sans quoi l'ecran invite a la refaire.
    const summary = email ? emailSummary(i18n, email) : "";
    return ok(
      [
        count > 0 ? i18n.t("Notification envoyee a {0} destinataire(s).", { "0": count }) : "",
        summary,
        i18n.t("Attention : l'envoi a bien eu lieu mais n'a pas pu etre inscrit au journal. Ne le relancez pas."),
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

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
  // ⚠️ `notice` dit ce que la saisie a laisse de cote — adresses illisibles,
  // doublons, desabonnes, surplus. Le taire ferait lire un envoi partiel
  // comme un envoi complet.
  return ok([notified, summary, notice].filter(Boolean).join(" "));
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
  const channels = formData.getAll("channels").map(String);
  const templateId = String(formData.get("email_template") ?? "").trim() || null;
  // Le test doit montrer l'objet qui partira : celui de la section
  // « L'e-mail » quand elle en porte un, comme a la diffusion.
  const emailSubject = String(formData.get("email_subject") ?? "").trim() || null;

  // ⚠️ Le test doit reproduire le **mode** choisi. Sur une diffusion par
  // courriel seul, deposer quand meme une notification de test dans sa propre
  // cloche donnerait a verifier un canal qui ne partira pas.
  const wantsNotification = channels.includes("in_app");
  /**
   * ⚠️ **Le message n'est exige que si une notification part.** Il l'etait
   * toujours, et le bouton de test est devenu inutilisable le jour ou le
   * courriel a cesse d'avoir un corps a saisir : un envoi par courriel seul
   * n'envoie plus aucun texte depuis cet ecran — tout vient du modele — et
   * le test se serait refuse sur un champ qui n'existe plus.
   */
  if (!title) return fail(i18n.t("Titre et message requis pour un envoi test."));
  if (wantsNotification && !body) {
    return fail(i18n.t("Titre et message requis pour un envoi test."));
  }

  const plainBody = body;
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
        title: emailSubject ?? title,
        /**
         * ⚠️ Le prefixe est pose **sur l'objet effectif**, pas sur `title` :
         * l'objet vient maintenant du modele quand il en porte un, et
         * prefixer le repli aurait laisse partir un test sous un objet
         * identique a celui d'une vraie diffusion.
         */
        subjectPrefix: "[Test] ",
        // ⚠️ Meme regle qu'a la diffusion, sans quoi le test — le seul
        // garde-fou avant un envoi de masse — montrerait un courriel que
        // personne ne recevra : il ne porte aucun texte de la diffusion,
        // tout vient de son modele.
        heading: null,
        body: "",
        bodyDoc: null,
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
  /** Le titre affiche en tete, qui n'est pas l'objet. Voir `CampaignEmail`. */
  heading?: string | null;
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
    /**
     * ⚠️ **Ce qui est vide part vide.** Les deux champs retombaient sur un
     * cadratin, qui s'affichait pour de bon : un tiret solitaire en gros
     * caractere la ou le modele ne met rien. Depuis que le texte du courriel
     * vient du modele, l'apercu d'une diffusion par courriel seul n'a ni
     * titre ni corps a montrer — et c'est exactement ce que le destinataire
     * recevra.
     */
    title: input.title.trim(),
    // ⚠️ L'apercu doit mentir le moins possible : s'il coiffait le message
    // d'un titre que la diffusion n'enverra pas, il validerait une mise en
    // page que personne ne recevra.
    heading: input.heading === undefined ? undefined : (input.heading?.trim() || null),
    body: (parsed ? richToPlainText(parsed) : input.body).trim(),
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

  /**
   * ⚠️ **Une campagne vers des adresses saisies ne repasse pas par Postgres.**
   *
   * `admin_broadcast_notification()` n'accepte que les quatre cibles liees a
   * des comptes et leve `unknown_target` sur celle-ci. Les destinataires sont
   * donc relus depuis `target_value`, ou l'envoi a enregistre la liste
   * **reellement visee** — et non le texte tape, qui pouvait contenir des
   * doublons et des fautes de frappe. Une relance renvoie ce qui etait parti.
   *
   * Le desabonnement est re-verifie : quelqu'un a pu se desabonner entre la
   * premiere tentative et la relance, et le lien doit tenir sa promesse.
   */
  const typedTarget = campaign.target_type === "emails";
  let typedRecipients: CampaignRecipient[] | undefined;

  if (typedTarget) {
    const parsedList = parseAddressList(campaign.target_value ?? "");
    const { data: optouts } = await supabase
      .from("admin_email_optouts")
      .select("email")
      .in("email", parsedList.emails);
    const refused = new Set((optouts ?? []).map((row) => String(row.email).toLowerCase()));
    const kept = parsedList.emails.filter((email) => !refused.has(email));
    if (!kept.length) {
      return fail(i18n.t("Toutes les adresses saisies se sont desabonnees : rien n'a ete envoye."));
    }
    typedRecipients = kept.map((email) => ({ id: null, email, locale: null, full_name: null }));
  }

  const { data: recipients, error: sendError } = typedTarget
    ? { data: 0, error: null }
    : await supabase.rpc("admin_broadcast_notification", {
        p_title: campaign.title,
        p_body: campaign.body,
        p_target_type: campaign.target_type,
        p_target_value: campaign.target_value,
        p_push: campaignChannels.includes("push"),
      });
  if (sendError) return fail(makeErrors(i18n.locale).describeError(sendError));

  const count = Number(recipients ?? 0);

  // La relance rejoue **les memes canaux** que la campagne d'origine. La cle
  // d'idempotence est derivee de l'identifiant de campagne : deux clics sur
  // « Reessayer » ne produisent pas deux courriels chez la meme personne.
  const email = campaignChannels.includes("email")
    ? await broadcastEmails(supabase, {
        campaignKey: `retry-${campaignId}`,
        /**
         * L'objet distinct des campagnes **d'avant** est rejoue tel quel :
         * une relance doit renvoyer ce qui avait ete envoye.
         *
         * ⚠️ Il n'est plus qu'un repli, comme a l'envoi : si le modele porte
         * desormais son propre objet, c'est le sien qui part. Cohérent avec
         * le reste de la relance, qui rejoue le modele **tel qu'il est
         * aujourd'hui** — habillage et blocs compris — et non un instantane
         * du jour de l'envoi, qui n'existe nulle part.
         */
        title: campaign.email_subject ?? campaign.title,
        /**
         * ⚠️ **Une relance rejoue la regle d'aujourd'hui, pas celle du jour
         * de l'envoi.** Le courriel ne porte aucun texte de la diffusion :
         * tout vient du modele. Une campagne **d'avant** relancee repart
         * donc sans le texte qu'elle posait en ligne — son objet, lui, est
         * conserve (`email_subject`).
         *
         * C'est le prix d'une regle unique, et c'est le meme arbitrage que
         * le modele : la relance a toujours rejoue le modele **tel qu'il est
         * aujourd'hui**, habillage et blocs compris, faute d'instantane. Une
         * relance qui enverrait un courriel que le composeur ne sait plus
         * produire serait plus difficile a expliquer que celle-ci.
         */
        heading: null,
        body: "",
        targetType: campaign.target_type,
        targetValue: campaign.target_value,
        recipients: typedRecipients,
        // La relance rejoue le modele d'origine, pas celui devenu defaut
        // depuis : le destinataire doit recevoir ce qui avait ete decide.
        templateId: campaign.email_template_id ?? null,
        bodyHtml: null,
      })
    : null;

  const { data: updated, error } = await supabase
    .from("admin_notification_campaigns")
    .update({
      status: count > 0 ? "sent" : "failed",
      recipient_count: count,
      delivered_count: email?.sent ?? 0,
      failed_count: email?.failed ?? 0,
      error_message: count > 0 ? null : i18n.t("Aucun destinataire ne correspond a cette cible."),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .select("id");
  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  // Les notifications, elles, sont deja parties : l'echec porte sur le journal
  // de la campagne, qui resterait affiche « en cours » sans rien dire.
  if (!updated?.length) {
    return fail(i18n.t("Aucune ligne modifiee : le journal de la campagne n'a pas ete mis a jour."));
  }

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
