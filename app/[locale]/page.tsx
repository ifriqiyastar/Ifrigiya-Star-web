import Image from "next/image";
import type { Metadata } from "next";

import { Check, Phone, Pill, SectionHeading } from "@/components/site/pieces";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { ContactSection } from "@/components/site/contact-section";
import { TestimonialsSection } from "@/components/site/testimonials-section";
import { ScoutDaysVideosSection } from "@/components/site/scout-days-videos-section";
import { StepsTimeMachine } from "@/components/site/steps-time-machine";
import { HeroVideo } from "@/components/site/hero-video";
import { HighlightsCarousel } from "@/components/site/highlights-carousel";
import { Reveal } from "@/components/site/reveal";
import { APP_SCREENS } from "@/lib/app-screens";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { LOCALES, localePath } from "@/lib/i18n/config";

/**
 * Page publique d'Ifriqiya Star.
 *
 * Jusqu'ici la racine renvoyait vers `/admin` : ce depot ne servait que le
 * back-office. Elle sert desormais le site vitrine, et l'administration reste
 * a `/admin` — inchangee, toujours derriere `requireAdmin()`.
 *
 * Les contenus de marque viennent de la charte graphique (Wii Studio, aout
 * 2026) : les services, la mission, la vision, les cinq valeurs et le slogan
 * sont repris mot pour mot de la planche « Marque ». Les captures sont de
 * vraies captures de l'application mobile. Aucun chiffre d'audience n'est
 * invente. La section Temoignages contient des exemples explicitement
 * fictifs et des portraits generes par IA, pas des avis de membres reels.
 * Les trois indicateurs du bandeau disent ce que la plateforme fait,
 * pas combien de gens l'utilisent.
 *
 * La palette est celle de la charte et rien d'autre — #000000, #aff70f,
 * #CCCCCC, #FFFFFF — portee par le bloc `.site-shell` de `globals.css`.
 */
/**
 * Titre, description et `hreflang` suivent la langue. Les trois `alternates`
 * sont ce qui dit aux moteurs que `/`, `/en` et `/ar` sont la meme page en
 * trois langues plutot que trois pages concurrentes — c'est la raison d'etre
 * du prefixe d'URL, et sans ces balises il ne sert a rien.
 */
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: { absolute: `Ifriqiya Star — ${dict.hero.titleLine1} ${dict.hero.titleLine2} ${dict.hero.titleAccent}` },
    description: dict.hero.lead,
    alternates: {
      canonical: localePath(await getLocale(), "/"),
      languages: Object.fromEntries(LOCALES.map((l) => [l, localePath(l, "/")])),
    },
  };
}

/**
 * Les captures associees aux trois fonctionnalites. Le texte vit dans les
 * dictionnaires (`messages/*.json`), l'image reste ici : elle ne se traduit
 * pas, et l'ordre des deux listes doit rester le meme.
 */
const FEATURE_SCREENS = [
  APP_SCREENS["fil-actualite"],
  APP_SCREENS.eligibilite,
  APP_SCREENS.messages,
] as const;

export default async function LandingPage() {
  const dict = await getDictionary();

  // `overflow-x-clip` et non `overflow-x-hidden` : `hidden` ferait de ce div un
  // conteneur de defilement, ce qui neutralise le `position: sticky` de la
  // colonne de la FAQ. `clip` coupe le debordement sans cet effet de bord.
  return (
    <div className="site-shell overflow-x-clip font-sans">
      {/* Les blocs `.site-reveal` arrivent caches et c'est un script qui les
          revele au defilement. Sans JavaScript personne ne les observerait :
          on les reaffiche donc tous, plutot que de servir une page vide. */}
      <noscript>
        <style>{".site-reveal{opacity:1;transform:none}"}</style>
      </noscript>

      <SiteNav />

      <main>
        <Hero dict={dict} />
        <Piliers dict={dict} />
        <HighlightsCarousel />
        <StepsTimeMachine />
        <Pourquoi dict={dict} />
        <ScoutDaysVideosSection />
        <Fonctionnalites dict={dict} />
        <Valeurs dict={dict} />
        <TestimonialsSection />
        <Faq dict={dict} />
        <AppelFinal dict={dict} />
        <ContactSection />
      </main>

      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero({ dict }: { dict: Dictionary }) {
  const t = dict.hero;
  return (
    <section id="academie" className="relative isolate scroll-mt-16 overflow-hidden bg-black">
      <HeroVideo />

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl items-center px-5 pt-10 pb-16 sm:px-8 sm:pt-20 sm:pb-28 lg:min-h-[max(720px,calc(100svh-4rem))] lg:pt-24 lg:pb-32">
        <div className="flex w-full max-w-4xl flex-col items-start gap-5 sm:gap-6">
          <Reveal>
            <Pill>
              <span className="size-1.5 rounded-full bg-(--site-accent)" />
              {t.pill}
            </Pill>
          </Reveal>

          {/* Le titre tenait sur deux lignes insecables a toutes les tailles,
              et c'est ce qui le cassait sur telephone : pour que « ne doit
              rester (invisible) » tienne sur 360 px sans se couper, la borne
              haute du `clamp` devait descendre a 22 px — soit six pixels de
              plus que le paragraphe juste en dessous. Le titre n'etait plus
              un titre. Il se coupe donc librement en dessous de `sm`, ou la
              place manque, et ne redevient insecable qu'a partir de la ou les
              deux lignes de la maquette rentrent vraiment.

              Une fois le retour a la ligne autorise, la taille ne sert plus a
              faire tenir le texte : elle sert a lui donner sa presence. Le
              `clamp` monte donc a 36-48 px — quatre lignes sur un telephone,
              et les deux appels a l'action toujours visibles sans defiler. Sa
              borne haute (3 rem) rejoint exactement le `sm:text-5xl` qui prend
              le relais a 640 px, pour qu'aucune marche ne se voie au passage
              du palier. */}
          <Reveal as="h1" delay={80} className="font-heading text-[clamp(2.25rem,11.5vw,3rem)] leading-[1.04] font-extrabold drop-shadow-sm sm:text-5xl sm:leading-[1.08] lg:text-7xl">
            <span className="block sm:whitespace-nowrap">{t.titleLine1}</span>
            <span className="block sm:whitespace-nowrap">
              {t.titleLine2}{" "}
              {/* Le mot cercle de la maquette : ici il porte la promesse
                  entiere, donc il merite l'accent. `inline-block` garde le
                  cercle d'un seul tenant : le mot passe a la ligne entier ou
                  pas du tout, jamais coupe en deux moities cerclees. */}
              <span className="relative inline-block px-3 py-0.5 sm:px-4">
                <span className="absolute inset-0 rounded-full border-2 border-(--site-accent)" aria-hidden />
                <span className="relative text-(--site-accent)">{t.titleAccent}</span>
              </span>
            </span>
          </Reveal>

          <Reveal as="p" delay={160} className="max-w-xl text-[0.9375rem] leading-relaxed text-(--site-muted) sm:text-base">
            {t.lead}
          </Reveal>

          <Reveal delay={240} className="w-full sm:w-auto">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href="#telecharger"
              className="site-shimmer rounded-full bg-(--site-accent) px-7 py-3.5 text-center text-sm font-semibold text-(--site-ink) transition-opacity hover:opacity-90"
            >
              {t.ctaPrimary}
            </a>
            <a
              href="#comment"
              className="rounded-full border border-white/30 bg-black/25 px-7 py-3.5 text-center text-sm font-semibold backdrop-blur-sm transition-colors hover:border-(--site-accent) hover:text-(--site-accent)"
            >
              {t.ctaSecondary}
            </a>
          </div>
          </Reveal>

          {/* Trois piliers, pas trois chiffres d'audience : ce sont les
              fondamentaux nommes par la charte, et ils sont verifiables. */}
          {/* Trois colonnes de 100 px sur un ecran de 360 px coupaient les
              libelles en trois lignes : on empile tant que la place manque. */}
          <Reveal as="dl" delay={320} className="mt-4 grid w-full max-w-lg gap-4 border-t border-(--site-line) pt-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-(--site-line)">
            {[t.pillars.detection, t.pillars.progression, t.pillars.excellence].map(
              ({ title: titre, text: texte }) => (
                <div key={titre} className="sm:px-4 sm:first:ps-0 sm:last:pe-0">
                  <dt className="font-heading text-lg font-extrabold sm:text-xl">{titre}</dt>
                  <dd className="mt-1 text-xs leading-snug text-(--site-muted)">{texte}</dd>
                </div>
              ),
            )}
          </Reveal>
        </div>

      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- piliers */

function Piliers({ dict }: { dict: Dictionary }) {
  const mots = dict.services.items;

  return (
    <section className="border-y border-(--site-line) py-6">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="text-center text-xs tracking-[0.18em] text-(--site-muted) uppercase">
          {dict.services.label}
        </p>
      </div>
      {/* Bande defilante : la liste tient sur une ligne sur grand ecran et
          defile sur mobile, plutot que de se casser en quatre lignes. */}
      <div className="mt-4 overflow-hidden">
        <div className="site-marquee flex w-max items-center gap-8 pe-8 sm:gap-10 sm:pe-10">
          {[...mots, ...mots].map((mot, index) => (
            <span
              key={`${mot}-${index}`}
              className="font-heading flex items-center gap-8 text-base font-bold whitespace-nowrap text-(--site-fg)/85 sm:gap-10 sm:text-xl"
            >
              {mot}
              <span className="size-1.5 rounded-full bg-(--site-accent)" aria-hidden />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- pourquoi */

function Pourquoi({ dict }: { dict: Dictionary }) {
  const t = dict.why;
  return (
    <section className="relative overflow-hidden border-t border-(--site-line) py-16 sm:py-24 lg:py-28">
      <div className="site-glow absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
        <Reveal variant="left" className="flex flex-col gap-6">
          <h2 className="font-heading text-[1.75rem] leading-[1.12] font-extrabold text-balance sm:text-4xl">
            {t.title}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-(--site-muted) sm:text-base">
            {t.leadBefore}{" "}
            <strong className="font-semibold text-(--site-fg)">{t.leadStrong}</strong>{" "}
            {t.leadAfter}
          </p>

          <ul className="mt-2 grid gap-4 sm:grid-cols-2">
            {t.checks.map((item) => (
              <Check key={item}>{item}</Check>
            ))}
          </ul>

          <a
            href="#telecharger"
            className="site-shimmer mt-2 inline-flex items-center justify-center gap-3 self-start rounded-full bg-(--site-accent) px-7 py-3.5 text-sm font-semibold text-(--site-ink) transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent)"
          >
            {t.cta}
            <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2 rtl:-scale-x-100" aria-hidden="true">
              <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </Reveal>

        <Reveal
          variant="right"
          delay={120}
          className="relative mx-auto aspect-4/5 w-full max-w-lg overflow-hidden rounded-3xl border border-(--site-line) lg:me-0 lg:ms-auto"
        >
          <Image
            src="/images/pourquoi-training-tunisian.webp"
            alt={t.imageAlt}
            fill
            sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 512px, (max-width: 1143px) calc((100vw - 120px) / 2), 512px"
            className="site-parallax object-cover"
          />
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- fonctionnalites */

function Fonctionnalites({ dict }: { dict: Dictionary }) {
  const t = dict.features;
  return (
    <section id="fonctionnalites" className="scroll-mt-20 relative overflow-hidden py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          pill={t.pill}
          title={t.title}
          lead={t.lead}
        />

        <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {t.items.map((fonction, i) => (
            <Reveal
              key={fonction.title}
              delay={(i % 3) * 110}
              className="flex flex-col items-center gap-6 text-center"
            >
              <Phone
                screen={FEATURE_SCREENS[i]}
                alt={`${fonction.title} — Ifriqiya Star`}
                width={244}
              />
              <div className="space-y-2">
                <h3 className="font-heading text-xl font-extrabold">{fonction.title}</h3>
                <p className="mx-auto max-w-xs text-sm leading-relaxed text-(--site-muted)">
                  {fonction.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- valeurs */

function Valeurs({ dict }: { dict: Dictionary }) {
  const t = dict.values;
  return (
    <section
      id="valeurs"
      className="scroll-mt-20 relative overflow-hidden border-y border-(--site-line) py-16 sm:py-24 lg:py-28"
    >
      <div className="site-glow-center absolute inset-0 opacity-70" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          pill={t.pill}
          title={t.title}
          lead={t.lead}
        />

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.items.map((valeur, i) => (
            <Reveal
              key={valeur.title}
              as="li"
              delay={(i % 3) * 110}
              className="site-lift rounded-2xl border border-(--site-line) bg-(--site-card) p-6 hover:border-(--site-accent)/50"
            >
              <h3 className="font-heading text-lg font-extrabold text-(--site-accent)">
                {valeur.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-(--site-muted)">
                {valeur.text}
              </p>
            </Reveal>
          ))}
          <Reveal
            as="li"
            delay={220}
            className="flex flex-col justify-center rounded-2xl border border-(--site-accent) bg-(--site-accent) p-6 text-(--site-ink)"
          >
            <p className="font-heading text-lg leading-tight font-extrabold text-balance">
              {t.signature}
            </p>
            <p className="mt-2 text-xs font-medium opacity-70">{t.signatureLabel}</p>
          </Reveal>
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- faq */

function Faq({ dict }: { dict: Dictionary }) {
  const t = dict.faq;
  return (
    <section id="faq" className="scroll-mt-20 py-16 sm:py-24 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        {/* Colonne sans maquette : le titre reste colle en haut pendant qu'on
            deroule l'accordeon, sinon il laisse un vide de la hauteur des six
            questions. */}
        <Reveal variant="left" className="flex flex-col gap-5 lg:sticky lg:top-24">
          <h2 className="font-heading text-[1.75rem] leading-[1.12] font-extrabold text-balance sm:text-4xl">
            {t.title}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-(--site-muted)">
            {t.lead}
          </p>
          <a
            href="mailto:contact@ifriqiyastar.com"
            className="w-fit text-sm font-semibold text-(--site-accent) hover:underline"
          >
            contact@ifriqiyastar.com
          </a>
        </Reveal>

        {/* `<details>` natif : l'accordeon fonctionne sans JavaScript, reste
            navigable au clavier et annonce son etat aux lecteurs d'ecran. */}
        <div className="flex flex-col gap-3">
          {t.items.map((item, i) => (
            <Reveal key={item.q} delay={Math.min(i, 4) * 80}>
            <details
              className="group rounded-2xl border border-(--site-line) bg-(--site-card) px-5 py-4 open:border-(--site-accent)/40 sm:px-6 sm:py-5"
            >
              <summary className="flex cursor-pointer list-none items-center gap-4 text-sm font-semibold sm:text-base [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{item.q}</span>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-(--site-line-strong) text-(--site-accent) transition-transform group-open:rotate-45">
                  <svg viewBox="0 0 16 16" className="size-3.5 stroke-current stroke-2">
                    <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-(--site-muted)">{item.a}</p>
            </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- appel final */

function AppelFinal({ dict }: { dict: Dictionary }) {
  const t = dict.cta;
  return (
    <section id="telecharger" className="scroll-mt-20 px-5 pb-16 sm:px-8 sm:pb-24 lg:pb-28">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-(--site-accent) text-(--site-ink) sm:rounded-[2rem]">
        <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:p-12">
          <Reveal variant="left" className="flex flex-col gap-6">
            <h2 className="font-heading text-[1.75rem] leading-[1.1] font-extrabold text-balance sm:text-4xl">
              {t.titleLine1}
              <br />
              {t.titleLine2}
            </h2>
            <p className="max-w-md text-sm leading-relaxed opacity-80">
              {t.lead}
            </p>

            <ul className="grid gap-3 text-sm font-medium sm:grid-cols-2">
              {t.points.map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--site-ink)">
                    <svg viewBox="0 0 20 20" className="size-3 fill-none stroke-(--site-accent) stroke-3">
                      <path d="M4 10.5 8 14.5 16 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            {/* Deux boutons de ~190 px cote a cote debordaient d'un ecran de
                360 px une fois retire le padding de la carte : ils s'empilent
                en pleine largeur tant que la place manque. */}
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <StoreButton
                store={t.appleStore}
                prefix={t.applePrefix}
                soon={t.storeSoon}
                icon={<AppleMark />}
              />
              <StoreButton
                store={t.googleStore}
                prefix={t.googlePrefix}
                soon={t.storeSoon}
                icon={<PlayMark />}
              />
            </div>
          </Reveal>

          {/* Les deux portes d'entree de l'application : creer un compte, et
              revenir.

              L'ecran de connexion etait illisible pour trois raisons cumulees
              — trop petit (206 px), incline de 5 degres, et recouvert sur
              56 px par la maquette de devant. Il est desormais plus grand, a
              peine incline, et le chevauchement est reduit de moitie : on
              distingue « Ravi de vous revoir », les deux champs et le bouton.

              Chaque maquette porte son intitule : cet ecran-la est
              volontairement sobre — un titre, deux champs, un bouton — et sans
              legende, une vignette sombre ne dit pas ce qu'elle montre. */}
          <Reveal
            variant="right"
            delay={120}
            className="relative flex items-end justify-center gap-3 sm:gap-5 lg:justify-end"
          >
            <figure className="hidden shrink-0 flex-col items-center gap-3 sm:flex">
              <Phone
                screen={APP_SCREENS.connexion}
                alt={t.signInAlt}
                width={230}
                className="-rotate-2"
              />
              <figcaption className="rounded-full bg-(--site-ink) px-3.5 py-1.5 text-[0.6875rem] font-semibold text-(--site-accent)">
                {t.signInCaption}
              </figcaption>
            </figure>

            <figure className="flex shrink-0 flex-col items-center gap-3">
              <Phone
                screen={APP_SCREENS.inscription}
                alt={t.signUpAlt}
                width={252}
                className="rotate-2"
              />
              <figcaption className="rounded-full bg-(--site-ink) px-3.5 py-1.5 text-[0.6875rem] font-semibold text-(--site-accent)">
                {t.signUpCaption}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/**
 * Marque Apple. Un seul trace, en `currentColor` : le bouton est noir, le
 * logo blanc, et il suivra la couleur du texte si le bouton change.
 */
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden focusable="false">
      <path d="M17.564 12.928c-.026-2.66 2.17-3.938 2.27-4.002-1.236-1.81-3.16-2.058-3.844-2.086-1.637-.166-3.196.964-4.026.964-.83 0-2.11-.94-3.472-.914-1.786.026-3.432 1.038-4.35 2.638-1.854 3.216-.474 7.976 1.33 10.584.88 1.276 1.93 2.71 3.308 2.658 1.328-.054 1.83-.86 3.436-.86 1.606 0 2.058.86 3.462.832 1.43-.026 2.334-1.3 3.208-2.582 1.012-1.48 1.428-2.914 1.454-2.988-.032-.014-2.79-1.07-2.816-4.244zM15.03 4.62c.732-.888 1.226-2.124 1.09-3.354-1.054.042-2.332.702-3.088 1.588-.678.786-1.272 2.044-1.112 3.25 1.176.09 2.378-.598 3.11-1.484z" />
    </svg>
  );
}

/**
 * Marque Google Play : quatre facettes, quatre couleurs. Elle garde ses
 * couleurs propres — c'est ainsi qu'elle est reconnaissable, et la charte
 * d'Ifriqiya Star ne s'applique pas a la marque d'un tiers.
 */
function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden focusable="false">
      <path fill="#00D2FF" d="M3.06 1.34A1.5 1.5 0 0 0 2.62 2.4v19.2c0 .4.16.78.44 1.06l.07.06L13.8 12.1v-.2L3.13 1.28l-.07.06z" />
      <path fill="#FFC900" d="M17.36 15.7 13.8 12.1v-.2l3.56-3.6.08.05 4.22 2.4c1.2.68 1.2 1.8 0 2.5l-4.22 2.4-.08.05z" />
      <path fill="#FF3B44" d="m17.44 15.65-3.64-3.65L3.06 22.66c.4.42 1.05.47 1.78.06l12.6-7.07z" />
      <path fill="#00E676" d="M17.44 8.35 4.84 1.28C4.11.87 3.46.92 3.06 1.34L13.8 12l3.64-3.65z" />
    </svg>
  );
}

/**
 * Les deux boutons de store. Ils ne pointent nulle part tant que les fiches
 * ne sont pas publiees : un lien mort vaut mieux qu'un lien qui promet un
 * telechargement inexistant, donc ce sont des boutons desactives et ils le
 * disent.
 *
 * ⚠️ Les marques Apple et Google Play sont ici **redessinees**. Avant la mise
 * en ligne, Apple et Google exigent l'un et l'autre leurs **fichiers de badge
 * officiels** (« Telecharger dans l'App Store », « Disponible sur Google
 * Play »), telechargeables depuis leurs pages de ressources marketing, avec
 * leurs regles de taille et de zone de protection. C'est un remplacement de
 * fichier, pas une refonte.
 */
function StoreButton({
  store,
  prefix,
  icon,
  soon,
}: {
  store: string;
  prefix: string;
  icon: React.ReactNode;
  /** Infobulle « pas encore publie » — traduite, comme le reste du bouton. */
  soon: string;
}) {
  return (
    <span
      aria-disabled
      title={soon}
      className="inline-flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl bg-(--site-ink) px-5 py-3.5 text-(--site-fg) sm:w-auto sm:justify-start"
    >
      {icon}
      <span className="text-left leading-tight">
        {/* Deux corrections de lisibilite successives sur ces deux lignes.
            D'abord la couleur : `opacity-90` sur le bouton et `opacity-70`
            ici se multipliaient en 63 % de blanc, sur des capitales de 10 px.
            Puis la coupure : elle tombait **apres l'apostrophe**
            (« Telecharger sur l' » / « App Store »), et une ligne qui se
            termine par une apostrophe orpheline ne se lit pas. Le determinant
            reste desormais colle a ce qu'il determine. */}
        <span className="block text-xs whitespace-nowrap text-(--site-muted)">{prefix}</span>
        <span className="font-heading block text-base leading-tight font-extrabold whitespace-nowrap text-white">
          {store}
        </span>
      </span>
    </span>
  );
}
