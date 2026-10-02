import { CampaignEmail } from "../campaign-email";

/**
 * Previsualisation arabe du gabarit de campagne. Voir `./README.md`.
 *
 * C'est celle qui compte : le sens de lecture, l'alignement du bouton et la
 * position du logo dans le bandeau ne se verifient qu'a l'oeil.
 */
export default function CampagneArabe() {
  return (
    <CampaignEmail
      title="جلسة جديدة في تونس"
      body={"التسجيل مفتوح حتى 5 أكتوبر.\nالأماكن محدودة: أحضر بطاقة هويتك وحذاءك."}
      locale="ar"
      recipientName="أمين بن صالح"
      unsubscribeUrl="https://www.ifriqiya-soccer.com/api/email/desabonnement?c=apercu&t=apercu"
      siteUrl="https://www.ifriqiya-soccer.com"
    />
  );
}
