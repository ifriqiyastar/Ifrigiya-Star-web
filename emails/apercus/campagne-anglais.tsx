import { CampaignEmail } from "../campaign-email";

/** Previsualisation anglaise du gabarit de campagne. Voir `./README.md`. */
export default function CampagneAnglais() {
  return (
    <CampaignEmail
      title="New Scout Day session in Tunis"
      body={"Registration is open until 5 October.\nLimited places: bring your ID and your boots."}
      locale="en"
      recipientName="Amine Ben Salah"
      unsubscribeUrl="https://www.ifriqiya-soccer.com/api/email/desabonnement?c=apercu&t=apercu"
      siteUrl="https://www.ifriqiya-soccer.com"
    />
  );
}
