import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { NAME_TOKEN, resolveEmailCopy, type ResolvedEmailCopy } from "./copy";
import { EmailBlocks } from "./blocks";
import { DEFAULT_BLOCKS, type EmailBlock } from "@/lib/email/blocks";
import type { Locale } from "@/lib/i18n/config";
import type { RichDoc } from "@/lib/rich-text/server";

/**
 * Le courriel d'une campagne du back-office.
 *
 * ⚠️ **Rien ici n'est du CSS moderne.** React Email compile en tableaux et en
 * styles en ligne parce que c'est ce que Outlook et Gmail rendent encore en
 * 2026 : pas de flexbox, pas de grille, pas de variable CSS, pas de classe
 * Tailwind. Les couleurs sont donc ecrites en dur — ce sont les quatre de la
 * charte (`#000000`, `#aff70f`, `#CCCCCC`, `#FFFFFF`), les memes que
 * `.site-shell`, recopiees plutot qu'importees faute de cascade.
 *
 * ⚠️ **Le logo est une URL absolue, pas un import.** Une image de courriel est
 * chargee par le client de messagerie, depuis internet : un chemin
 * `/brand/...` n'y veut rien dire. Elle est aussi en PNG plutot qu'en SVG —
 * Gmail et Outlook ne rendent pas le SVG.
 *
 * ⚠️ **Le corps du message n'est pas interprete.** Il part tel que
 * l'administrateur l'a tape : pas de Markdown, pas de HTML, pas de variable
 * substituee. Les sauts de ligne deviennent des paragraphes, et rien d'autre.
 * Rendre du HTML fourni par un formulaire, meme celui d'un administrateur,
 * ouvrirait une injection dans la boite de milliers de gens.
 */
export type CampaignEmailProps = {
  title: string;
  body: string;
  locale: Locale;
  recipientName?: string | null;
  /** Lien de desabonnement, deja signe. Absent = pas de pied de desabonnement. */
  unsubscribeUrl?: string;
  /** Racine publique du site, pour le logo et le lien « ouvrir l'application ». */
  siteUrl: string;
  /**
   * L'habillage effectif. Absent, ce sont les defauts livres : c'est ce qui
   * rend la previsualisation autonome et ce qui fait qu'une installation
   * sans la table `admin_email_template` envoie exactement comme avant.
   */
  copy?: ResolvedEmailCopy;
  /**
   * Le message mis en forme, deja valide par le schema Tiptap. Absent, le
   * `body` brut est rendu en paragraphes — c'est ce qui se passe pour une
   * campagne redigee avant l'editeur riche, et pour toute installation sans
   * la migration correspondante.
   */
  bodyDoc?: RichDoc | null;
  /** Le corps compose du modele. Absent : le message seul, comme avant. */
  blocks?: EmailBlock[];
};

// ⚠️ Les polices de la charte ne sont pas chargeables dans un courriel :
// `@font-face` est ignore par Outlook et par l'application Gmail. On les
// nomme quand meme — les clients qui les ont installees les utiliseront — et
// la pile se termine par une police reellement presente partout.
const HEADING_FONT = "'Nunito Sans', 'Segoe UI', Arial, Helvetica, sans-serif";
const BODY_FONT = "Poppins, 'Segoe UI', Arial, Helvetica, sans-serif";

// ⚠️ Seules les deux nuances **neutres** restent en dur : elles ne sont pas
// de la charte, ce sont les gris d'un pied de page, et les rendre reglables
// multiplierait les facons de rendre un courriel illisible sans rien
// apporter. Les cinq autres couleurs viennent de l'habillage.
const MUTED = "#6b6b6b";
const RULE = "#e5e5e5";

/**
 * Noir ou blanc, selon ce qui se lit sur le fond donne.
 *
 * ⚠️ Le nom de la marque etait ecrit en blanc en dur. Des l'instant ou
 * l'en-tete devient reglable, un fond clair le rendait invisible — et
 * personne cote administration ne l'aurait vu, l'apercu etant regarde apres
 * avoir choisi la couleur. Seuil de luminance relative de la WCAG.
 */
function readableOn(background: string): string {
  const hex = background.replace("#", "");
  if (hex.length !== 6) return "#ffffff";
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

export function CampaignEmail({
  title,
  body,
  locale,
  recipientName,
  unsubscribeUrl,
  siteUrl,
  copy: given,
  bodyDoc,
  blocks,
}: CampaignEmailProps) {
  const copy = given ?? resolveEmailCopy(locale, null, siteUrl);
  const { headerBg, bodyBg, text: inkText, buttonBg, buttonText } = copy.colors;
  const rtl = copy.dir === "rtl";
  /**
   * ⚠️ **Le bouton de l'habillage s'efface devant celui du modele.**
   * Depuis que le corps se compose par blocs, un modele peut porter son
   * propre bouton — et le bouton fixe de l'habillage venait alors s'ajouter
   * dessous, deux appels a l'action l'un sur l'autre. Laisser le super
   * administrateur decocher le second supposerait qu'il comprenne d'ou
   * vient chacun ; la regle le fait a sa place, et elle est deterministe.
   */
  const hasBlockButton = Boolean(blocks?.some((block) => block.type === "button"));
  const used = blocks?.length ? blocks : DEFAULT_BLOCKS;
  /**
   * ⚠️ **Repli, pas remplacement.** L'accueil et la signature existent encore
   * comme champs d'habillage ; des qu'un modele en pose un en bloc, le champ
   * s'efface. Meme regle que le bouton, et meme raison : aucun modele
   * existant ne perd son accueil du jour au lendemain, et l'adoption se fait
   * modele par modele.
   */
  const hasBlockGreeting = used.some((block) => block.type === "greeting");
  const hasBlockSignature = used.some((block) => block.type === "signature");
  const align = rtl ? ("right" as const) : ("left" as const);
  // Les sauts de ligne de la zone de saisie deviennent des paragraphes : le
  // texte brut d'un `<textarea>` s'affiche autrement sur une seule ligne.
  const paragraphs = body.split(/\n{1,}/).map((line) => line.trim()).filter(Boolean);

  return (
    <Html lang={locale} dir={copy.dir}>
      <Head />
      {/* Le preheader : la ligne grise affichee a cote de l'objet dans la
          boite de reception. Sans lui, le client de messagerie y met le
          premier texte trouve — souvent « Ouvrir l'application ». */}
      <Preview>{title}</Preview>
      <Body style={{ backgroundColor: "#f4f4f4", margin: 0, padding: "24px 0" }}>
        <Container
          style={{
            backgroundColor: bodyBg,
            borderRadius: "12px",
            margin: "24px auto",
            maxWidth: "600px",
            overflow: "hidden",
            width: "100%",
          }}
        >
          {/* ⚠️ Le nom est ecrit a cote du logo, et l'image porte donc
              `alt=""`. Le fichier de marque embarque sa propre plaque noire :
              pose sur un bandeau noir, il ne reste que le signe lime, trop
              tenu pour identifier l'expediteur a lui seul. Le nom le double,
              comme partout ailleurs dans le produit — et il reste lisible
              quand le client de messagerie bloque les images, ce que font la
              plupart par defaut. */}
          <Section style={{ backgroundColor: headerBg, padding: "16px 24px" }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
              <tbody>
                <tr>
                  {/* Ecart explicite plutot que `padding-inline-end` : les
                      proprietes logiques ne sont pas rendues par Outlook, ou
                      le logo viendrait alors toucher le nom. */}
                  <td
                    style={{
                      ...(rtl ? { paddingLeft: "12px" } : { paddingRight: "12px" }),
                      verticalAlign: "middle",
                    }}
                  >
                    {/* ⚠️ Le **signe seul**, pas l'icone d'application.
                        `ifriqiya-star.svg` est dessine comme une icone de
                        telephone : une plaque noire arrondie et, au centre,
                        un signe qui n'occupe que 31 x 91 d'une boite de
                        160 x 160. Pose sur un bandeau noir, la plaque
                        disparait et il ne reste qu'un point lime flottant
                        loin du nom — mesure, c'est ce qui rendait le logo
                        illisible. `ifriqiya-star-mark.png` est ce meme signe
                        rogne a sa boite englobante, donc affichable a sa
                        vraie taille. Les proportions (125 x 364) fixent le
                        couple largeur/hauteur ci-dessous ; les changer
                        l'etirerait. */}
                    <Img
                      src={`${siteUrl}/brand/ifriqiya-star-mark.png`}
                      alt=""
                      width="11"
                      height="32"
                      style={{ display: "block" }}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle" }}>
                    <span
                      style={{
                        color: readableOn(headerBg),
                        fontFamily: HEADING_FONT,
                        fontSize: "15px",
                        fontWeight: 800,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {copy.senderName}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={{ padding: "28px 24px 8px" }}>
            {hasBlockGreeting ? null : (
              <Text
                style={{
                  color: MUTED,
                  fontFamily: BODY_FONT,
                  fontSize: "14px",
                  margin: "0 0 12px",
                  textAlign: align,
                }}
              >
                {recipientName?.trim()
                  ? copy.greetingNamed.replaceAll(NAME_TOKEN, recipientName.trim())
                  : copy.greetingPlain}
              </Text>
            )}
            {/* Le corps compose : le modele dit **ou** le message se pose,
                le composeur dit **ce qu'il contient**. Un modele qui n'a rien
                compose rend le message seul, exactement comme avant. */}
            <EmailBlocks
              blocks={used}
              locale={locale}
              align={align}
              colors={{ text: inkText, buttonBg, buttonText }}
              fonts={{ body: BODY_FONT, heading: HEADING_FONT }}
              message={{ title, doc: bodyDoc ?? null, paragraphs }}
              recipientName={recipientName}
            />
            {copy.signature && !hasBlockSignature ? (
              <Text
                style={{
                  color: MUTED,
                  fontFamily: BODY_FONT,
                  fontSize: "14px",
                  lineHeight: "1.65",
                  margin: "18px 0 0",
                  textAlign: align,
                  whiteSpace: "pre-line",
                }}
              >
                {copy.signature}
              </Text>
            ) : null}
          </Section>

          {copy.showCta && !hasBlockButton ? (
            <Section style={{ padding: "8px 24px 28px", textAlign: align }}>
              {/* Un `<a>` stylise, pas le composant `Button` : celui-ci se
                  centre, et le bouton doit suivre le sens de lecture. */}
              <Link
                href={copy.ctaUrl ?? siteUrl}
                style={{
                  backgroundColor: buttonBg,
                  borderRadius: "8px",
                  color: buttonText,
                  display: "inline-block",
                  fontFamily: BODY_FONT,
                  fontSize: "14px",
                  fontWeight: 700,
                  padding: "12px 22px",
                  textDecoration: "none",
                }}
              >
                {copy.ctaLabel}
              </Link>
            </Section>
          ) : (
            <Section style={{ padding: "0 24px 20px" }} />
          )}

          <Hr style={{ borderColor: RULE, margin: 0 }} />

          <Section style={{ padding: "18px 24px 24px" }}>
            <Text style={{ color: MUTED, fontFamily: BODY_FONT, fontSize: "12px", lineHeight: "1.6", margin: "0 0 6px", textAlign: align }}>
              {copy.footerWhy}
            </Text>
            {unsubscribeUrl ? (
              <>
                <Text style={{ fontFamily: BODY_FONT, fontSize: "12px", lineHeight: "1.6", margin: "0 0 4px", textAlign: align }}>
                  <Link href={unsubscribeUrl} style={{ color: MUTED, textDecoration: "underline" }}>
                    {copy.unsubscribeLabel}
                  </Link>
                </Text>
                <Text style={{ color: MUTED, fontFamily: BODY_FONT, fontSize: "11px", lineHeight: "1.6", margin: "0 0 10px", textAlign: align }}>
                  {copy.unsubscribeHint}
                </Text>
              </>
            ) : null}
            <Text style={{ color: "#9a9a9a", fontFamily: BODY_FONT, fontSize: "11px", margin: 0, textAlign: align }}>
              {copy.rights}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Les donnees que le serveur de previsualisation (`npm run email`) injecte.
 *
 * Elles ne partent jamais : React Email les utilise pour afficher le gabarit
 * dans le navigateur, ou il serait autrement rendu sans aucune propriete —
 * c'est-a-dire vide. Les variantes par langue vivent dans `emails/apercus/`.
 */
CampaignEmail.PreviewProps = {
  title: "Nouvelle session Scout Day a Tunis",
  body: "Les inscriptions sont ouvertes jusqu'au 5 octobre.\nPlaces limitees : presentez-vous avec une piece d'identite et vos crampons.",
  locale: "fr",
  recipientName: "Amine Ben Salah",
  unsubscribeUrl: "https://www.ifriqiya-soccer.com/api/email/desabonnement?c=apercu&t=apercu",
  siteUrl: "https://www.ifriqiya-soccer.com",
} satisfies CampaignEmailProps;

export default CampaignEmail;
