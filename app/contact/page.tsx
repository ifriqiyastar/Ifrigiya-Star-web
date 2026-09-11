import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, ArrowUpRightIcon, MailIcon } from "lucide-react";

import { ContactForm } from "@/components/site/contact-form";
import { Pill } from "@/components/site/pieces";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";

export const metadata: Metadata = {
  title: "Contactez-nous",
  description:
    "Contactez l'équipe Ifriqiya Star pour une question sur l'académie, les Scout Days, l'application ou un partenariat.",
};

export default function ContactPage() {
  return (
    <div className="site-shell min-h-screen overflow-x-clip font-sans">
      <SiteNav />
      <main className="relative isolate">
        <div aria-hidden className="site-glow pointer-events-none absolute inset-0 -z-10 opacity-40" />
        <div className="mx-auto max-w-7xl px-5 pt-8 pb-16 sm:px-8 sm:pt-10 sm:pb-24">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-(--site-muted) transition-colors hover:text-(--site-accent)">
            <ArrowLeftIcon className="size-4" aria-hidden />
            Retour à l&apos;accueil
          </Link>
          <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <Pill>
                <span className="size-1.5 rounded-full bg-(--site-accent)" />
                Contactez-nous
              </Pill>
              <h1 className="font-heading mt-6 text-4xl leading-[1.08] font-extrabold sm:text-5xl lg:text-6xl">
                Tout commence
                <br />
                par un <span className="text-(--site-accent)">échange.</span>
              </h1>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-(--site-muted) sm:text-base">
                Joueur, parent, club ou partenaire : parlez-nous de votre projet.
                L&apos;équipe Ifriqiya Star est à votre écoute.
              </p>
              <div className="mt-10 border-y border-(--site-line-strong) py-6">
                <div className="flex items-start gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-(--site-line-strong) text-(--site-accent)">
                    <MailIcon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-(--site-muted)">Vous préférez nous écrire directement ?</p>
                    <a href="mailto:contact@ifriqiyastar.com" className="mt-2 inline-block break-all text-sm font-semibold text-(--site-accent) hover:underline sm:text-base">
                      contact@ifriqiyastar.com
                    </a>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-start justify-between gap-4">
                <div>
                  <p className="font-heading font-bold">Une question sur l&apos;application ?</p>
                  <p className="mt-2 text-sm leading-relaxed text-(--site-muted)">Les premières réponses se trouvent peut-être dans notre FAQ.</p>
                </div>
                <Link href="/#faq" aria-label="Consulter les questions fréquentes" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-(--site-line-strong) transition-colors hover:border-(--site-accent) hover:text-(--site-accent)">
                  <ArrowUpRightIcon className="size-5" aria-hidden />
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
