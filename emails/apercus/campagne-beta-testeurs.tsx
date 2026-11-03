import { CampaignEmail } from "../campaign-email";
import { resolveEmailCopy } from "../copy";
import { normalizeBlocks } from "@/lib/email/blocks";

/**
 * Previsualisation du modele « Invitation beta testeurs ». Voir `./README.md`.
 *
 * ⚠️ **Ce fichier ne definit pas le modele** : celui-ci vit en base, pose par
 * `supabase/migrations/202611020002_beta_tester_template.sql` et modifiable a
 * l'ecran. Les blocs sont recopies ici pour pouvoir **regarder** le courriel
 * sans appliquer la migration ni ouvrir le back-office. S'ils divergent, c'est
 * la base qui a raison.
 *
 * ⚠️ `recipientName` est volontairement renseigne, et pourtant **aucun nom ne
 * doit apparaitre** : les deux formules d'accueil du modele sont identiques et
 * ne portent pas de jeton de substitution. C'est le temoin de la demande — si
 * un nom se lit dans l'apercu, le modele a ete casse.
 */
export const BLOCKS = normalizeBlocks([
  { id: "accueil", type: "greeting", named: { fr: "Bonjour," }, plain: { fr: "Bonjour," } },
  { id: "invitation", type: "text", text: { fr: "Vous etes invite a essayer Ifriqiya Soccer Star avant son ouverture au public.\nL'application met en relation les joueurs et les recruteurs : un joueur y construit son profil sportif et se rend visible, un recruteur y cherche des profils et organise ses sessions de detection.\nVous faites partie du premier groupe a l'ouvrir. Rien n'y est encore fige, et c'est bien pour cela que votre avis compte." } },
  { id: "message", type: "message" },
  { id: "trait-1", type: "divider" },
  { id: "etapes", type: "text", text: { fr: "Pour rejoindre le test, trois gestes, une seule fois :\n1. Ouvrez le lien ci-dessous depuis le telephone Android sur lequel vous testerez.\n2. Acceptez de rejoindre le test, puis installez l'application depuis le Play Store.\n3. Creez votre compte et servez-vous en comme vous le feriez vraiment." } },
  { id: "bouton", type: "button", label: { fr: "Rejoindre le test" }, href: "https://play.google.com/apps/testing/REMPLACER-PAR-VOTRE-PACKAGE" },
  { id: "compte-google", type: "text", text: { fr: "Le lien ne fonctionne qu'avec le compte Google de l'adresse qui a recu ce message, et l'application peut mettre quelques minutes a devenir installable." } },
  { id: "trait-2", type: "divider" },
  { id: "attendu", type: "columns", left: { fr: "C'est une version de test : attendez-vous a des lenteurs, des textes provisoires, parfois un ecran qui se ferme. Rien de cela n'est definitif." }, right: { fr: "Ce qui nous aide le plus : savoir ou vous avez hesite, ce que vous vous attendiez a trouver, et ce qui vous a semble lent. Une capture d'ecran vaut dix lignes." } },
  { id: "retour", type: "text", text: { fr: "Pour nous ecrire, repondez simplement a ce message. Merci du temps que vous y passerez : c'est lui qui decide de ce que verront les joueurs." } },
  { id: "signature", type: "signature", text: { fr: "L'equipe Ifriqiya Soccer Star" } },
]);

const SITE = "https://www.ifriqiya-soccer.com";

export default function CampagneBetaTesteurs() {
  return (
    <CampaignEmail
      title="Vous etes invite a tester Ifriqiya Soccer Star"
      // L'objet ne se repete pas en titre dans le message.
      heading={null}
      body={
        "Nous ouvrons l'application a un premier groupe de testeurs avant sa sortie publique.\nVous en faites partie."
      }
      locale="fr"
      blocks={BLOCKS}
      recipientName="Temoin Qui Ne Doit Pas Apparaitre"
      unsubscribeUrl={`${SITE}/api/email/desabonnement?e=apercu&t=apercu`}
      siteUrl={SITE}
      copy={resolveEmailCopy(
        "fr",
        {
          locale: "fr",
          sender_name: "Ifriqiya Soccer Star",
          reply_to: null,
          greeting_named: "Bonjour,",
          greeting_plain: "Bonjour,",
          show_cta: false,
          cta_label: null,
          cta_url: null,
          signature: "L'equipe Ifriqiya Soccer Star",
          footer_why:
            "Vous recevez ce message parce que votre adresse a ete inscrite a la phase de test de l'application.",
          unsubscribe_label: "Ne plus recevoir ces messages",
          unsubscribe_hint: "Vous ne recevrez plus d'invitation ni d'annonce de notre part.",
          rights: "Ifriqiya Soccer Star — Tous droits reserves",
          color_header_bg: "#000000",
          color_body_bg: "#FFFFFF",
          color_text: "#000000",
          color_button_bg: "#aff70f",
          color_button_text: "#000000",
        },
        SITE,
      )}
    />
  );
}
