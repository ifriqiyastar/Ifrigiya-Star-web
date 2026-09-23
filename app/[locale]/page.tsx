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
import { StoreButtons } from "@/components/site/store-buttons";
import { QrStoreRedirect } from "@/components/site/qr-store-redirect";
import { PLACEHOLDER_PARTNER_LOGOS } from "@/components/site/partner-logos";
import { IconFeed, IconCalendar, IconMessage } from "@/components/site/feature-icons";
import { Reveal } from "@/components/site/reveal";
import { APP_SCREENS } from "@/lib/app-screens";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { LOCALES, localePath, ogImagePath } from "@/lib/i18n/config";

/**
 * Page publique d'Ifriqiya Soccer Star.
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
 *
 * `openGraph`/`twitter` sont repetes ici (et non hérités du layout racine)
 * parce que la fusion de metadonnees de Next est superficielle : des qu'un
 * segment definit son propre `openGraph`, celui du parent est **remplace**,
 * pas complete — `siteName`/`type` doivent donc revenir a chaque fois qu'on
 * fixe `title`/`description`. `images` pointe vers la carte pre-rendue de la
 * langue courante (`ogImagePath()`, voir `docs/og-image.md`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary();
  const title = `Ifriqiya Soccer Star — ${dict.hero.titleLine1} ${dict.hero.titleLine2} ${dict.hero.titleAccent}`;
  const images = [ogImagePath(locale)];
  return {
    title: { absolute: title },
    description: dict.hero.lead,
    alternates: {
      canonical: localePath(locale, "/"),
      languages: Object.fromEntries(LOCALES.map((l) => [l, localePath(l, "/")])),
    },
    openGraph: { title, description: dict.hero.lead, siteName: "Ifriqiya Soccer Star", type: "website", images },
    twitter: { card: "summary_large_image", title, description: dict.hero.lead, images },
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

/** Pictogrammes des trois legendes, meme ordre que `FEATURE_SCREENS`. */
const FEATURE_ICONS = [IconFeed, IconCalendar, IconMessage] as const;

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
        <Piliers />
        <HighlightsCarousel />
        <StepsTimeMachine />
        <Pourquoi dict={dict} />
        <ScoutDaysVideosSection />
        <Fonctionnalites dict={dict} />
        <NotreVision dict={dict} />
        <TestimonialsSection />
        <AppelFinal dict={dict} />
        <Faq dict={dict} />
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
        <div className="flex w-full max-w-4xl flex-col items-start gap-7 sm:gap-6">
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
              `clamp` monte donc a 28-36 px — quatre lignes sur un telephone,
              et les deux appels a l'action toujours visibles sans defiler. Sa
              borne haute (2.25 rem) rejoint exactement le `sm:text-4xl` qui
              prend le relais a 640 px, pour qu'aucune marche ne se voie au
              passage du palier. */}
          <Reveal as="h1" delay={80} className="font-heading text-[clamp(1.75rem,8.75vw,2.25rem)] leading-[1.25] font-extrabold drop-shadow-sm sm:text-4xl sm:leading-[1.08] lg:text-6xl">
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

          {/* Version raccourcie sur telephone, a la demande du client : le
              paragraphe complet s'arretait avant le premier appel a l'action
              sans faire defiler. `t.lead` reste entier a partir de `sm`. */}
          <Reveal as="p" delay={160} className="max-w-xl text-[0.9375rem] leading-relaxed text-(--site-muted) sm:text-base">
            <span className="sm:hidden">{t.leadMobile}</span>
            <span className="hidden sm:inline">{t.lead}</span>
          </Reveal>

          {/* Les badges de store, sous la promesse plutot qu'au seul bas de
              page : c'est le geste que le visiteur vient chercher, et sur
              telephone il n'en voit qu'un — celui de son systeme. */}
          <Reveal delay={240} className="w-full sm:w-auto">
            <StoreButtons
              appleStore={dict.cta.appleStore}
              applePrefix={dict.cta.applePrefix}
              googleStore={dict.cta.googleStore}
              googlePrefix={dict.cta.googlePrefix}
              soon={dict.cta.storeSoon}
              tone="clair"
            />
          </Reveal>

          {/* Trois piliers, pas trois chiffres d'audience : ce sont les
              fondamentaux nommes par la charte, et ils sont verifiables. Mise
              en avant comme des statistiques (grand libelle colore, legende
              en dessous) sans en inventer la donnee. */}
          {/* Absents sur telephone, a la demande du client : le bloc y
              rivalisait avec le titre et les boutons de store pour la place
              au-dessus de la ligne de flottaison. Ils reapparaissent a partir
              de `sm`, ou l'ecran a la place pour la rangee complete. */}
          <Reveal as="dl" delay={320} className="mt-4 hidden w-full max-w-xl gap-0 divide-x divide-(--site-line) border-t border-(--site-line) pt-6 sm:grid sm:grid-cols-3">
            {[t.pillars.detection, t.pillars.progression, t.pillars.excellence].map(({ title: titre, text: texte }) => (
              <div key={titre} className="px-5 first:ps-0 last:pe-0">
                <dt className="font-heading text-2xl leading-tight font-extrabold text-(--site-accent)">
                  {titre}
                </dt>
                <dd className="mt-1 text-xs leading-snug text-(--site-fg)/80">{texte}</dd>
              </div>
            ))}
          </Reveal>
        </div>

      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- piliers */

function Piliers() {
  const logos = PLACEHOLDER_PARTNER_LOGOS;

  return (
    <section className="border-y border-(--site-line) py-8">
      {/* Bande de logos defilante, sur le modele fourni par le client pour la
          presentation. Ce sont des marques generiques de demonstration — a
          remplacer par les vrais logos des partenaires des qu'ils arrivent. */}
      <div className="overflow-hidden">
        <div className="site-marquee flex w-max items-center gap-12 pe-12 sm:gap-16 sm:pe-16">
          {[...logos, ...logos].map(({ name, Icon }, index) => (
            <span
              key={`${name}-${index}`}
              className="flex shrink-0 items-center gap-2.5 text-(--site-fg)/80"
            >
              <Icon className="size-6 sm:size-7" aria-hidden />
              <span className="font-heading text-lg font-extrabold tracking-tight whitespace-nowrap italic sm:text-2xl">
                {name}
              </span>
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

        {/* Grappe en eventail plutot que trois colonnes egales : le meme
            traitement que le collage de la section Valeurs (telephones
            legerement inclines, superposes), applique ici a trois captures
            au lieu de deux. Le halo derriere reprend celui des autres
            sections, pour que la grappe ne flotte pas sur un noir uni. */}
        <Reveal className="relative mx-auto mt-10 flex h-[26rem] max-w-3xl items-center justify-center sm:mt-0 sm:h-[31rem]">
          <div aria-hidden className="site-glow-center absolute inset-0 opacity-70" />
          <Phone
            screen={FEATURE_SCREENS[0]}
            alt={`${t.items[0].title} — Ifriqiya Soccer Star`}
            width={190}
            className="site-lift absolute start-0 top-12 -rotate-[8deg] shadow-2xl sm:start-[2%]"
          />
          <Phone
            screen={FEATURE_SCREENS[2]}
            alt={`${t.items[2].title} — Ifriqiya Soccer Star`}
            width={190}
            className="site-lift absolute end-0 top-12 rotate-[8deg] shadow-2xl sm:end-[2%]"
          />
          <Phone
            screen={FEATURE_SCREENS[1]}
            alt={`${t.items[1].title} — Ifriqiya Soccer Star`}
            width={215}
            className="site-lift relative z-10 shadow-2xl"
          />
        </Reveal>

        <div className="mt-12 grid gap-10 sm:grid-cols-3 lg:mt-16">
          {t.items.map((fonction, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <Reveal
                key={fonction.title}
                delay={(i % 3) * 110}
                className="flex flex-col items-center gap-3 text-center"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border border-(--site-line-strong) bg-(--site-bg) text-(--site-accent)">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="flex flex-col items-center gap-2">
                  <h3 className="font-heading text-xl font-extrabold">{fonction.title}</h3>
                  <p className="mx-auto max-w-xs text-sm leading-relaxed text-(--site-muted)">
                    {fonction.text}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- valeurs */

function NotreVision({ dict }: { dict: Dictionary }) {
  const t = dict.values;
  return (
    <section
      id="vision"
      className="scroll-mt-20 relative overflow-hidden border-t border-(--site-line) py-16 sm:py-24 lg:py-28"
    >
      <div className="site-glow-center absolute inset-0 opacity-70" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        {/* Le texte et la signature partagent maintenant la colonne de
            gauche, et la photo (colonne de droite) s'etire sur toute leur
            hauteur cumulee (`lg:items-stretch`, defaut de la grille) au lieu
            de se limiter a la hauteur du seul bloc de texte — la signature
            se retrouvait sinon seule sous une pleine largeur, laissant un
            grand vide noir sous la photo, a droite. */}
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col gap-10 sm:gap-14">
            <Reveal variant="left" className="flex flex-col items-start gap-5">
              <Pill>{t.pill}</Pill>
              <h2 className="font-heading max-w-xl text-3xl leading-[1.1] font-extrabold text-balance sm:text-4xl">
                {t.title}
              </h2>
              <p className="max-w-lg text-base leading-relaxed text-(--site-muted) italic sm:text-lg">
                {t.lead}
              </p>
            </Reveal>

            <Reveal delay={180} className="border-s-4 border-(--site-accent) ps-6 sm:ps-8">
              <p className="font-heading max-w-2xl text-2xl leading-snug font-extrabold text-balance sm:text-3xl lg:text-4xl">
                {t.signature}
              </p>
              <p className="mt-3 text-xs font-semibold tracking-[0.18em] text-(--site-muted) uppercase">
                {t.signatureLabel}
              </p>
            </Reveal>
          </div>

          <Reveal
            variant="right"
            delay={100}
            className="relative min-h-[20rem] overflow-hidden rounded-3xl border border-(--site-line) bg-(--site-card) sm:min-h-[24rem]"
          >
            <Image
              src="/images/Noble_Scouting_70_.webp"
              alt={t.imageAlt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/70 via-black/5 to-transparent" />

            <div className="absolute inset-x-5 bottom-5 flex items-center gap-2">
              <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-(--site-accent)" />
              <p className="font-heading text-xs font-bold tracking-[0.14em] text-white uppercase">
                {t.hud.caption}
              </p>
            </div>
          </Reveal>
        </div>
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
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-(--site-line-strong) bg-(--site-bg) text-(--site-accent) transition-transform group-open:rotate-45">
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
    <section id="telecharger" className="scroll-mt-20 px-5 pt-16 pb-16 sm:px-8 sm:pt-24 sm:pb-24 lg:pt-28 lg:pb-28">
      <QrStoreRedirect />
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
            <StoreButtons
              appleStore={t.appleStore}
              applePrefix={t.applePrefix}
              googleStore={t.googleStore}
              googlePrefix={t.googlePrefix}
              soon={t.storeSoon}
            />
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
              legende, une vignette sombre ne dit pas ce qu'elle montre. La
              legende reste du texte plat (pas de fond, pas de coins
              arrondis) : en pastille pleine elle se lisait comme un vrai
              bouton — juste au-dessus du bouton « Se connecter » reellement
              cliquable dans l'ecran de connexion — et rien ici n'est
              cliquable, la carte entiere ne menant qu'au telechargement.

              Absentes sur telephone, a la demande du client : les deux
              maquettes n'y ajoutaient plus qu'une image de plus a faire
              defiler sous le texte et les boutons de store, deja suffisants
              pour l'appel a l'action. Elles reapparaissent a partir de `sm`. */}
          <Reveal
            variant="right"
            delay={120}
            className="relative hidden items-end justify-center gap-3 sm:flex sm:gap-5 lg:justify-end"
          >
            <figure className="flex shrink-0 flex-col items-center gap-3">
              <Phone
                screen={APP_SCREENS.connexion}
                alt={t.signInAlt}
                width={230}
                className="-rotate-2"
              />
              <figcaption className="text-xs font-bold tracking-wide text-(--site-ink) uppercase">
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
              <figcaption className="text-xs font-bold tracking-wide text-(--site-ink) uppercase">
                {t.signUpCaption}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
