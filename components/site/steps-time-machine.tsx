"use client";

import Image from "next/image";
import { Fragment, useCallback, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { SectionHeading } from "@/components/site/pieces";
import { APP_SCREENS } from "@/lib/app-screens";
import { useI18n } from "@/lib/i18n/client";

/**
 * La capture montree a chaque etape. **Une seule pour l'instant, la meme pour
 * les quatre** : le client fournira une capture par etape, et il n'y aura qu'a
 * remplir ce tableau. Son ordre suit celui de `steps.items` dans les
 * dictionnaires, exactement comme `FEATURE_SCREENS` dans la page — et comme
 * lui, les deux listes doivent garder le meme ordre.
 *
 * Quand les quatre captures arriveront, chacune montrera un ecran different :
 * il faudra alors une description par etape dans les dictionnaires, la ou
 * `steps.phoneAlt` en decrit une seule aujourd'hui.
 */
const STEP_SCREENS = [
  APP_SCREENS["recherche-joueurs"],
  APP_SCREENS["recherche-joueurs"],
  APP_SCREENS["recherche-joueurs"],
  APP_SCREENS["recherche-joueurs"],
] as const;

/** Combien de traits fins separent deux etapes sur la reglette. */
const SUB_TICKS = 2;

/**
 * « Comment ca marche », en pile de cartes a perspective.
 *
 * La forme vient du « Time Machine Stack » d'Amicro
 * (https://amicro.vercel.app/cards/card-time-machine-mono) : les etapes sont
 * empilees en profondeur, celle du moment devant, les suivantes decalees
 * derriere elle, et une reglette de traits sur le cote fait defiler la pile.
 * L'etape franchie ne disparait pas sur place — elle passe *au-dessus de la
 * camera*, vers l'avant et vers le bas, comme une carte qu'on retire du
 * dessus du paquet.
 *
 * Trois choses ont ete decidees ici plutot que reprises :
 *
 * 1. **C'est du CSS.** L'original est ecrit avec Framer Motion ; le site
 *    vitrine n'embarque aucun moteur d'animation (cf. le bloc « animations »
 *    de `globals.css`). Les ressorts sont rendus par des courbes de Bezier.
 * 2. **C'est un `tablist`.** La demo d'Amicro n'est qu'une vitrine : ses
 *    traits reagissent au survol et a rien d'autre. Ici ils commandent le
 *    contenu lu a cote, donc ils sont des onglets — nommes, atteignables au
 *    clavier, relies a leur panneau. Sans quoi la moitie des visiteurs ne
 *    verraient jamais que l'etape 01.
 * 3. **Le survol ne suffit pas.** Un telephone n'a pas de curseur : les
 *    fleches precedent/suivant sont la commande principale sur mobile, la
 *    reglette y reste un reperage.
 *
 * **Rien n'avance tout seul, et c'est delibere.** Une premiere version faisait
 * tourner les etapes toutes les 5,2 s, sur le modele du carrousel
 * (`highlights-carousel.tsx`). Mesure sur un telephone de 360 x 780 : la
 * section fait 1180 px de haut, le texte se trouve 500 px sous la pile, et un
 * lecteur pose sur le paragraphe voyait celui-ci se reecrire deux fois en
 * douze secondes — sans avoir rien touche, et sans voir ce qui l'avait
 * provoque. Le carrousel peut tourner : ce sont des images, on les regarde.
 * Ici ce sont quatre paragraphes qu'il faut lire, dans une langue qui n'est
 * pas la premiere d'une partie du public, et 5,2 s ne couvrent pas trente
 * mots. La pile bouge donc quand on la fait bouger, jamais autrement.
 */
export function StepsTimeMachine() {
  const { dict } = useI18n();
  const t = dict.steps;
  const steps = t.items;
  const count = steps.length;

  const [active, setActive] = useState(0);
  // Le survol change d'etape sans rejouer l'entree du texte, un clic la
  // rejoue : voir `goTo`.
  const [revealed, setRevealed] = useState(true);
  const activeRef = useRef(0);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * `reveal` decide si le texte se reecrit mot a mot ou s'il se remplace d'un
   * coup.
   *
   * Le balayage a la souris le met a `false`, et ce n'est pas un detail : la
   * reglette s'active au survol, donc un curseur qui la traverse pour aller
   * ailleurs enchaine quatre changements d'etape. Avec l'animation a chaque
   * fois, cela fait quatre paragraphes qui se reconstruisent en une seconde.
   * L'exploration merite une substitution immediate ; seul un geste qui
   * *choisit* une etape — clic, clavier, fleches — merite qu'on la lui
   * presente.
   */
  const goTo = useCallback((index: number, reveal = true) => {
    const next = (index + count) % count;
    activeRef.current = next;
    setActive(next);
    setRevealed(reveal);
  }, [count]);

  /**
   * Navigation au clavier de la reglette. Les onglets s'activent au deplacement
   * (« automatic activation ») : la pile suit la fleche, il n'y a rien a
   * valider. Le `focus()` suit la selection, sinon la touche suivante
   * repartirait de l'ancien onglet.
   */
  function onTabKeyDown(event: React.KeyboardEvent) {
    const moves: Record<string, number | "first" | "last"> = {
      ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, Home: "first", End: "last",
    };
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const next = move === "first" ? 0 : move === "last" ? count - 1 : activeRef.current + move;
    const index = (next + count) % count;
    goTo(index);
    tabsRef.current[index]?.focus();
  }

  const step = steps[active];

  return (
    <section
      id="comment"
      className="scroll-mt-20 relative overflow-hidden py-12 sm:py-24 lg:py-28"
    >
      {/* Pas de `.site-glow` ici : la section suivante en porte un, au meme
          coin, et deux halos identiques a la suite se lisent comme une tache.
          La pile a le sien, calibre pour elle. */}
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading pill={t.pill} title={t.title} lead={t.lead} />

        {/* ORDRE. Le DOM place la reglette avant le panneau qu'elle commande,
            ce que la lecture assistee attend ; `order` met le texte devant
            **a toutes les tailles**, et c'est un correctif, pas une
            preference. En pile verticale, la capture arrivait la premiere :
            un telephone montrait 452 px d'ecran de recherche avant d'avoir dit
            de quelle etape il s'agissait, et il fallait faire defiler pour
            l'apprendre. L'image illustre le propos, elle ne le precede pas.

            La grille est ramenee a 72 rem : sur la pleine largeur de la
            section, le texte restait colle a gauche et la pile a droite, avec
            un vide au milieu que rien ne remplissait.

            `items-start` plutot que `items-center` : le bloc de texte fait
            200 px contre 616 px pour la pile, et centre, il flottait. Aligne,
            son sommet et celui de la carte de devant tracent la meme ligne —
            d'ou le `pt` identique de part et d'autre. */}
        <div className="mt-16 flex flex-col items-center gap-8 lg:mx-auto lg:mt-20 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-14">
          {/* Le `pt` reserve la hauteur des tranches qui depassent au-dessus
              de la carte de devant. Elles sont dessinees *hors* du cadre qui
              donne sa hauteur a la pile, donc la mise en page ne les compte
              pas : sans cette reserve, elles montaient dans le chapeau de la
              section et le recouvraient. En dessous de `sm`, la pile est plus
              petite (`clamp` du `Stack`) donc le debord aussi : la reserve
              d'origine y laissait un vide qui allongeait la section pour rien. */}
          <div className="order-2 flex items-center justify-center gap-2 pt-10 sm:gap-3 sm:pt-16">
            <Stack
              steps={steps}
              active={active}
              alt={t.phoneAlt}
              onAdvance={() => goTo(active + 1)}
              next={t.next}
            />
            <Scrubber
              steps={steps}
              active={active}
              label={t.navAria}
              goToLabel={t.goTo}
              onSelect={goTo}
              onKeyDown={onTabKeyDown}
              register={(index, node) => { tabsRef.current[index] = node; }}
            />
          </div>

          {/* `lg:self-stretch` + `lg:justify-center` : le texte fait a peine
              200 px contre 616 px pour la pile, et laissait tout ce vide en
              dessous des fleches. Plutot que de re-ouvrir l'alignement des
              sommets (voir le commentaire plus haut sur `items-start`), ce
              bloc s'etire seul sur la hauteur de sa cellule et centre son
              propre contenu dedans — la pile garde son alignement d'origine. */}
          <div className="order-1 w-full max-w-xl lg:flex lg:h-full lg:flex-col lg:justify-center lg:self-stretch">
            <div
              // La cle force le remontage a chaque changement d'etape : c'est
              // ce qui rejoue les animations d'entree, une animation CSS ne
              // repartant pas toute seule sur un noeud deja monte. Quand
              // `revealed` est faux, le remontage a quand meme lieu mais la
              // classe d'animation n'est pas posee : le texte se substitue.
              key={active}
              id={`etape-panneau-${active}`}
              role="tabpanel"
              aria-labelledby={`etape-onglet-${active}`}
              tabIndex={-1}
              className="flex flex-col items-start gap-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`font-heading flex size-12 shrink-0 items-center justify-center rounded-full bg-(--site-accent) text-sm font-extrabold text-(--site-ink) ${revealed ? "site-step-in" : ""}`}
                  style={{ "--step-delay": "0" } as React.CSSProperties}
                >
                  {step.number}
                </span>

                <h3 className="font-heading text-2xl leading-tight font-extrabold text-balance sm:text-3xl">
                  <Words text={step.title} from={90} revealed={revealed} />
                </h3>
              </div>

              <p
                className={`text-sm leading-relaxed text-(--site-muted) sm:text-base ${revealed ? "site-step-in" : ""}`}
                style={{ "--step-delay": String(90 + step.title.split(" ").length * 55 + 60) } as React.CSSProperties}
              >
                {step.text}
              </p>
            </div>

            {/* Le compteur « 01 / 04 » a saute : entre la pastille verte qui
                porte deja le numero et la reglette qui montre la position,
                c'etait le troisieme reperage pour une seule information. */}
            <div className="mt-3 flex items-center justify-end gap-3">
              <Arrow label={t.prev} onClick={() => goTo(active - 1)}>
                <ChevronLeftIcon className="size-4 rtl:-scale-x-100" aria-hidden />
              </Arrow>
              <Arrow label={t.next} onClick={() => goTo(active + 1)}>
                <ChevronRightIcon className="size-4 rtl:-scale-x-100" aria-hidden />
              </Arrow>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- la pile */

type Step = { number: string; title: string; text: string };

/**
 * La pile en profondeur. Une seule `perspective`, portee par le cadre : les
 * cartes ne sont que des `translate3d` projetes dedans, ce qui evite un
 * contexte 3D par carte.
 *
 * Le cadre est cliquable et avance d'une etape. Ce n'est pas un doublon des
 * fleches : sur une pile de cartes, le geste evident est de taper la carte du
 * dessus, et il n'y a rien d'autre a faire dans ce cadre qui puisse entrer en
 * conflit avec lui.
 *
 * LARGEUR : 62 vw sur telephone, 19 rem au-dela. La borne basse (12 rem) tient
 * compte de la reglette, qui prend 64 px a cote de la pile sur un ecran de
 * 320 px.
 *
 * ⚠️ A cette taille, les captures sont **agrandies**. Elles font 426 px de
 * large a la source (cf. l'avertissement en tete de `lib/app-screens.ts`), donc
 * au-dela d'environ 215 px CSS un ecran haute densite reclame plus de pixels
 * qu'il n'en existe et le navigateur interpole. La seule correction est de
 * recapturer a la resolution de l'appareil — aucun reglage cote web ne
 * rattrape des pixels absents.
 */
function Stack({
  steps, active, alt, onAdvance, next,
}: {
  steps: readonly Step[];
  active: number;
  alt: string;
  onAdvance: () => void;
  next: string;
}) {
  return (
    <button
      type="button"
      onClick={onAdvance}
      aria-label={next}
      className="relative w-[clamp(12rem,62vw,19rem)] shrink-0 cursor-pointer rounded-[1.75rem] focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-(--site-accent)"
      style={{ perspective: "1100px" }}
    >
      {/* Le cadre donne sa hauteur a la pile : les cartes en sont detachees. */}
      <span className="block aspect-[426/863] w-full" />

      {/* Un halo derriere la pile. Les captures sont des telephones noirs sur
          un fond noir : sans cette lueur, les tranches qui depassent derriere
          la carte de devant n'auraient rien contre quoi se detacher. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-x-8 -top-8 bottom-0 -z-10 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--site-accent)_22%,transparent),transparent)] blur-2xl"
      />

      {steps.map((step, index) => {
        const offset = index - active;
        const gone = index < active;
        return (
          <span
            key={step.number}
            aria-hidden
            // `pointer-events-none`, ET C'EST CE QUI FAIT MARCHER LA REGLETTE.
            // Une carte franchie part vers la camera : `translateZ(280px)` sous
            // une perspective de 1100 px l'agrandit d'un tiers, et `scale(1.12)`
            // acheve de porter sa largeur projetee a une fois et demie celle de
            // la pile — environ 76 px de debord de chaque cote, vers le bas.
            // Elle est a `opacity: 0`, mais une chose transparente reste
            // cliquable : elle recouvrait donc la moitie basse de la reglette,
            // et avalait le survol comme le clic des etapes 02 a 04 des qu'une
            // etape avait ete franchie. Le survol etait bien cable, il
            // n'arrivait jamais jusqu'au bouton.
            //
            // Les cartes sont decoratives (`aria-hidden`) et c'est le cadre qui
            // porte le clic : les neutraliser au pointeur ne retire aucun geste.
            className="site-step-card pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem] border border-white/12 bg-(--site-card) shadow-[0_34px_90px_-30px_rgba(0,0,0,0.95)]"
            style={{
              zIndex: steps.length - index,
              // Franchie, la carte passe devant la camera et vers le bas ;
              // a venir, elle recule et remonte d'un cran.
              // Le retrait en profondeur retrecit la carte, donc rapproche son
              // bord haut du centre : le decalage vertical doit depasser ce
              // retrecissement, sinon la carte suivante se cache exactement
              // derriere la precedente et la pile n'a plus d'epaisseur.
              transform: gone
                ? "translate3d(0, 30%, 280px) rotateX(-24deg) scale(1.12)"
                : `translate3d(0, ${(-offset * 9).toFixed(2)}%, ${-offset * 58}px) rotateX(${(offset * 1.6).toFixed(2)}deg)`,
              opacity: gone ? 0 : Math.max(0.35, 1 - Math.abs(offset) * 0.2),
            }}
          >
            <Image
              src={STEP_SCREENS[index].src}
              alt=""
              width={STEP_SCREENS[index].width}
              height={STEP_SCREENS[index].height}
              sizes="(min-width: 1024px) 304px, 62vw"
              priority={index === 0}
              unoptimized
              className="size-full object-cover object-top"
            />
            {/* Les cartes du dessous sont assombries, pour que celle du dessus
                se detache sans avoir a les flouter. */}
            <span
              className="absolute inset-0 bg-black transition-opacity duration-500"
              style={{ opacity: Math.min(0.6, Math.abs(offset) * 0.22) }}
            />
          </span>
        );
      })}

      {/* La seule description utile est celle de la carte visible : les trois
          autres montrent la meme chose, annoncees quatre fois elles ne
          diraient rien de plus. */}
      <span className="sr-only">{alt}</span>
    </button>
  );
}

/* ----------------------------------------------------------- la reglette */

function Scrubber({
  steps, active, label, goToLabel, onSelect, onKeyDown, register,
}: {
  steps: readonly Step[];
  active: number;
  label: string;
  goToLabel: string;
  /** `reveal` a faux pour un simple survol : voir `goTo`. */
  onSelect: (index: number, reveal?: boolean) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  register: (index: number, node: HTMLButtonElement | null) => void;
}) {
  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex shrink-0 flex-col items-end"
    >
      {steps.map((step, index) => {
        const selected = index === active;
        return (
          // LE SURVOL EST PORTE PAR CE BLOC, pas par le bouton seul, et c'est
          // une question de geometrie. Au-dessus de `sm`, un onglet mesure
          // 11 px de haut (un trait de 3 px et ses 4 px de marge) et deux
          // traits fins de 9 px l'eloignent du suivant : les deux tiers de la
          // hauteur de la reglette etaient donc du vide, et un curseur qui la
          // parcourait tombait le plus souvent entre deux etapes. En groupant
          // chaque onglet avec les traits qui le suivent, les zones sensibles
          // se touchent et la pile suit reellement le curseur.
          //
          // `presentation` efface ce conteneur de l'arbre d'accessibilite :
          // une `tablist` n'attend que des `tab` pour enfants, et le bouton
          // garde le sien.
          <div
            key={step.number}
            role="presentation"
            className="flex flex-col items-end"
            // Le balayage a la souris explore, il ne choisit pas : pas de
            // reecriture du texte (second argument a faux). Un doigt n'entre
            // nulle part — il touche, et c'est le clic qui repond.
            onPointerEnter={(event) => { if (event.pointerType === "mouse") onSelect(index, false); }}
          >
            <button
              ref={(node) => { register(index, node); }}
              type="button"
              role="tab"
              id={`etape-onglet-${index}`}
              aria-selected={selected}
              aria-controls={`etape-panneau-${index}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(index)}
              aria-label={goToLabel.replace("{number}", step.number).replace("{title}", step.title)}
              // `min-h-11` : 44 px de cible tactile. Les 31 px d'avant
              // passaient le minimum de la norme (24 px) mais restaient sous
              // ce qu'un pouce vise sans y penser. Au-dessus de `sm`, ce sont
              // les traits fins qui donnent l'espacement, et le pointeur est
              // precis : la contrainte tombe.
              className="group/tab flex min-h-11 w-16 cursor-pointer items-center justify-end py-2 focus-visible:outline-none sm:min-h-0 sm:w-20 sm:py-1"
            >
              <span
                aria-hidden
                className={`font-mono text-[10px] tracking-[0.18em] transition-all duration-300 ${
                  selected
                    ? "me-3 text-(--site-accent) opacity-100"
                    : "me-3 translate-x-1 text-(--site-muted) opacity-0 group-hover/tab:translate-x-0 group-hover/tab:opacity-100 group-focus-visible/tab:translate-x-0 group-focus-visible/tab:opacity-100 rtl:-translate-x-1"
                }`}
              >
                {step.number}
              </span>
              <span
                aria-hidden
                className={`h-[3px] rounded-full transition-all duration-300 ${
                  selected
                    ? "w-9 bg-(--site-accent)"
                    : "w-6 bg-white/40 group-hover/tab:w-8 group-hover/tab:bg-white/80 group-focus-visible/tab:w-8 group-focus-visible/tab:bg-white/80"
                }`}
              />
            </button>

            {/* Les traits fins ne sont qu'un rythme : ni cliquables, ni
                annonces, ni atteignables au clavier. Ils font desormais partie
                de la zone de survol de l'etape au-dessus d'eux — c'est tout
                l'objet du conteneur — mais ils ne deviennent pas des cibles
                pour autant. Ils disparaissent sur telephone, ou ils ne
                feraient que retrecir les vraies. */}
            {index < steps.length - 1
              ? Array.from({ length: SUB_TICKS }, (_, tick) => (
                  <span key={tick} aria-hidden className="hidden py-[3px] sm:block">
                    <span className="block h-[3px] w-6 rounded-full bg-white/15" />
                  </span>
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- le detail */

function Arrow({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:border-white/50 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent)"
    >
      {children}
    </button>
  );
}

/**
 * Le titre de l'etape, mot par mot. Chaque mot arrive floute et decale, avec
 * un retard croissant : c'est ce qui fait lire le titre plutot que l'afficher.
 * Les espaces restent des noeuds de texte entre les `inline-block`, sinon ils
 * seraient manges par la mise en page et les mots se colleraient.
 */
function Words({ text, from, revealed }: { text: string; from: number; revealed: boolean }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span
            className={`inline-block ${revealed ? "site-step-in" : ""}`}
            style={{ "--step-delay": String(from + index * 55) } as React.CSSProperties}
          >
            {word}
          </span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}
