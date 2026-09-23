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

      <LegalSection title={t.moderationTitle}>
        <p>{t.moderationBody1}</p>
        <p>{t.moderationBody2}</p>
      </LegalSection>

      <LegalSection title={t.providersTitle}>
        <LegalRows rows={t.providersRows} />
        <p>{t.providersNote}</p>
        <p>{t.providersNoSale}</p>
        <LegalTodo label={t.todoLabel}>{t.hostingTodo}</LegalTodo>
      </LegalSection>

      <LegalSection title={t.retentionTitle}>
        <LegalTodo label={t.todoLabel}>{t.retentionTodo}</LegalTodo>
      </LegalSection>

      <LegalSection title={t.minorsTitle}>
        <LegalTodo label={t.todoLabel}>{t.minorsTodo}</LegalTodo>
      </LegalSection>

      <LegalSection title={t.rightsTitle}>
        <p>{t.rightsBody1}</p>
        <p>{t.rightsBody2}</p>
        <LegalTodo label={t.todoLabel}>{t.contactTodo}</LegalTodo>
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
