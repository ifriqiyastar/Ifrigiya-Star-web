import "server-only";

import { headers } from "next/headers";

import { render } from "@react-email/render";

import { CampaignEmail } from "@/emails/campaign-email";
import type { ResolvedEmailCopy } from "@/emails/copy";
import { SITE_URL } from "@/lib/email/campaign";
import type { Locale } from "@/lib/i18n/config";
import type { EmailBlock } from "@/lib/email/blocks";
import type { RichDoc } from "@/lib/rich-text/server";

/** Le message d'exemple de l'apercu, dans la langue montree. */
const SAMPLE: Record<Locale, { title: string; body: string; name: string }> = {
  fr: {
    title: "Nouvelle session Scout Day a Tunis",
    body: "Les inscriptions sont ouvertes jusqu'au 5 octobre.\nPlaces limitees : presentez-vous avec une piece d'identite et vos crampons.",
    name: "Amine Ben Salah",
  },
  en: {
    title: "New Scout Day session in Tunis",
    body: "Registration is open until 5 October.\nLimited places: bring your ID and your boots.",
    name: "Amine Ben Salah",
  },
  ar: {
    title: "جلسة جديدة في تونس",
    body: "التسجيل مفتوح حتى 5 أكتوبر.\nالأماكن محدودة: أحضر بطاقة هويتك وحذاءك.",
    name: "أمين بن صالح",
  },
};

/**
 * L'origine **de ce deploiement**, pour les images de l'apercu.
 *
 * ⚠️ Un courriel reel porte `SITE_URL` : un destinataire ne sait pas resoudre
 * l'adresse de la machine qui a rendu le message. Mais l'apercu, lui, est
 * regarde depuis le back-office — et le back-office et le site sont la meme
 * application. Pointer l'apercu sur la production afficherait une image
 * cassee tant qu'un fichier nouvellement ajoute a `public/` n'est pas
 * deploye, alors qu'il est la, servi par le serveur qu'on interroge.
 *
 * C'est la seule difference entre l'apercu et l'envoi, et elle va dans le
 * bon sens : l'apercu montre les fichiers de la version qu'on regarde.
 */
async function previewOrigin(): Promise<string> {
  try {
    const head = await headers();
    const host = head.get("x-forwarded-host") ?? head.get("host");
    if (!host) return SITE_URL;
    const protocol = head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${protocol}://${host}`;
  } catch {
    return SITE_URL;
  }
}

/**
 * Le courriel tel qu'il partira, rendu pour l'ecran d'habillage.
 *
 * ⚠️ **Le meme `CampaignEmail` que l'envoi**, pas une maquette qui lui
 * ressemble : un apercu approximatif finit par diverger, et c'est
 * exactement sur cet ecran qu'on aurait le plus confiance en lui.
 *
 * Le lien de desabonnement est factice — signer un vrai jeton pour un apercu
 * mettrait dans le HTML de la page un lien qui desabonne pour de bon.
 */
export async function renderCampaignPreview(
  locale: Locale,
  copy: ResolvedEmailCopy,
  blocks?: EmailBlock[],
): Promise<string> {
  const sample = SAMPLE[locale];
  return renderCampaignEmail({
    title: sample.title,
    body: sample.body,
    locale,
    copy,
    blocks,
    recipientName: sample.name,
  });
}

/**
 * Le meme rendu, avec un contenu donne : c'est ce qu'emploie l'apercu vivant
 * du composeur. Un seul chemin de rendu pour les deux ecrans, sinon ils
 * finiraient par montrer deux courriels differents.
 */
export async function renderCampaignEmail({
  title,
  body,
  bodyDoc,
  locale,
  copy,
  blocks,
  recipientName,
}: {
  title: string;
  body: string;
  bodyDoc?: RichDoc | null;
  locale: Locale;
  copy: ResolvedEmailCopy;
  blocks?: EmailBlock[];
  recipientName?: string;
}): Promise<string> {
  const origin = await previewOrigin();
  return render(
    CampaignEmail({
      title,
      body,
      bodyDoc: bodyDoc ?? null,
      blocks,
      locale,
      recipientName: recipientName ?? SAMPLE[locale].name,
      // Un jeton factice : signer un vrai lien pour un apercu mettrait dans
      // le HTML de la page un lien qui desabonne pour de bon.
      unsubscribeUrl: `${SITE_URL}/api/email/desabonnement?c=apercu&t=apercu`,
      siteUrl: origin,
      copy,
    }),
  );
}
