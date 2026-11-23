import type { Metadata } from "next";

import { LegalList, LegalRows, LegalSection, LegalShell, LegalTodo } from "@/components/site/legal";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { LOCALES, localePath, ogImagePath } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary();
  const { metaTitle: title, metaDescription: description } = dict.privacyPage;
  const images = [ogImagePath(locale)];
  return {
    title,
    description,
    alternates: {
      canonical: localePath(locale, "/confidentialite"),
      languages: Object.fromEntries(LOCALES.map((l) => [l, localePath(l, "/confidentialite")])),
    },
    // Meme raison que sur `/contact` : la fusion de metadonnees est
    // superficielle, `siteName`/`type` doivent etre repetes ici.
    openGraph: { title, description, siteName: "Ifriqiya Soccer Star", type: "website", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function PrivacyPage() {
  const dict = await getDictionary();
  const t = dict.privacyPage;
  const locale = await getLocale();

  return (
    <LegalShell
      prefix={locale === "fr" ? "" : `/${locale}`}
      back={t.back}
      pill={t.pill}
      title={t.title}
      titleAccent={t.titleAccent}
      updated={t.updated}
      lead={t.lead}
    >
      <LegalSection title={t.controllerTitle}>
        <p>{t.controllerBody1}</p>
        <p>{t.controllerBody2}</p>
        {/* ⚠️ L'encart ne porte plus QUE ce qui manque réellement : adresse
            complète et immatriculation. L'identité, le contact et le droit
            applicable sont fournis depuis le 2026-11-23. */}
        <LegalTodo label={t.todoLabel}>{t.controllerTodo}</LegalTodo>
      </LegalSection>

      <LegalSection title={t.dataTitle}>
        <p>{t.dataIntro}</p>
        <LegalRows rows={t.dataRows} />
        <p>{t.dataGoogle}</p>
        <LegalRows rows={t.dataOthers} />
      </LegalSection>

      <LegalSection title={t.whyTitle}>
        <LegalList items={t.whyItems} />
      </LegalSection>

      <LegalSection title={t.visibilityTitle}>
        <LegalList items={t.visibilityItems} />
      </LegalSection>

      {/* Les courriels d'annonce sont un traitement a part des courriels de
          service, avec son propre refus : la section le dit, et nomme la boite
          de desabonnement. */}
      <LegalSection title={t.emailsTitle}>
        <p>{t.emailsBody1}</p>
        <p>{t.emailsBody2}</p>
      </LegalSection>

      <LegalSection title={t.moderationTitle}>
        <p>{t.moderationBody1}</p>
        <p>{t.moderationBody2}</p>
      </LegalSection>

      <LegalSection title={t.providersTitle}>
        <LegalRows rows={t.providersRows} />
        <p>{t.providersNote}</p>
        <p>{t.providersNoSale}</p>
        {/* ⚠️ La région est RELEVÉE, pas supposée : `supabase projects list`
            rend `"region":"eu-west-1"` pour ce projet. Ne pas y écrire le
            nom de l'hébergeur d'un AUTRE site du studio — une mention
            d'hébergement fausse dans une politique de confidentialité fait
            retirer une application, pas seulement refuser. */}
        <p>{t.hostingBody}</p>
        <LegalTodo label={t.todoLabel}>{t.hostingTodo}</LegalTodo>
      </LegalSection>

      {/* Les deux sections du SITE, apres celle des prestataires : elles
          parlent de ce qui se passe hors de l'application. */}
      <LegalSection title={t.cookiesTitle}>
        <p>{t.cookiesBody}</p>
      </LegalSection>

      <LegalSection title={t.siteTitle}>
        <p>{t.siteBody}</p>
      </LegalSection>

      <LegalSection title={t.retentionTitle}>
        <LegalTodo label={t.todoLabel}>{t.retentionTodo}</LegalTodo>
      </LegalSection>

      {/* ⚠️ N'est plus un « à compléter » depuis le 2026-11-23 : le régime des
          mineurs a été arbitré et il est APPLIQUÉ côté base — plancher de
          16 ans (migration 0133), consentement d'un représentant légal avant
          activation, et messagerie professionnel ↔ mineur coupée dans les deux
          sens (0132). Ce texte décrit donc ce que le serveur fait réellement,
          et doit suivre toute évolution de ces trois règles. */}
      <LegalSection title={t.minorsTitle}>
        <p>{t.minorsBody1}</p>
        <p>{t.minorsBody2}</p>
        <p>{t.minorsBody3}</p>
      </LegalSection>

      <LegalSection title={t.rightsTitle}>
        <p>{t.rightsBody1}</p>
        <p>{t.rightsBody2}</p>
        <p>{t.contactBody}</p>
      </LegalSection>

      <LegalSection title={t.securityTitle}>
        <p>{t.securityBody}</p>
      </LegalSection>

      <LegalSection title={t.changesTitle}>
        <p>{t.changesBody}</p>
      </LegalSection>
    </LegalShell>
  );
}
