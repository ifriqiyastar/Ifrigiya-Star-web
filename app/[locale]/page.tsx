import Image from "next/image";
import type { CSSProperties } from "react";
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
import { appScreens, type AppScreen } from "@/lib/app-screens";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { LOCALES, localePath, ogImagePath, type Locale } from "@/lib/i18n/config";

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
 * dictionnaires (`messages/*.json`) et l'ordre des deux listes doit rester le
 * meme — mais l'image **se traduit aussi** desormais, d'ou une fonction de la
 * langue plutot qu'une constante de module.
 *
 * La deuxieme est la fiche d'un Scout Day : elle porte la date, le lieu, les
 * places restantes, le tarif et les criteres d'eligibilite, c'est-a-dire
 * exactement ce qu'annonce la legende. Elle remplace un cadrage serre sur les
 * seuls criteres, qui n'existait qu'en francais.
 */
function featureScreens(locale: Locale): readonly AppScreen[] {
  const screens = appScreens(locale);
  return [screens["fil-actualite"], screens["scout-day-detail"], screens.messages];
}

/** Pictogrammes des trois legendes, meme ordre que `featureScreens()`. */
const FEATURE_ICONS = [IconFeed, IconCalendar, IconMessage] as const;

export default async function LandingPage() {
  const locale = await getLocale();
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
        <style>{".site-reveal{opacity:1;transform:none}.site-showcase-panel{opacity:1;translate:none}.site-gauge-arc{stroke-dashoffset:var(--gauge-to)}"}</style>
      </noscript>

      <SiteNav />

      <main>
        <Hero dict={dict} />
        <Piliers />
        {/* Les Scout Days juste sous le titre, puis leurs videos : demande du
            client (oct. 2026), sur le modele du concurrent qui place son
            evenement de detection en premiere section. Ils n'etaient jusque-la
            qu'un element de liste parmi d'autres dans chaque section. */}
        <ScoutDays dict={dict} />
        <ScoutDaysVideosSection />
        <HighlightsCarousel />
        <StepsTimeMachine />
        <Pourquoi dict={dict} />
        <Fonctionnalites dict={dict} locale={locale} />
        <NotreVision dict={dict} />
        <TestimonialsSection />
        <AppelFinal dict={dict} locale={locale} />
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

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-12 px-5 pt-10 pb-16 sm:px-8 sm:pt-20 sm:pb-28 lg:min-h-[max(720px,calc(100svh-4rem))] lg:pt-24 lg:pb-32">
        <div className="flex w-full max-w-4xl flex-col items-start gap-7 sm:gap-6">
          {/* Ce que fait la plateforme, avant le slogan : le scouting, comme
              le premier mot du concurrent (demande du client, oct. 2026). Le
              titre reste le slogan de la charte, mot pour mot. */}
          <Reveal className="-mb-2 sm:mb-0">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-(--site-accent)/50 bg-black/50 px-4 py-1.5 text-xs font-semibold tracking-wide text-(--site-fg) backdrop-blur-sm sm:text-sm">
              <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-(--site-accent)" />
              {/* Version courte sous `sm` : la phrase entiere passait sur
                  deux lignes a 375 px, et une pastille coupee en deux se lit
                  comme une erreur. */}
              <span className="sm:hidden">{t.kickerShort}</span>
              <span className="hidden sm:inline">{t.kicker}</span>
            </span>
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
              `clamp` monte donc a 28-36 px — quatre lignes sur un telephone,
              et les deux appels a l'action toujours visibles sans defiler. Sa
              borne haute (2.25 rem) rejoint exactement le `sm:text-4xl` qui
              prend le relais a 640 px, pour qu'aucune marche ne se voie au
              passage du palier.

              Sur grand ecran il plafonne a `text-5xl` (48 px) : a `text-6xl`
              les deux lignes insecables occupaient presque toute la largeur et
              venaient serrer la fiche de scouting a sa droite (demande du
              client, oct. 2026). */}
          <Reveal as="h1" delay={80} className="font-heading text-[clamp(1.75rem,8.75vw,2.25rem)] leading-[1.25] font-extrabold drop-shadow-sm sm:text-4xl sm:leading-[1.08] lg:text-5xl">
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
        </div>

        <ScoutingShowcase dict={dict} />
      </div>
    </section>
  );
}

const GAUGE_R = 30;

/**
 * La vitrine du hero : notre reponse a la « Scouting Card » du concurrent, sur
 * le modele de verre depoli fourni par le client (oct. 2026). Une carte joueur
 * au centre, et autour trois panneaux flous qui laissent passer la video :
 * note globale, profil verifie, profil a six axes. (Un panneau « Progression »
 * a ete retire a la demande du client, oct. 2026.)
 *
 * ⚠️ C'est un **exemple**, et la carte le dit dans sa pastille — ne jamais la
 * retirer. Le joueur est Yassine, le joueur fictif des Temoignages (portrait
 * genere), avec **son** profil de `PRISM_PLAYERS` : le meme visage ne doit pas
 * porter deux identites ni deux radars sur la meme page. La note globale est
 * la moyenne des six, comme la colonne `overall_score`.
 *
 * Les panneaux debordent sur la carte expres : c'est le flou de
 * `backdrop-filter` par-dessus le portrait qui donne la profondeur. Leurs
 * positions sont logiques (`start`/`end`), la composition se retourne en
 * arabe. La carte est centree par `mx-auto` et non par `translate` :
 * Tailwind v4 pose ses `-translate-*` sur la propriete `translate`, celle
 * qu'utilise l'entree echelonnee de `.site-showcase-panel`.
 *
 * A partir de `xl` seulement, comme l'ancienne fiche : a 1024 px le titre
 * insecable ne laisse pas la place, et sur telephone le client a demande de
 * garder le haut de page aux boutons de store.
 */
function ScoutingShowcase({ dict }: { dict: Dictionary }) {
  const t = dict.hero.card;
  const axes = dict.scoutDays.axes;
  const joueur = PRISM_PLAYERS[0];
  const temoin = dict.testimonials.items[joueur.testimonial];
  const overall = Math.round(joueur.profile.reduce((sum, value) => sum + value, 0) / joueur.profile.length);
  const circumference = 2 * Math.PI * GAUGE_R;

  return (
    <Reveal variant="right" delay={360} className="site-showcase relative hidden h-[33rem] w-[30rem] shrink-0 xl:block">
      <figure className="size-full">
        <figcaption className="sr-only">{t.alt}</figcaption>
        <div aria-hidden className="relative size-full">
          <div className="absolute inset-x-0 top-1/2 mx-auto size-[22rem] -translate-y-1/2 rounded-full bg-(--site-accent)/10 blur-3xl" />

          {/* La carte joueur. */}
          <div className="site-showcase-panel absolute inset-x-0 top-[5.5rem] mx-auto h-[22rem] w-[14.5rem]" style={{ "--i": 0 } as CSSProperties}>
            <div className="relative size-full overflow-hidden rounded-[1.75rem] border border-white/20 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
              <Image
                src="/images/testimonial-yassine.webp"
                alt=""
                fill
                sizes="232px"
                className="object-cover"
                style={{ objectPosition: "50% 12%" }}
              />
              <div className="absolute inset-0 bg-linear-to-t from-black via-black/20 to-transparent" />
              <div className="absolute inset-x-5 bottom-5 flex flex-col items-start">
                <span className="rounded-full border border-(--site-accent)/60 bg-black/50 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-(--site-accent) backdrop-blur-md">
                  {t.example}
                </span>
                <p className="font-heading mt-2.5 text-2xl leading-none font-extrabold uppercase">{temoin.name}</p>
                {/* Le role passe a la ligne avant d'atteindre le panneau du radar, qui
                    deborde sur le coin de la carte. */}
                <p className="mt-1.5 max-w-[7.5rem] text-xs leading-snug text-(--site-fg)/75">{temoin.role}</p>
              </div>
            </div>
          </div>

          {/* Note globale. */}
          <div className="site-showcase-panel absolute end-0 top-10 w-[10rem]" style={{ "--i": 1 } as CSSProperties}>
            <div className="site-glass site-float flex flex-col items-center rounded-2xl px-4 pt-4 pb-3.5">
              <div className="relative size-[4.75rem]">
                <svg viewBox="0 0 76 76" className="size-full -rotate-90">
                  <circle cx="38" cy="38" r={GAUGE_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
                  <circle
                    cx="38"
                    cy="38"
                    r={GAUGE_R}
                    fill="none"
                    stroke="var(--site-accent)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    className="site-gauge-arc"
                    style={
                      {
                        "--gauge-from": circumference,
                        "--gauge-to": circumference * (1 - overall / 100),
                      } as CSSProperties
                    }
                  />
                </svg>
                <span className="font-heading absolute inset-0 flex items-center justify-center text-2xl font-extrabold">
                  {overall}
                </span>
              </div>
              <p className="mt-2 text-center text-[0.625rem] font-bold tracking-[0.16em] text-(--site-fg)/70 uppercase">{t.overall}</p>
              <p dir="ltr" className="text-[0.6875rem] text-(--site-muted)">/100</p>
            </div>
          </div>

          {/* Profil verifie : la validation manuelle des profils, un vrai geste
              du produit (la file `/admin/validations`), pas un chiffre invente. */}
          <div className="site-showcase-panel absolute start-0 top-[16rem]" style={{ "--i": 2 } as CSSProperties}>
            <div className="site-glass site-float flex items-center gap-3 rounded-2xl py-3 ps-3 pe-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--site-accent)/15">
                <svg viewBox="0 0 24 24" className="size-[1.125rem] fill-none stroke-(--site-accent) stroke-2">
                  <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" strokeLinejoin="round" />
                  <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="flex flex-col">
                <span className="text-xs font-semibold whitespace-nowrap">{t.verified}</span>
                <span className="text-[0.6875rem] whitespace-nowrap text-(--site-muted)">{t.verifiedNote}</span>
              </span>
            </div>
          </div>

          {/* Profil a six axes. */}
          <div className="site-showcase-panel absolute end-0 bottom-0 w-[14rem]" style={{ "--i": 3 } as CSSProperties}>
            <div className="site-glass site-float rounded-2xl px-3 pt-3.5 pb-2">
              <p className="px-1 text-[0.625rem] font-bold tracking-[0.16em] text-(--site-fg)/70 uppercase">{t.profile}</p>
              <RadarChart scores={joueur.profile} labels={axes} />
            </div>
          </div>
        </div>
      </figure>
    </Reveal>
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

/* -------------------------------------------------------------- scout days */

/**
 * La section qui explique un Scout Day, de l'organisation a l'evaluation.
 *
 * Explicative et sans dates, volontairement : les evenements a venir ne sont
 * pas lisibles par un visiteur anonyme (la base refuse `scout_days` a `anon`),
 * et les publier sur le site demande l'accord du client sur ce qui peut etre
 * montre (organisateur, tarif). Le bouton mene donc a l'application, ou ils
 * se consultent.
 *
 * Les six axes sont ceux de la migration mobile 0091 — ceux de
 * `lib/evaluation-axes.ts`, dans le meme ordre. Si l'evaluation change, cette
 * liste change avec elle.
 */
function ScoutDays({ dict }: { dict: Dictionary }) {
  const t = dict.scoutDays;
  return (
    <section
      id="scout-days"
      className="scroll-mt-20 relative overflow-hidden py-16 sm:py-24 lg:py-28"
    >
      <div className="site-glow absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="flex flex-col gap-8">
          <Reveal variant="left" className="flex flex-col items-start gap-5">
            <Pill>{t.pill}</Pill>
            <h2 className="font-heading max-w-2xl text-[1.75rem] leading-[1.1] font-extrabold text-balance sm:text-4xl lg:text-5xl">
              {t.title}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-(--site-muted) sm:text-base">
              {t.lead}
            </p>
          </Reveal>

          <ol aria-label={t.stepsAria} className="grid gap-4 sm:grid-cols-2">
            {t.steps.map((step, i) => (
              <Reveal
                key={step.number}
                as="li"
                delay={i * 90}
                className="flex flex-col gap-2 rounded-2xl border border-(--site-line) bg-(--site-card) p-5"
              >
                <span className="font-heading text-sm font-extrabold text-(--site-accent)" aria-hidden>
                  {step.number}
                </span>
                <h3 className="font-heading text-lg leading-snug font-extrabold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-(--site-muted)">{step.text}</p>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={120} className="flex flex-col items-start gap-3">
            <a
              href="#telecharger"
              className="site-shimmer inline-flex items-center justify-center gap-3 rounded-full bg-(--site-accent) px-7 py-3.5 text-sm font-semibold text-(--site-ink) transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent)"
            >
              {t.cta}
              <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2 rtl:-scale-x-100" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <p className="text-xs text-(--site-muted)">{t.ctaNote}</p>
          </Reveal>
        </div>

        {/* Le prisme de cartes joueurs, sur le modele demande par le client
            (oct. 2026) a la place des deux captures de l'application. */}
        <Reveal
          variant="right"
          delay={120}
          className="relative mx-auto w-full max-w-lg lg:me-0 lg:ms-auto"
        >
          <ScoutDaysPrism dict={dict} />
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Les personnes de l'anneau : les trois personnages fictifs de la section
 * Temoignages (`testimonials.items`, portraits generes par IA) — Yassine,
 * Karim, et Mehdi, l'entraineur (ajoute a la demande du client, oct. 2026).
 * Le nom et le role viennent de la, deja traduits, et c'est voulu : le meme
 * visage ne doit pas porter deux identites sur la meme page. Mehdi garde donc
 * son role d'entraineur sur sa carte.
 *
 * `profile` : six notes sur 100 dans l'ordre de `scoutDays.axes` (Vitesse,
 * Finition, Precision, Passe, Defense, Cognitif). **Inventees** — aucun
 * chiffre n'est affiche, seule la forme du radar — et taillees sur chacun :
 * un milieu qui distribue, un ailier qui accelere, un technicien qui lit le
 * jeu. Une seule par personne, pour qu'un meme nom ne montre jamais deux
 * radars differents.
 */
const PRISM_PLAYERS = [
  { testimonial: 0, profile: [70, 64, 82, 90, 62, 86] },
  { testimonial: 1, profile: [92, 78, 72, 70, 44, 70] },
  { testimonial: 2, profile: [56, 62, 84, 88, 70, 94] },
] as const;

/**
 * Les six cartes : une personne et une photo chacune, dans l'ordre Yassine,
 * Karim, Mehdi, deux fois. Les trois cartes visibles en meme temps (la face
 * avant et ses deux voisines) montrent donc toujours trois personnes
 * differentes, et chacune ne revient que sur la carte opposee, qui montre
 * alors son dos. Chacun a deux photos ou deux cadrages, pour que ses cartes
 * ne soient pas des copies.
 */
const PRISM_CARDS = [
  { player: 0, src: "/images/testimonial-yassine.webp", position: "50% 8%" },
  { player: 1, src: "/images/joueur-africain.jpg", position: "50% 6%" },
  { player: 2, src: "/images/testimonial-mehdi.webp", position: "50% 6%" },
  { player: 0, src: "/images/pourquoi-training-tunisian.webp", position: "50% 4%" },
  { player: 1, src: "/images/testimonial-karim.webp", position: "50% 10%" },
  { player: 2, src: "/images/testimonial-mehdi.webp", position: "50% 18%" },
] as const;

/**
 * Le radar a six branches des fiches joueurs, a la place de la note chiffree
 * (demande du client, oct. 2026, sur le modele des cartes de jeux de
 * football).
 *
 * Un hexagone pointe en haut : quatre anneaux de grille (25, 50, 75, 100),
 * six rayons, puis le profil rempli en vert avec un point a chaque sommet.
 * Les libelles sont **centres** sur leur point (`textAnchor="middle"`) : un
 * ancrage `start`/`end` s'inverserait sous le `dir="rtl"` de la page arabe et
 * enverrait les libelles lateraux sur le graphique.
 */
const RADAR = { w: 232, h: 186, cx: 116, cy: 96, r: 60, label: 80 } as const;

function radarPoint(index: number, ratio: number, radius: number = RADAR.r): string {
  const angle = ((-90 + index * 60) * Math.PI) / 180;
  const x = RADAR.cx + radius * ratio * Math.cos(angle);
  const y = RADAR.cy + radius * ratio * Math.sin(angle);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

function RadarChart({ scores, labels }: { scores: readonly number[]; labels: readonly string[] }) {
  const ring = (ratio: number) => labels.map((_, i) => radarPoint(i, ratio)).join(" ");
  const profile = scores.map((score, i) => radarPoint(i, score / 100)).join(" ");

  return (
    <svg viewBox={`0 0 ${RADAR.w} ${RADAR.h}`} className="h-auto w-full">
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <polygon
          key={ratio}
          points={ring(ratio)}
          fill={ratio === 1 ? "rgba(255,255,255,0.03)" : "none"}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1"
        />
      ))}
      {labels.map((_, i) => {
        const [x, y] = radarPoint(i, 1).split(",");
        return <line key={i} x1={RADAR.cx} y1={RADAR.cy} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />;
      })}

      <polygon
        points={profile}
        fill="var(--site-accent)"
        fillOpacity="0.32"
        stroke="var(--site-accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {scores.map((score, i) => {
        const [x, y] = radarPoint(i, score / 100).split(",");
        return <circle key={i} cx={x} cy={y} r="3.4" fill="#000000" stroke="var(--site-accent)" strokeWidth="1.6" />;
      })}

      {labels.map((label, i) => {
        const [x, y] = radarPoint(i, 1, RADAR.label).split(",");
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.82)"
            fontSize="11"
            fontWeight="600"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * L'anneau de cartes joueurs, d'apres la video Mojo Fantasy du client : six
 * cartes espacees autour d'un axe vertical, penche vers l'avant pour qu'on
 * voie le dos des cartes passees derriere. Il tourne en continu (14 s le
 * tour) et se met en pause au survol.
 *
 * Chaque carte porte le nom et le role du joueur, puis le radar de son profil
 * (`PRISM_PLAYERS`), sans aucun chiffre : la forme illustre l'evaluation,
 * elle ne pretend pas etre un resultat. Le nom en tete remplace la pastille
 * « Exemple » (choix du client, oct. 2026), comme sur les cartes de la
 * maquette.
 *
 * Tout est en CSS (`.site-prism*` dans `globals.css`). Le decor est
 * `aria-hidden` : un lecteur d'ecran recoit une phrase qui dit ce que les
 * cartes montrent, plutot que six cartes qui defilent.
 */
function ScoutDaysPrism({ dict }: { dict: Dictionary }) {
  const axes = dict.scoutDays.axes;
  const testimonials = dict.testimonials.items;
  const description = `${dict.hero.card.title} — ${axes.join(", ")}`;

  return (
    <figure className="site-prism-stage relative h-[25rem] sm:h-[36rem]">
      <figcaption className="sr-only">{description}</figcaption>
      <div aria-hidden className="site-glow-center absolute inset-x-0 bottom-0 h-1/2 opacity-80" />
      <div aria-hidden className="site-prism-scale absolute inset-0">
        <div className="site-prism">
          {PRISM_CARDS.map((carte, i) => {
            const joueur = PRISM_PLAYERS[carte.player];
            const temoin = testimonials[joueur.testimonial];
            return (
            <div
              key={i}
              className="site-prism-face"
              style={{ "--k": i } as CSSProperties}
            >
              {/* Le dos : ce qu'on voit d'une carte passee derriere, dans le
                  jour entre deux cartes de face. Le logo porte sa propre
                  plaque noire arrondie (cf. `BrandMark`) : rien a ajouter
                  autour. Le nom de marque ne se traduit pas. */}
              <div className="site-prism-back flex flex-col items-center justify-center gap-3">
                <Image src="/brand/ifriqiya-star.svg" alt="" width={84} height={84} />
                <span className="font-heading text-sm font-extrabold tracking-wide text-(--site-fg)/85">
                  Ifriqiya Soccer Star
                </span>
              </div>

              {/* La face : le radar en haut, le portrait en bas, comme les
                  cartes de la maquette, cernee d'un liseré fin et sans halo. */}
              <div className="site-prism-card flex flex-col overflow-hidden bg-linear-to-b from-[#121212] via-[#080808] to-black">
                <div className="relative z-10 flex flex-col items-center px-3 pt-4 text-center">
                  <p className="font-heading text-xl leading-tight font-extrabold">{temoin.name}</p>
                  <p className="mt-0.5 text-[0.6875rem] font-medium text-(--site-muted)">{temoin.role}</p>
                  <RadarChart scores={joueur.profile} labels={axes} />
                </div>

                {/* Le portrait prend toute la hauteur laissee sous le radar
                    (`flex-1`, pas une part fixe) : c'est lui qui profite de
                    la carte allongee (demande du client, oct. 2026). Seul un
                    fondu court, en haut, le raccorde au fond de la carte. */}
                <div className="relative mt-1 min-h-0 flex-1">
                  <Image
                    src={carte.src}
                    alt=""
                    fill
                    sizes="232px"
                    className="object-cover [mask-image:linear-gradient(to_bottom,transparent,black_18%)]"
                    style={{ objectPosition: carte.position }}
                  />
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </figure>
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

function Fonctionnalites({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const t = dict.features;
  const screens = featureScreens(locale);
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
            screen={screens[0]}
            alt={`${t.items[0].title} — Ifriqiya Soccer Star`}
            width={190}
            className="site-lift absolute start-0 top-12 -rotate-[8deg] shadow-2xl sm:start-[2%]"
          />
          <Phone
            screen={screens[2]}
            alt={`${t.items[2].title} — Ifriqiya Soccer Star`}
            width={190}
            className="site-lift absolute end-0 top-12 rotate-[8deg] shadow-2xl sm:end-[2%]"
          />
          <Phone
            screen={screens[1]}
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

function AppelFinal({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const t = dict.cta;
  const screens = appScreens(locale);
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
                screen={screens.connexion}
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
                screen={screens.inscription}
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
