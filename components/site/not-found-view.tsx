import Link from "next/link";
import { ArrowLeftIcon, ArrowUpRightIcon } from "lucide-react";

import { Pill } from "@/components/site/pieces";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * La page 404 du site public, habillee comme le reste du site vitrine — meme
 * `.site-shell`, meme entete, meme pied de page, meme charte (#000000,
 * #aff70f, #CCCCCC, #FFFFFF). Une adresse fausse est souvent la premiere page
 * qu'un visiteur voit : l'y laisser sans navigation revient a perdre la
 * visite.
 *
 * ELLE RECOIT SA LANGUE EN PROPS, et c'est tout l'interet de ce fichier. Ses
 * deux appelants ne la resolvent pas de la meme facon :
 *
 * - `app/[locale]/not-found.tsx` la tient du segment `[locale]` ;
 * - `app/global-not-found.tsx` court-circuite la mise en page — donc le
 *   segment, donc `next/root-params` — et la renegocie depuis le cookie et
 *   `Accept-Language`.
 *
 * D'ou le `I18nProvider` pose ici : la mise en page en fournit deja un dans
 * le premier cas, mais pas dans le second, et `SiteNav` est un composant
 * client qui appelle `useI18n()`. Imbriquer deux fournisseurs de meme valeur
 * est sans effet ; en oublier un fait planter l'entete.
 */
export function NotFoundView({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const t = dict.notFound;
  // Comme dans le pied de page : les ancres restent en francais, le prefixe
  // porte la langue. Sans lui, chaque lien ramenerait au site francais.
  const prefix = locale === "fr" ? "" : `/${locale}`;

  const liens = [
    { href: `${prefix}/#academie`, label: dict.nav.academy },
    { href: `${prefix}/#comment`, label: dict.nav.how },
    { href: `${prefix}/#fonctionnalites`, label: dict.nav.features },
    { href: `${prefix}/#faq`, label: dict.nav.faq },
    { href: `${prefix}/#telecharger`, label: dict.nav.download },
  ];

  return (
    <div className="site-shell flex min-h-screen flex-col overflow-x-clip font-sans">
      <I18nProvider locale={locale} dict={dict}>
        <SiteNav />
      </I18nProvider>

      {/* `flex-1` colle le pied de page en bas : le contenu d'une 404 ne
          remplit pas un ecran, et sans cela le pied remontait au milieu. */}
      <main className="relative isolate flex flex-1 items-center">
        <div aria-hidden className="site-grid pointer-events-none absolute inset-0 -z-10 opacity-60" />
        <div aria-hidden className="site-glow pointer-events-none absolute inset-0 -z-10" />

        <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="flex flex-col items-start gap-5 sm:gap-6">
              <Pill>
                <span className="size-1.5 rounded-full bg-(--site-accent)" />
                {t.pill}
              </Pill>

              {/* Le mot cercle est l'idiome de la page d'accueil : le titre du
                  hero porte le sien de la meme facon. `inline-block` garde le
                  cercle d'un seul tenant — le mot passe a la ligne entier ou
                  pas du tout, jamais coupe en deux moities cerclees. */}
              <h1 className="font-heading text-[clamp(2.25rem,10vw,3rem)] leading-[1.06] font-extrabold sm:text-5xl lg:text-6xl">
                {t.titleLine1}{" "}
                <span className="relative inline-block px-3 py-0.5 sm:px-4">
                  <span className="absolute inset-0 rounded-full border-2 border-(--site-accent)" aria-hidden />
                  <span className="relative text-(--site-accent)">{t.titleAccent}</span>
                </span>
              </h1>

              <p className="max-w-xl text-[0.9375rem] leading-relaxed text-(--site-muted) sm:text-base">
                {t.lead}
              </p>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href={prefix || "/"}
                  className="site-shimmer inline-flex items-center justify-center gap-2 rounded-full bg-(--site-accent) px-7 py-3.5 text-sm font-semibold text-(--site-ink) transition-opacity hover:opacity-90"
                >
                  {/* La fleche suit le sens de lecture : en arabe elle pointe
                      vers la droite, sinon elle designerait l'avant. */}
                  <ArrowLeftIcon className="size-4 rtl:-scale-x-100" aria-hidden />
                  {t.ctaPrimary}
                </Link>
                <Link
                  href={`${prefix}/contact`}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-black/25 px-7 py-3.5 text-sm font-semibold transition-colors hover:border-(--site-accent) hover:text-(--site-accent)"
                >
                  {t.ctaSecondary}
                  <ArrowUpRightIcon className="size-4 rtl:-scale-x-100" aria-hidden />
                </Link>
              </div>
            </div>

            {/* Le nombre est decoratif : le sens est porte par la pastille et
                le titre, et le laisser lisible ferait annoncer « 4 0 4 »
                glyphe par glyphe. Le zero est cercle comme un ballon, dans
                l'accent de la charte. */}
            <p
              aria-hidden
              className="font-heading order-first flex select-none justify-center gap-1 text-[clamp(6rem,26vw,13rem)] leading-none font-extrabold tracking-tight text-transparent lg:order-none lg:justify-end"
              style={{ WebkitTextStroke: "2px var(--site-line-strong)" }}
            >
              <span>4</span>
              <span style={{ WebkitTextStroke: "2px var(--site-accent)" }}>0</span>
              <span>4</span>
            </p>
          </div>

          <div className="mt-12 border-t border-(--site-line) pt-6 sm:mt-16">
            <p className="font-heading text-sm font-bold tracking-wide text-(--site-muted) uppercase">
              {t.linksHeading}
            </p>
            <nav className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              {liens.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm font-semibold text-(--site-fg) transition-colors hover:text-(--site-accent)"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </main>

      <SiteFooter locale={locale} dict={dict} />
    </div>
  );
}
