import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { render } from "@react-email/render";
import { Resend } from "resend";

import { CampaignEmail } from "@/emails/campaign-email";
import { emailLocale, resolveEmailCopy, type ResolvedEmailCopy } from "@/emails/copy";
import type { Locale } from "@/lib/i18n/config";
import type { EmailBlock } from "@/lib/email/blocks";
import type { RichDoc } from "@/lib/rich-text/server";

/**
 * Le canal email des campagnes : rendu du gabarit, signature du lien de
 * desabonnement, et envoi par lots chez Resend.
 *
 * Ce module ne parle jamais a Supabase — il recoit une liste de destinataires
 * deja resolue par `admin_broadcast_recipients()` et rend compte de ce qui est
 * parti. Le seul appelant est `lib/actions/notifications.ts`.
 */

/** Adresse d'expedition. Le domaine est verifie (SPF/DKIM) cote Resend. */
export const EMAIL_ADDRESS = "notifications@ifriqiya-soccer.com";
export const EMAIL_FROM = `Ifriqiya Soccer Star <${EMAIL_ADDRESS}>`;

/**
 * Le nom affiche est saisi par un administrateur et pose dans un en-tete.
 *
 * ⚠️ Un retour a la ligne dans un en-tete de courriel permet d'en **injecter
 * d'autres** (« header injection » : `Bcc:` glisse a la suite). Les
 * guillemets et les chevrons casseraient la syntaxe `Nom <adresse>`. Les
 * quatre sont retires plutot qu'echappes : un nom d'expediteur n'en a pas
 * besoin.
 */
export function sanitizeSenderName(value: string) {
  const clean = value.replace(/[\r\n<>"]/g, " ").replace(/\s+/g, " ").trim();
  return clean.slice(0, 78) || "Ifriqiya Soccer Star";
}

/** Alias explicite pour `tests/campaign-email.test.cjs`. */
export const sanitizeSenderNameForTest = sanitizeSenderName;
/** Adresse de repli pour un desabonnement par courrier (RFC 2369). */
export const EMAIL_UNSUBSCRIBE_MAILBOX = "desabonnement@ifriqiya-soccer.com";

/**
 * Une URL de courriel est absolue et lue par un client de messagerie : un
 * chemin relatif n'y veut rien dire. `NEXT_PUBLIC_SITE_URL` si elle est
 * renseignee, le domaine de production sinon — jamais rien.
 *
 * ⚠️ **Avec le `www.`**, qui est l'hote canonique : l'apex repond 308 vers
 * lui. Une redirection est sans consequence dans un navigateur, mais le
 * proxy d'images de Gmail et celui d'Outlook ne la suivent pas toujours — le
 * logo disparaitrait sans que rien ne le signale. Verifie : `curl` sur
 * l'apex rend `308 https://www.ifriqiya-soccer.com/`.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://www.ifriqiya-soccer.com";

/** Maximum documente par Resend pour un appel `batch`. */
const BATCH_SIZE = 100;
/**
 * Plafond d'une diffusion email depuis un Server Action.
 *
 * ⚠️ Ce n'est pas une limite de Resend, c'est celle du temps de reponse : une
 * requete HTTP ne peut pas tenir vingt minutes. Au-dela, la notification
 * in-app et le push partent quand meme a **tout le monde** — seul le courriel
 * s'arrete — et l'ecran le dit au lieu de laisser croire a un envoi complet.
 * Passer cette barre demande une file de travail, pas une constante plus haute.
 */
export const MAX_EMAIL_RECIPIENTS = 2000;
/** Respiration entre deux lots : la limite de debit de Resend est basse. */
const CHUNK_DELAY_MS = 600;

export type CampaignRecipient = {
  id: string;
  email: string;
  locale: string | null;
  full_name: string | null;
};

export type CampaignDelivery = {
  recipient_id: string;
  status: "sent" | "failed";
  provider_reference: string | null;
  error_message: string | null;
};

export type CampaignEmailResult = {
  /** Destinataires reellement soumis a Resend (apres plafond). */
  attempted: number;
  sent: number;
  failed: number;
  /** Destinataires laisses de cote par `MAX_EMAIL_RECIPIENTS`. */
  skipped: number;
  /** Echec global (cle absente, panne Resend) : rien n'est parti. */
  error?: string;
  deliveries: CampaignDelivery[];
};

/** Le canal est-il configurable ici ? Une cle absente n'est pas une panne. */
export function emailChannelKey() {
  return process.env.RESEND_API_KEY || null;
}

// ---------------------------------------------------------------------------
// Desabonnement
// ---------------------------------------------------------------------------

/**
 * Le lien de desabonnement est **signe**, et c'est indispensable.
 *
 * Sans signature, `?c=<uuid>` suffirait a desabonner n'importe qui : les
 * identifiants de compte circulent dans l'application, et la route est
 * publique par construction — elle est appelee depuis une boite mail, sans
 * session. La signature lie l'identifiant au secret du serveur.
 *
 * Le secret est `EMAIL_UNSUBSCRIBE_SECRET`, avec repli sur la cle de service :
 * une installation qui a deja de quoi ecrire en base a de quoi signer, et
 * l'absence des deux desactive le lien plutot que d'en produire un ouvert.
 */
function signingKey() {
  return process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function unsubscribeToken(profileId: string): string | null {
  const key = signingKey();
  if (!key) return null;
  return createHmac("sha256", key).update(`unsubscribe:${profileId}`).digest("base64url");
}

export function verifyUnsubscribeToken(profileId: string, token: string): boolean {
  const expected = unsubscribeToken(profileId);
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  // `timingSafeEqual` exige deux tampons de meme longueur : la comparaison de
  // taille se fait d'abord, et elle ne revele que la longueur du jeton.
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(profileId: string): string | null {
  const token = unsubscribeToken(profileId);
  if (!token) return null;
  return `${SITE_URL}/api/email/desabonnement?c=${profileId}&t=${token}`;
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

const NAME_SLOT = "__IFQ_NAME__";
const UNSUB_SLOT = "__IFQ_UNSUB__";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * ⚠️ Le gabarit est rendu **une fois par (langue × avec ou sans nom)**, pas
 * une fois par destinataire.
 *
 * Un rendu React Email coute de l'ordre de la dizaine de millisecondes ; a
 * deux mille destinataires cela ferait une demi-minute de calcul avant le
 * premier envoi, dans un Server Action. Les deux seules parties variables —
 * le nom et le lien de desabonnement — sont donc posees sous forme de jetons
 * puis remplacees. Le nom vient d'un champ libre : il est **echappe** avant
 * d'entrer dans le HTML, sinon un `full_name` contenant une balise
 * s'executerait dans la boite de milliers de personnes.
 */
export type Rendered = { html: string; text: string };

/**
 * Les deux marqueurs remplaces apres le rendu. Exportes pour que le test
 * puisse exercer **le vrai chemin de substitution** : passer le nom
 * directement au composant ferait echapper React a notre place, et le test
 * vert ne dirait alors rien de `fillTemplate()`.
 */
export const TEMPLATE_SLOTS = { name: NAME_SLOT, unsubscribe: UNSUB_SLOT } as const;

async function renderVariant(
  locale: Locale,
  named: boolean,
  title: string,
  body: string,
  withUnsubscribe: boolean,
  copy: ResolvedEmailCopy,
  bodyDoc: RichDoc | null,
  blocks: EmailBlock[] | undefined,
): Promise<Rendered> {
  const element = CampaignEmail({
    title,
    body,
    bodyDoc,
    blocks,
    locale,
    recipientName: named ? NAME_SLOT : null,
    unsubscribeUrl: withUnsubscribe ? UNSUB_SLOT : undefined,
    siteUrl: SITE_URL,
    copy,
  });
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { html, text };
}

/**
 * ⚠️ Le point ou une injection HTML entrerait.
 *
 * Le nom vient de `profiles.full_name`, un champ libre, et il est pose dans
 * du HTML **deja rendu** : React n'est plus la pour l'echapper. C'est la
 * seule raison d'etre d'`escapeHtml` ici, et la raison pour laquelle cette
 * fonction est exportee — pour etre testee telle qu'elle est appelee.
 */
export function fillTemplate(rendered: Rendered, name: string | null, url: string | null): Rendered {
  let { html, text } = rendered;
  if (name) {
    html = html.replaceAll(NAME_SLOT, escapeHtml(name));
    text = text.replaceAll(NAME_SLOT, name);
  }
  if (url) {
    html = html.replaceAll(UNSUB_SLOT, url);
    text = text.replaceAll(UNSUB_SLOT, url);
  }
  return { html, text };
}

// ---------------------------------------------------------------------------
// Thematique Resend (preferences de reception)
// ---------------------------------------------------------------------------

/**
 * La thematique sous laquelle les annonces sont envoyees.
 *
 * ⚠️ Sa valeur par defaut cote Resend est **`opt_in`**, et la denomination
 * est contre-intuitive : « opt_in » veut dire *tout le monde recoit sauf qui
 * s'est explicitement desabonne de cette thematique*, tandis que « opt_out »
 * veut dire *personne ne recoit tant qu'il ne s'est pas abonne*. Se tromper
 * n'aurait pas leve d'erreur : la campagne serait partie chez zero personne.
 *
 * L'identifiant est lu dans l'environnement ; a defaut la thematique est
 * retrouvee par son nom, puis creee. Le resultat est garde en memoire du
 * processus : une thematique ne change pas en cours de vie.
 */
const TOPIC_NAME = "Annonces Ifriqiya Soccer Star";
let cachedTopicId: string | null | undefined;

async function resolveTopicId(resend: Resend): Promise<string | null> {
  if (process.env.RESEND_TOPIC_ID) return process.env.RESEND_TOPIC_ID;
  if (cachedTopicId !== undefined) return cachedTopicId;
  try {
    const list = await resend.topics.list();
    const found = list.data?.data.find((topic) => topic.name === TOPIC_NAME);
    if (found) return (cachedTopicId = found.id);
    const created = await resend.topics.create({
      name: TOPIC_NAME,
      description: "Annonces, Scout Days et actualites envoyees depuis le back-office.",
      defaultSubscription: "opt_in",
    });
    return (cachedTopicId = created.data?.id ?? null);
  } catch {
    // Une thematique est un confort de gestion des preferences : son absence
    // ne doit pas empecher une diffusion de partir.
    return (cachedTopicId = null);
  }
}

// ---------------------------------------------------------------------------
// Envoi
// ---------------------------------------------------------------------------

const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Diffuse une campagne par courriel.
 *
 * ⚠️ **Un message par destinataire, jamais un `to` collectif.** Mettre mille
 * adresses dans un meme `to` les montrerait toutes a chacun : c'est la fuite
 * de donnees classique d'un envoi de masse, et le schema de `batch` est fait
 * pour l'eviter.
 *
 * ⚠️ **`batchValidation: "permissive"`.** En mode strict, une seule adresse
 * malformee fait echouer le lot entier : quatre-vingt-dix-neuf personnes ne
 * recevraient rien a cause d'une faute de frappe dans un profil. En permissif,
 * Resend rend la liste des index en echec et envoie le reste.
 */
export async function sendCampaignEmails({
  campaignKey,
  title,
  body,
  recipients,
  copy,
  bodyDoc,
  blocks,
}: {
  /** Identifiant stable de la diffusion : sert de cle d'idempotence. */
  campaignKey: string;
  title: string;
  body: string;
  recipients: CampaignRecipient[];
  /**
   * L'habillage par langue, resolu par l'appelant. Absent, ce sont les
   * textes livres — c'est ce qui fait qu'une installation sans la table
   * `admin_email_template` envoie exactement comme avant.
   */
  copy?: Partial<Record<Locale, ResolvedEmailCopy>>;
  /** Le message mis en forme, deja valide. Absent : le texte brut est rendu. */
  bodyDoc?: RichDoc | null;
  /** La mise en page du modele choisi. */
  blocks?: EmailBlock[];
}): Promise<CampaignEmailResult> {
  const apiKey = emailChannelKey();
  const empty: CampaignEmailResult = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    deliveries: [],
  };
  if (!apiKey) return { ...empty, error: "unconfigured" };
  if (!recipients.length) return empty;

  const resend = new Resend(apiKey);
  const topicId = await resolveTopicId(resend);

  const targets = recipients.slice(0, MAX_EMAIL_RECIPIENTS);
  const skipped = recipients.length - targets.length;

  // Un rendu par variante reellement utilisee, pas un par destinataire.
  const variants = new Map<string, Rendered>();
  const variantOf = async (locale: Locale, named: boolean, withUnsubscribe: boolean) => {
    const key = `${locale}:${named ? "n" : "-"}:${withUnsubscribe ? "u" : "-"}`;
    const cached = variants.get(key);
    if (cached) return cached;
    const resolvedCopy = copy?.[locale] ?? resolveEmailCopy(locale, null, SITE_URL);
    const rendered = await renderVariant(locale, named, title, body, withUnsubscribe, resolvedCopy, bodyDoc ?? null, blocks);
    variants.set(key, rendered);
    return rendered;
  };

  type Prepared = { recipient: CampaignRecipient; message: Record<string, unknown> };
  const prepared: Prepared[] = [];
  for (const recipient of targets) {
    const locale = emailLocale(recipient.locale);
    const resolvedCopy = copy?.[locale] ?? resolveEmailCopy(locale, null, SITE_URL);
    const name = recipient.full_name?.trim() || null;
    const url = unsubscribeUrl(recipient.id);
    const rendered = fillTemplate(await variantOf(locale, Boolean(name), Boolean(url)), name, url);
    prepared.push({
      recipient,
      message: {
        // ⚠️ L'adresse reste sur le domaine verifie — seul le **nom affiche**
        // est personnalisable : changer l'adresse ferait refuser l'envoi.
        from: `${sanitizeSenderName(resolvedCopy.senderName)} <${EMAIL_ADDRESS}>`,
        ...(resolvedCopy.replyTo ? { replyTo: resolvedCopy.replyTo } : {}),
        to: [recipient.email],
        subject: title,
        html: rendered.html,
        text: rendered.text,
        ...(topicId ? { topicId } : {}),
        headers: {
          // RFC 2369 + RFC 8058 : sans ces deux en-tetes, Gmail et Yahoo
          // declassent — voire refusent — un envoi de masse.
          ...(url
            ? {
                "List-Unsubscribe": `<${url}>, <mailto:${EMAIL_UNSUBSCRIBE_MAILBOX}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              }
            : { "List-Unsubscribe": `<mailto:${EMAIL_UNSUBSCRIBE_MAILBOX}>` }),
        },
        tags: [{ name: "source", value: "admin_campaign" }],
      },
    });
  }

  const deliveries: CampaignDelivery[] = [];
  let sent = 0;
  let failed = 0;
  const lots = chunk(prepared, BATCH_SIZE);

  for (const [index, lot] of lots.entries()) {
    if (index > 0) await wait(CHUNK_DELAY_MS);
    try {
      const response = await resend.batch.send(
        lot.map((item) => item.message) as Parameters<typeof resend.batch.send>[0],
        {
          // Rejouer « Reessayer » sur la meme campagne ne doit pas doubler
          // les envois deja partis.
          idempotencyKey: `${campaignKey}-${index}`,
          batchValidation: "permissive",
        },
      );

      if (response.error) {
        for (const item of lot) {
          failed += 1;
          deliveries.push({
            recipient_id: item.recipient.id,
            status: "failed",
            provider_reference: null,
            error_message: response.error.message,
          });
        }
        continue;
      }

      const ids = response.data?.data ?? [];
      const errors = (response.data as { errors?: { index: number; message: string }[] } | null)
        ?.errors;
      const errorByIndex = new Map((errors ?? []).map((row) => [row.index, row.message]));
      // ⚠️ Les identifiants ne sont apparies a leur destinataire que si les
      // deux listes ont la meme longueur. En mode permissif rien ne garantit
      // que `data` comporte un trou pour chaque echec ; plutot que de risquer
      // d'attribuer l'identifiant d'un envoi au voisin — et de rendre
      // intracable une plainte pour spam — la reference est laissee vide.
      const aligned = ids.length === lot.length;

      lot.forEach((item, position) => {
        const message = errorByIndex.get(position);
        if (message) {
          failed += 1;
          deliveries.push({
            recipient_id: item.recipient.id,
            status: "failed",
            provider_reference: null,
            error_message: message,
          });
          return;
        }
        sent += 1;
        deliveries.push({
          recipient_id: item.recipient.id,
          status: "sent",
          provider_reference: aligned ? (ids[position]?.id ?? null) : null,
          error_message: null,
        });
      });
    } catch (cause) {
      for (const item of lot) {
        failed += 1;
        deliveries.push({
          recipient_id: item.recipient.id,
          status: "failed",
          provider_reference: null,
          error_message: cause instanceof Error ? cause.message : "send_failed",
        });
      }
    }
  }

  return { attempted: prepared.length, sent, failed, skipped, deliveries };
}
