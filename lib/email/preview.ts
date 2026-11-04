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
 * Le nom d'exemple de l'apercu, dans la langue montree.
 *
 * ⚠️ **Un nom, et plus de message.** L'apercu posait aussi un titre et un
 * texte d'exemple dans le bloc `message` du modele. Sur un ecran dont tout
 * l'objet est de montrer ce que le modele contient, ces deux lignes etaient
 * la seule chose fausse a l'image — et, prises entre des blocs qui portent
 * du vrai texte, elles se lisaient comme le texte du modele. On a d'abord
 * essaye de les rediger comme un emplacement (« Le titre de votre
 * message »), ce qui n'a deplace le probleme qu'a moitie : un emplacement
 * rendu en gros caractere au milieu d'une invitation beta reste une phrase
 * que l'oeil lit. L'apercu ne montre donc plus que le modele.
 *
 * Rien a prevoir cote rendu : `emails/blocks.tsx` n'ecrit le titre que s'il
 * existe et filtre les paragraphes vides, donc le bloc ne rend rien. Un
 * modele qui ne compose rien s'apercoit alors avec un blanc au milieu — et
 * c'est exact, ce modele-la n'ajoute rien au message. L'emplacement, lui,
 * est deja nomme juste a cote, dans la carte « Message de la campagne » du
 * compositeur de blocs.
 *
 * Le nom reste : ce n'est pas du contenu d'emprunt, c'est ce qui montre
 * comment l'accueil de l'habillage resout `{name}` — c'est-a-dire ce que
 * l'ecran sert precisement a regler.
 */
const SAMPLE_NAME: Record<Locale, string> = {
  fr: "Amine Ben Salah",
  en: "Amine Ben Salah",
  ar: "أمين بن صالح",
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
  return renderCampaignEmail({
    // Vides a dessein : cet ecran montre le modele, pas une campagne. Le
    // bloc `message` ne rend alors rien, et `heading` suit le titre.
    title: "",
    body: "",
    locale,
    copy,
    blocks,
    recipientName: SAMPLE_NAME[locale],
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
      recipientName: recipientName ?? SAMPLE_NAME[locale],
      // Un jeton factice : signer un vrai lien pour un apercu mettrait dans
      // le HTML de la page un lien qui desabonne pour de bon.
      unsubscribeUrl: `${SITE_URL}/api/email/desabonnement?c=apercu&t=apercu`,
      siteUrl: origin,
      copy,
    }),
  );
}
