import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { Check, Phone, Pill, SectionHeading } from "@/components/site/pieces";
import { SiteNav } from "@/components/site/site-nav";
import { HeroVideo } from "@/components/site/hero-video";
import { HighlightsCarousel } from "@/components/site/highlights-carousel";
import { APP_SCREENS } from "@/lib/app-screens";

/**
 * Page publique d'Ifriqiya Star.
 *
 * Jusqu'ici la racine renvoyait vers `/admin` : ce depot ne servait que le
 * back-office. Elle sert desormais le site vitrine, et l'administration reste
 * a `/admin` — inchangee, toujours derriere `requireAdmin()`.
 *
 * TOUT CE QUI EST ECRIT ICI VIENT DE LA CHARTE GRAPHIQUE (Wii Studio, aout
 * 2026) : les services, la mission, la vision, les cinq valeurs et le slogan
 * sont repris mot pour mot de la planche « Marque ». Les captures sont de
 * vraies captures de l'application mobile. **Aucun chiffre d'audience,
 * aucun temoignage** : inventer « 10 000 joueurs inscrits » ou une citation
 * signee d'un nom sur une page publique, c'est fabriquer une preuve. Les
 * trois indicateurs du bandeau disent ce que la plateforme *fait*, pas
 * combien de gens l'utilisent.
 *
 * La palette est celle de la charte et rien d'autre — #000000, #aff70f,
 * #CCCCCC, #FFFFFF — portee par le bloc `.site-shell` de `globals.css`.
 */
export const metadata: Metadata = {
  title: { absolute: "Ifriqiya Star — Parce qu'aucun talent africain ne doit rester invisible" },
  description:
    "Academie de football d'elite : formation, detection, Scout Days et mise en relation directe avec les recruteurs, les clubs et les agents. Disponible sur iOS et Android.",
};

const ETAPES = [
  {
    numero: "01",
    titre: "Cree ton profil",
    texte:
      "Inscris-toi en joueur ou en professionnel, renseigne ton poste, ton niveau et ton parcours. Ton profil est verifie par l'academie avant d'etre visible.",
  },
  {
    numero: "02",
    titre: "Fais parler le terrain",
    texte:
      "Ajoute tes videos et tes photos de match. Les recruteurs, les clubs et les agents les consultent directement depuis ton profil.",
  },
  {
    numero: "03",
    titre: "Passe une detection",
    texte:
      "Inscris-toi aux Scout Days organises par les clubs et les academies. Les criteres d'eligibilite te disent tout de suite si le profil correspond.",
  },
  {
    numero: "04",
    titre: "Sois remarque",
    texte:
      "Recois ton evaluation apres la journee de detection, echange en direct avec les recruteurs, et suis ta progression saison apres saison.",
  },
];

const FONCTIONS = [
  {
    screen: APP_SCREENS["fil-actualite"],
    titre: "Le fil de la communaute",
    texte:
      "Les publications des joueurs, des clubs, des academies et des agents. Un fil modere, ou l'on suit qui l'on veut.",
  },
  {
    screen: APP_SCREENS.eligibilite,
    titre: "Les journees de detection",
    texte:
      "Date, lieu, places restantes, tarif et criteres d'eligibilite. L'inscription se fait en un geste depuis l'application.",
  },
  {
    screen: APP_SCREENS.messages,
    titre: "La mise en relation",
    texte:
      "Une messagerie directe entre joueurs et professionnels, avec blocage et signalement pour que l'echange reste sain.",
  },
];

const VALEURS = [
  { titre: "Excellence", texte: "Exiger le meilleur de soi-meme, a chaque entrainement et sur chaque ballon." },
  { titre: "Discipline", texte: "Rigueur, respect du jeu, des coequipiers et des regles, pour construire des athletes complets." },
  { titre: "Depassement", texte: "Encourager chaque jeune a repousser ses limites physiques et mentales." },
  { titre: "Ascension", texte: "Guider les talents etape par etape vers le succes professionnel et l'epanouissement personnel." },
  { titre: "Esprit d'equipe", texte: "Placer la solidarite, l'entraide et l'unite au coeur de toutes nos victoires." },
];

const FAQ = [
  {
    q: "A qui s'adresse Ifriqiya Star ?",
    r: "Aux jeunes joueuses et joueurs qui veulent etre vus, et aux professionnels du football — recruteurs, clubs, academies, agents — qui cherchent des talents. Les deux profils s'inscrivent depuis la meme application, avec des parcours distincts.",
  },
  {
    q: "L'inscription est-elle payante ?",
    r: "La creation d'un profil joueur est gratuite. Certaines journees de detection ont un tarif d'inscription, indique sur la fiche de l'evenement. Les professionnels disposent de formules d'abonnement selon l'etendue de la recherche de joueurs.",
  },
  {
    q: "Comment mon profil est-il verifie ?",
    r: "Chaque profil est examine par l'administration de l'academie : identite, piece justificative et, pour les mineurs, consentement du representant legal. Tant que la verification n'est pas faite, le profil n'apparait pas dans les recherches des recruteurs.",
  },
  {
    q: "Je suis mineur, puis-je m'inscrire ?",
    r: "Oui, avec l'accord d'un representant legal. Son identite et son consentement sont demandes pendant l'inscription et verifies avant la validation du compte.",
  },
  {
    q: "Qui peut me contacter ?",
    r: "Seuls les comptes professionnels valides peuvent engager une conversation. Vous pouvez a tout moment bloquer un interlocuteur ou signaler un echange : la moderation instruit chaque signalement.",
  },
  {
    q: "Sur quels telephones l'application fonctionne-t-elle ?",
    r: "Sur iOS et sur Android. Le compte est le meme d'un appareil a l'autre : vos videos, vos photos et vos inscriptions vous suivent.",
  },
];

export default function LandingPage() {
  // `overflow-x-clip` et non `overflow-x-hidden` : `hidden` ferait de ce div un
  // conteneur de defilement, ce qui neutralise le `position: sticky` de la
  // colonne de la FAQ. `clip` coupe le debordement sans cet effet de bord.
  return (
    <div className="site-shell overflow-x-clip font-sans">
      <SiteNav />

      <main>
        <Hero />
        <HighlightsCarousel />
        <Piliers />
        <CommentCaMarche />
        <Pourquoi />
        <Fonctionnalites />
        <Valeurs />
        <Faq />
        <AppelFinal />
      </main>

      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section id="academie" className="relative isolate scroll-mt-16 overflow-hidden bg-black">
      <HeroVideo />

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl items-center px-5 pt-14 pb-28 sm:px-8 sm:pt-20 sm:pb-28 lg:min-h-[max(720px,calc(100svh-4rem))] lg:pt-24 lg:pb-32">
        <div className="flex w-full max-w-4xl flex-col items-start gap-6">
          <Pill>
            <span className="size-1.5 rounded-full bg-(--site-accent)" />
            Academie de football d&apos;elite · Detection · Progression
          </Pill>

          <h1 className="font-heading text-[clamp(1rem,6.2vw,2.25rem)] leading-[1.08] font-extrabold drop-shadow-sm sm:text-5xl lg:text-7xl">
            <span className="block whitespace-nowrap">Aucun talent africain</span>
            <span className="block whitespace-nowrap">
              ne doit rester{" "}
              {/* Le mot cercle de la maquette : ici il porte la promesse
                  entiere, donc il merite l'accent. */}
              <span className="relative inline-block px-4 py-0.5">
                <span className="absolute inset-0 rounded-full border-2 border-(--site-accent)" aria-hidden />
                <span className="relative text-(--site-accent)">invisible</span>
              </span>
            </span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-(--site-muted)">
            Ifriqiya Star est une academie de football d&apos;elite dediee a la formation, au
            developpement technique et a l&apos;epanouissement des jeunes talents. Profil verifie,
            videos de match, journees de detection et contact direct avec les recruteurs — tout
            depuis votre telephone.
          </p>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href="#telecharger"
              className="rounded-full bg-(--site-accent) px-7 py-3.5 text-center text-sm font-semibold text-(--site-ink) transition-opacity hover:opacity-90"
            >
              Rejoindre l&apos;academie
            </a>
            <a
              href="#comment"
              className="rounded-full border border-white/30 bg-black/25 px-7 py-3.5 text-center text-sm font-semibold backdrop-blur-sm transition-colors hover:border-(--site-accent) hover:text-(--site-accent)"
            >
              Comment ca marche
            </a>
          </div>

          {/* Trois piliers, pas trois chiffres d'audience : ce sont les
              fondamentaux nommes par la charte, et ils sont verifiables. */}
          {/* Trois colonnes de 100 px sur un ecran de 360 px coupaient les
              libelles en trois lignes : on empile tant que la place manque. */}
          <dl className="mt-4 grid w-full max-w-lg gap-4 border-t border-(--site-line) pt-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-(--site-line)">
            {[
              ["Detection", "Scout Days encadres"],
              ["Progression", "Evaluation apres chaque journee"],
              ["Excellence", "Profils verifies un par un"],
            ].map(([titre, texte]) => (
              <div key={titre} className="sm:px-4 sm:first:pl-0 sm:last:pr-0">
                <dt className="font-heading text-lg font-extrabold sm:text-xl">{titre}</dt>
                <dd className="mt-1 text-xs leading-snug text-(--site-muted)">{texte}</dd>
              </div>
            ))}
          </dl>
        </div>

      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- piliers */

function Piliers() {
  const mots = [
    "Formation et academie",
    "Preparation physique et tactique",
    "Detection et orientation pro",
    "Tournois et evenements sportifs",
  ];

  return (
    <section className="border-y border-(--site-line) py-6">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="text-center text-xs tracking-[0.18em] text-(--site-muted) uppercase">
          Nos services
        </p>
      </div>
      {/* Bande defilante : la liste tient sur une ligne sur grand ecran et
          defile sur mobile, plutot que de se casser en quatre lignes. */}
      <div className="mt-4 overflow-hidden">
        <div className="site-marquee flex w-max items-center gap-8 pr-8 sm:gap-10 sm:pr-10">
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

/* ---------------------------------------------------------- comment ca marche */

function CommentCaMarche() {
  return (
    <section id="comment" className="scroll-mt-20 relative overflow-hidden py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          pill="Le parcours"
          title="Comment ca marche"
          lead="Quatre etapes, de l'inscription a la detection. Le meme chemin pour tous, et un profil verifie avant d'etre montre a qui que ce soit."
        />

        <div className="mt-16 grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-14">
          {/* Les deux colonnes de texte passent **devant** : le disque est un
              decor, il ne doit jamais pouvoir recouvrir une etape. */}
          <div className="relative z-10 flex flex-col gap-12">
            {ETAPES.slice(0, 2).map((etape) => (
              <Etape key={etape.numero} {...etape} />
            ))}
          </div>

          {/* Le disque vert vit **dans** cette colonne, et la colonne lui fait
              de la place avec son propre padding : il debordait de 53 px de
              chaque cote sur les colonnes de texte, et comme `isolate` place
              tout ce bloc au-dessus du precedent, il recouvrait les etapes 01
              et 02. La largeur du disque reste desormais inferieure a celle de
              la colonne (262 px de maquette + 2 x 48 px). */}
          <div className="relative isolate mx-auto flex w-full justify-center px-2 sm:px-12">
            <div
              className="absolute top-1/2 left-1/2 z-0 aspect-square w-68 -translate-x-1/2 sm:w-76 -translate-y-1/2 rounded-full bg-(--site-accent)"
              aria-hidden
            />
            {/* L'ecran de recherche des recruteurs : c'est la que menent les
                quatre etapes — apparaitre dans leurs resultats. Il tient le
                centre parce qu'il montre l'aboutissement, pas une etape. */}
            <Phone
              screen={APP_SCREENS["recherche-joueurs"]}
              alt="Recherche de joueurs par un recruteur dans l'application Ifriqiya Star"
              width={262}
              className="relative z-10"
            />
          </div>

          <div className="relative z-10 flex flex-col gap-12">
            {ETAPES.slice(2).map((etape) => (
              <Etape key={etape.numero} {...etape} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Etape({ numero, titre, texte }: { numero: string; titre: string; texte: string }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-heading flex size-12 items-center justify-center rounded-full bg-(--site-accent) text-sm font-extrabold text-(--site-ink)">
        {numero}
      </span>
      <h3 className="font-heading text-xl font-extrabold">{titre}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-(--site-muted)">{texte}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- pourquoi */

function Pourquoi() {
  return (
    <section className="relative overflow-hidden border-t border-(--site-line) py-16 sm:py-24 lg:py-28">
      <div className="site-glow absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-6">
          <h2 className="font-heading text-[1.75rem] leading-[1.12] font-extrabold text-balance sm:text-4xl">
            Pourquoi Ifriqiya Star
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-(--site-muted) sm:text-base">
            Notre mission est de faire d&apos;Ifriqiya Star un pole de reference dans la formation
            sportive en Afrique. Nous offrons aux jeunes athletes{" "}
            <strong className="font-semibold text-(--site-fg)">
              un cadre rigoureux et inspirant
            </strong>{" "}
            ou la passion du ballon rond et la quete d&apos;excellence se rejoignent pour reveler
            les etoiles de demain.
          </p>

          <ul className="mt-2 grid gap-4 sm:grid-cols-2">
            <Check>Profil verifie par l&apos;academie</Check>
            <Check>Videos et photos de match</Check>
            <Check>Journees de detection encadrees</Check>
            <Check>Criteres d&apos;eligibilite transparents</Check>
            <Check>Contact direct avec les recruteurs</Check>
            <Check>Moderation et signalement</Check>
          </ul>
        </div>

        {/* Deux appareils inclines et **imbriques**, comme la reference. Le
            `py-10` est la parce que la rotation elargit la boite : sans lui,
            les coins hauts se faisaient couper par l'`overflow-hidden` de la
            section. */}
        <div className="relative flex items-center justify-center py-10">
          <Phone
            screen={APP_SCREENS.videos}
            alt="Videotheque du joueur dans l'application Ifriqiya Star"
            width={236}
            className="relative z-10 -rotate-7 sm:translate-x-6"
          />
          {/* Sur telephone, les deux maquettes cote a cote font 458 px : elles
              debordaient de l'ecran. La seconde n'apparait qu'a partir de
              `sm`, ou la place existe. */}
          <Phone
            screen={APP_SCREENS.photos}
            alt="Galerie photo du joueur dans l'application Ifriqiya Star"
            width={222}
            className="relative z-0 mt-14 hidden -translate-x-6 rotate-7 sm:block"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- fonctionnalites */

function Fonctionnalites() {
  return (
    <section id="fonctionnalites" className="scroll-mt-20 relative overflow-hidden py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          pill="L'application"
          title="Tout se passe sur ton telephone."
          lead="Publier, chercher, s'inscrire, echanger. Les captures ci-dessous sont celles de l'application, sans retouche."
        />

        <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {FONCTIONS.map((fonction) => (
            <div key={fonction.titre} className="flex flex-col items-center gap-6 text-center">
              <Phone
                screen={fonction.screen}
                alt={`${fonction.titre} — application Ifriqiya Star`}
                width={244}
              />
              <div className="space-y-2">
                <h3 className="font-heading text-xl font-extrabold">{fonction.titre}</h3>
                <p className="mx-auto max-w-xs text-sm leading-relaxed text-(--site-muted)">
                  {fonction.texte}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- valeurs */

function Valeurs() {
  return (
    <section
      id="valeurs"
      className="scroll-mt-20 relative overflow-hidden border-y border-(--site-line) py-16 sm:py-24 lg:py-28"
    >
      <div className="site-glow-center absolute inset-0 opacity-70" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          pill="Notre vision"
          title="Un continent ou le football fait grandir."
          lead="Nous revons d'un continent ou le football est un puissant levier d'ascension sociale, d'education et de rayonnement international. Ifriqiya Star n'est pas seulement une academie : c'est un incubateur de talents."
        />

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VALEURS.map((valeur) => (
            <li
              key={valeur.titre}
              className="rounded-2xl border border-(--site-line) bg-(--site-card) p-6 transition-colors hover:border-(--site-accent)/50"
            >
              <h3 className="font-heading text-lg font-extrabold text-(--site-accent)">
                {valeur.titre}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-(--site-muted)">
                {valeur.texte}
              </p>
            </li>
          ))}
          <li className="flex flex-col justify-center rounded-2xl border border-(--site-accent) bg-(--site-accent) p-6 text-(--site-ink)">
            <p className="font-heading text-lg leading-tight font-extrabold text-balance">
              « Parce qu&apos;aucun talent africain ne doit rester invisible. »
            </p>
            <p className="mt-2 text-xs font-medium opacity-70">Notre signature</p>
          </li>
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- faq */

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-16 sm:py-24 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        {/* Colonne sans maquette : le titre reste colle en haut pendant qu'on
            deroule l'accordeon, sinon il laisse un vide de la hauteur des six
            questions. */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-24">
          <h2 className="font-heading text-[1.75rem] leading-[1.12] font-extrabold text-balance sm:text-4xl">
            Questions frequentes
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-(--site-muted)">
            L&apos;essentiel sur l&apos;inscription, la verification des profils et les journees de
            detection. Une question qui n&apos;est pas la ? Ecrivez-nous.
          </p>
          <a
            href="mailto:contact@ifriqiyastar.com"
            className="w-fit text-sm font-semibold text-(--site-accent) hover:underline"
          >
            contact@ifriqiyastar.com
          </a>
        </div>

        {/* `<details>` natif : l'accordeon fonctionne sans JavaScript, reste
            navigable au clavier et annonce son etat aux lecteurs d'ecran. */}
        <div className="flex flex-col gap-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
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
              <p className="mt-3 text-sm leading-relaxed text-(--site-muted)">{item.r}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- appel final */

function AppelFinal() {
  return (
    <section id="telecharger" className="scroll-mt-20 px-5 pb-16 sm:px-8 sm:pb-24 lg:pb-28">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-(--site-accent) text-(--site-ink) sm:rounded-[2rem]">
        <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:p-12">
          <div className="flex flex-col gap-6">
            <h2 className="font-heading text-[1.75rem] leading-[1.1] font-extrabold text-balance sm:text-4xl">
              Commence ton parcours
              <br />
              avec Ifriqiya Star.
            </h2>
            <p className="max-w-md text-sm leading-relaxed opacity-80">
              Cree ton profil, ajoute tes videos et inscris-toi a ta premiere journee de detection.
              L&apos;application est gratuite pour les joueurs.
            </p>

            <ul className="grid gap-3 text-sm font-medium sm:grid-cols-2">
              {[
                "Inscription en quelques minutes",
                "Profil verifie par l'academie",
                "Scout Days pres de chez toi",
                "Contact direct avec les pros",
              ].map((item) => (
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
              <StoreButton store="l'App Store" prefix="Telecharger sur" icon={<AppleMark />} />
              <StoreButton store="Google Play" prefix="Disponible sur" icon={<PlayMark />} />
            </div>
          </div>

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
          <div className="relative flex items-end justify-center gap-3 sm:gap-5 lg:justify-end">
            <figure className="hidden shrink-0 flex-col items-center gap-3 sm:flex">
              <Phone
                screen={APP_SCREENS.connexion}
                alt="Ecran de connexion de l'application Ifriqiya Star : « Ravi de vous revoir »"
                width={230}
                className="-rotate-2"
              />
              <figcaption className="rounded-full bg-(--site-ink) px-3.5 py-1.5 text-[0.6875rem] font-semibold text-(--site-accent)">
                Se connecter
              </figcaption>
            </figure>

            <figure className="flex shrink-0 flex-col items-center gap-3">
              <Phone
                screen={APP_SCREENS.inscription}
                alt="Ecran de creation de compte de l'application Ifriqiya Star : « Rejoignez Ifriqiya Star »"
                width={252}
                className="rotate-2"
              />
              <figcaption className="rounded-full bg-(--site-ink) px-3.5 py-1.5 text-[0.6875rem] font-semibold text-(--site-accent)">
                Creer un compte
              </figcaption>
            </figure>
          </div>
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
}: {
  store: string;
  prefix: string;
  icon: React.ReactNode;
}) {
  return (
    <span
      aria-disabled
      title="Disponible au lancement de l'application"
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

/* ------------------------------------------------------------------- pied */

/** Le logo, en vectoriel — voir `components/site/site-nav.tsx` pour le detail. */
function Logo({ size = 32 }: { size?: number }) {
  return (
    <Image src="/brand/ifriqiya-star.svg" alt="Ifriqiya Star" width={size} height={size} />
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-(--site-line) py-14">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-heading text-base font-extrabold">Ifriqiya Star</span>
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-(--site-muted)">
            L&apos;excellence footballistique au service de la jeunesse et de la performance.
          </p>
        </div>

        <FooterColumn
          titre="L'academie"
          liens={[
            { href: "#academie", label: "Qui sommes-nous" },
            { href: "#comment", label: "Comment ca marche" },
            { href: "#fonctionnalites", label: "L'application" },
            { href: "#valeurs", label: "Nos valeurs" },
          ]}
        />

        <FooterColumn
          titre="Ressources"
          liens={[
            { href: "#faq", label: "Questions frequentes" },
            { href: "#telecharger", label: "Telecharger l'app" },
            { href: "/admin", label: "Espace administration" },
          ]}
        />

        <div className="flex flex-col gap-3">
          <p className="font-heading text-sm font-bold tracking-wide uppercase">Nous ecrire</p>
          <p className="text-sm leading-relaxed text-(--site-muted)">
            Une question sur l&apos;academie, une detection ou un partenariat ? Notre equipe repond.
          </p>
          <a
            href="mailto:contact@ifriqiyastar.com"
            className="w-fit text-sm font-semibold text-(--site-accent) hover:underline"
          >
            contact@ifriqiyastar.com
          </a>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-2 border-t border-(--site-line) px-5 pt-6 text-xs text-(--site-muted) sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} Ifriqiya Star. Tous droits reserves.</p>
        <p>Detection · Progression · Excellence</p>
      </div>
    </footer>
  );
}

function FooterColumn({
  titre,
  liens,
}: {
  titre: string;
  liens: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-heading text-sm font-bold tracking-wide uppercase">{titre}</p>
      <ul className="flex flex-col gap-2">
        {liens.map((lien) => (
          <li key={lien.href}>
            <a
              href={lien.href}
              className="text-sm text-(--site-muted) transition-colors hover:text-(--site-accent)"
            >
              {lien.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
