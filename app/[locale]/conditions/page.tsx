import type { Metadata } from "next";

import { LegalList, LegalSection, LegalShell, LegalTodo } from "@/components/site/legal";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { LOCALES, localePath, ogImagePath } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary();
  const { metaTitle: title, metaDescription: description } = dict.termsPage;
  const images = [ogImagePath(locale)];
  return {
    title,
    description,
    alternates: {
      canonical: localePath(locale, "/conditions"),
      languages: Object.fromEntries(LOCALES.map((l) => [l, localePath(l, "/conditions")])),
    },
    openGraph: { title, description, siteName: "Ifriqiya Soccer Star", type: "website", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function TermsPage() {
  const dict = await getDictionary();
  const t = dict.termsPage;
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
      <LegalSection title={t.operatorTitle}>
        <LegalTodo label={t.todoLabel}>{t.operatorTodo}</LegalTodo>
      </LegalSection>

      <LegalSection title={t.serviceTitle}>
        <p>{t.serviceBody1}</p>
        <p>{t.serviceBody2}</p>
      </LegalSection>

      <LegalSection title={t.accountTitle}>
        <LegalList items={t.accountItems} />
      </LegalSection>

      <LegalSection title={t.ageTitle}>
        <LegalTodo label={t.todoLabel}>{t.ageTodo}</LegalTodo>
      </LegalSection>

      <LegalSection title={t.conductTitle}>
        <LegalList items={t.conductItems} />
      </LegalSection>

      <LegalSection title={t.contentTitle}>
        <p>{t.contentBody1}</p>
        <p>{t.contentBody2}</p>
      </LegalSection>

      <LegalSection title={t.moderationTitle}>
        <p>{t.moderationBody1}</p>
        <p>{t.moderationBody2}</p>
      </LegalSection>

      <LegalSection title={t.scoutDaysTitle}>
        <p>{t.scoutDaysBody}</p>
        <p>{t.scoutDaysNote}</p>
      </LegalSection>

      <LegalSection title={t.moneyTitle}>
        <LegalTodo label={t.todoLabel}>{t.moneyTodo}</LegalTodo>
      </LegalSection>

      <LegalSection title={t.terminationTitle}>
        <p>{t.terminationBody}</p>
      </LegalSection>

      <LegalSection title={t.liabilityTitle}>
        <p>{t.liabilityBody}</p>
      </LegalSection>

      <LegalSection title={t.ipTitle}>
        <p>{t.ipBody}</p>
      </LegalSection>

      <LegalSection title={t.lawTitle}>
        <LegalTodo label={t.todoLabel}>{t.lawTodo}</LegalTodo>
      </LegalSection>

      <LegalSection title={t.changesTitle}>
        <p>{t.changesBody}</p>
      </LegalSection>
    </LegalShell>
  );
}
