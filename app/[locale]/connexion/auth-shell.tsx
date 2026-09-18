import type * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";

import { localePath, type Locale } from "@/lib/i18n/config";

/**
 * Le decor de la porte d'entree du back-office : photo, en-tete, argumentaire
 * a gauche, carte a droite.
 *
 * Il est partage par les **deux** ecrans qui y vivent — la connexion et la
 * reinitialisation du mot de passe — parce qu'ils sont un seul geste
 * interrompu : passer de l'un a l'autre ne doit pas donner l'impression de
 * changer de site, et une retouche du decor faite d'un seul cote la ferait.
 *
 * ⚠️ Comme `/connexion`, ces ecrans suivent la langue du **back-office**
 * (`isAdminPath()` couvre `/connexion/...`) : francais ou anglais, jamais
 * arabe.
 */
export function AuthShell({
  locale,
  chrome,
  card,
  children,
}: {
  locale: Locale;
  chrome: {
    backToSite: string;
    kicker: string;
    heroKicker: string;
    heroTitle: string;
    heroAccent: string;
    heroDescription: string;
  };
  card: {
    /**
     * Identifiant du titre, cible d'`aria-labelledby` sur la section. Quand
     * l'en-tete est laisse aux enfants (`title` absent), c'est a eux de porter
     * cet identifiant sur leur propre titre.
     */
    titleId: string;
    /**
     * L'en-tete de la carte. Il est **facultatif** : l'ecran de
     * reinitialisation change de titre a chaque etape, et ses etapes sont un
     * etat client — un en-tete rendu ici resterait fige sur celui de la
     * premiere.
     */
    kicker?: string;
    title?: string;
    description?: string;
    /** Note de bas de carte, sous un filet. Absente sur certains ecrans. */
    footer?: string;
    /** Lien de retour affiche au-dessus du sur-titre. */
    back?: { href: string; label: string };
  };
  children: React.ReactNode;
}) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <Image
          src="/images/connexion-scout-day-ai.webp"
          alt=""
          fill
          sizes="100vw"
          preload
          className="object-cover object-[35%_center] lg:object-center"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/15 to-black/40" />
        <div className="absolute inset-0 hidden bg-linear-to-r from-transparent via-transparent to-background/80 lg:block" />
      </div>

      <header className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-10 lg:px-16 lg:py-9">
        <Link
          href={localePath(locale, "/")}
          className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Image src="/brand/ifriqiya-star.svg" alt="" width={44} height={44} />
          <span className="font-heading text-lg font-extrabold tracking-wide text-white">IFRIQIYA SOCCER STAR</span>
        </Link>
        <Link
          href={localePath(locale, "/")}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-white/80 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          {chrome.backToSite}
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-[1440px] flex-1 items-center gap-12 px-6 py-8 sm:px-10 sm:py-12 lg:grid-cols-[1fr_460px] lg:gap-20 lg:px-16">
        <div className="hidden max-w-lg self-end pb-12 lg:block">
          <div className="mb-5 flex items-center gap-3 text-sm font-medium tracking-[0.18em] text-brand uppercase">
            <ShieldCheckIcon className="size-5 shrink-0" aria-hidden="true" />
            {chrome.heroKicker}
          </div>
          <h2 className="text-balance font-heading text-5xl leading-[1.08] font-extrabold tracking-tight xl:text-6xl">
            {chrome.heroTitle}
            <span className="mt-1 block text-brand">{chrome.heroAccent}</span>
          </h2>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-white/75">{chrome.heroDescription}</p>
        </div>

        <section
          aria-labelledby={card.titleId}
          className="mx-auto w-full max-w-[460px] rounded-3xl border border-white/12 bg-background/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10"
        >
          <div className={card.title ? "mb-8" : undefined}>
            {card.back ? (
              <Link
                href={card.back.href}
                className="mb-4 inline-flex min-h-8 items-center gap-2 text-sm text-white/70 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
              >
                <ArrowLeftIcon className="size-4" aria-hidden="true" />
                {card.back.label}
              </Link>
            ) : null}
            {card.title ? (
              <>
                <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-brand uppercase">{card.kicker}</p>
                <h1 id={card.titleId} className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {card.title}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{card.description}</p>
              </>
            ) : null}
          </div>

          {children}

          {card.footer ? (
            <div className="mt-7 flex items-start gap-2.5 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/55">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-brand/80" aria-hidden="true" />
              <p>{card.footer}</p>
            </div>
          ) : null}
        </section>
      </div>
      <footer className="mx-auto w-full max-w-[1440px] px-6 py-6 text-xs tracking-wide text-white/50 sm:px-10 lg:px-16">
        IFRIQIYA SOCCER STAR <span className="mx-2 text-brand" aria-hidden="true">/</span> {chrome.kicker}
      </footer>
    </main>
  );
}
