import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, ArrowUpRightIcon, MailIcon } from "lucide-react";

import { ContactForm } from "@/components/site/contact-form";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { LOCALES, localePath } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: dict.contactPage.metaTitle,
    description: dict.contactPage.metaDescription,
    alternates: {
      canonical: localePath(await getLocale(), "/contact"),
      languages: Object.fromEntries(LOCALES.map((l) => [l, localePath(l, "/contact")])),
    },
  };
}

export default async function ContactPage() {
  const dict = await getDictionary();
  const t = dict.contactPage;
  const locale = await getLocale();
  const prefix = locale === "fr" ? "" : `/${locale}`;

  return (
    <div className="site-shell min-h-screen overflow-x-clip font-sans">
      <SiteNav />
      <main className="relative isolate">
        <div aria-hidden className="site-glow pointer-events-none absolute inset-0 -z-10 opacity-40" />
        <div className="mx-auto max-w-7xl px-5 pt-8 pb-16 sm:px-8 sm:pt-10 sm:pb-24">
          <Link href={prefix || "/"} className="inline-flex items-center gap-2 text-xs text-(--site-muted) transition-colors hover:text-(--site-accent)">
            <ArrowLeftIcon className="size-4 rtl:-scale-x-100" aria-hidden />
            {t.back}
          </Link>
          <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <h1 className="font-heading text-4xl leading-[1.08] font-extrabold sm:text-5xl lg:text-6xl">
                {t.titleLine1}
                <br />
                {t.titleLine2pre} <span className="text-(--site-accent)">{t.titleAccent}</span>
              </h1>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-(--site-muted) sm:text-base">
                {t.lead}
              </p>
              <div className="mt-10 border-y border-(--site-line-strong) py-6">
                <div className="flex items-start gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-(--site-line-strong) text-(--site-accent)">
                    <MailIcon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-(--site-muted)">{t.mailPrompt}</p>
                    <a href="mailto:contact@ifriqiyastar.com" className="mt-2 inline-block break-all text-sm font-semibold text-(--site-accent) hover:underline sm:text-base">
                      contact@ifriqiyastar.com
                    </a>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-start justify-between gap-4">
                <div>
                  <p className="font-heading font-bold">{t.faqTitle}</p>
                  <p className="mt-2 text-sm leading-relaxed text-(--site-muted)">{t.faqBody}</p>
                </div>
                <Link href={`${prefix}/#faq`} aria-label={t.faqAria} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-(--site-line-strong) transition-colors hover:border-(--site-accent) hover:text-(--site-accent)">
                  <ArrowUpRightIcon className="size-5 rtl:-scale-x-100" aria-hidden />
                </Link>
              </div>
            </div>
            <ContactForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
