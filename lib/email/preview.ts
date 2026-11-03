import "server-only";

import { headers } from "next/headers";

import { render } from "@react-email/render";

import { CampaignEmail } from "@/emails/campaign-email";
import type { ResolvedEmailCopy } from "@/emails/copy";
import { SITE_URL } from "@/lib/email/campaign";
import type { Locale } from "@/lib/i18n/config";
import type { EmailBlock } from "@/lib/email/blocks";
import type { RichDoc } from "@/lib/rich-text/server";

/**
 * Le message d'exemple de l'apercu, dans la langue montree.
 *
 * ⚠️ **Un texte qui se lit comme un emplacement, pas comme une annonce.**
 * L'exemple etait une session Scout Day, redigee comme un vrai message : sur
 * un catalogue qui porte desormais une invitation aux beta testeurs et des
 * annonces marketing, chaque modele s'apercevait donc en Scout Day, et le
 * modele semblait parler de ce dont il ne parle pas. Or ces deux lignes ne
 * sont **pas** le modele : elles tiennent la place du titre et du message
 * que la campagne apportera, et les blocs du modele — eux — portent bien son
 * contenu propre. Un emplacement doit se donner pour ce qu'il est.
 *
 * La formulation est celle du composeur (`SAMPLE_BODY`), pour que les deux
 * apercus de l'application ne racontent pas deux choses differentes.
 */
const SAMPLE: Record<Locale, { title: string; body: string; name: string }> = {
  fr: {
    title: "Le titre de votre message",
    body: "Le message apparaitra ici, tel que le destinataire le lira.\nUn retour a la ligne devient un nouveau paragraphe.",
    name: "Amine Ben Salah",
  },
  en: {
    title: "Your message title",
    body: "The message will appear here, as the recipient will read it.\nA line break becomes a new paragraph.",
    name: "Amine Ben Salah",
  },
  ar: {
    title: "عنوان رسالتك",
    body: "ستظهر الرسالة هنا، كما سيقرأها المستلم.\nكل سطر جديد يصبح فقرة جديدة.",
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
  heading,
  body,
  bodyDoc,
  locale,
  copy,
  blocks,
  recipientName,
}: {
  title: string;
  /** Le titre affiche en tete du message, qui n'est pas l'objet. */
  heading?: string | null;
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
      heading,
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
