"use client";

import { useRef, useState } from "react";

import { useI18n } from "@/lib/i18n/client";
import type { AppScreen } from "@/lib/app-screens";
import { Phone } from "@/components/site/pieces";
import { Reveal } from "@/components/site/reveal";
import { IconCalendar, IconFeed, IconMessage } from "@/components/site/feature-icons";

/** Meme ordre que `features.items` et que `featureScreens()` dans la page. */
const ICONS = [IconFeed, IconCalendar, IconMessage] as const;

/**
 * Les trois captures de « L'application » sous `md`, une par carte, chacune
 * avec SA legende dessous.
 *
 * Remplace sur telephone la grappe en eventail du desktop : dessinee pour
 * 700 px, elle gardait ses telephones de 190 / 215 / 190 px dans 350 px, si
 * bien que le central recouvrait les deux autres a ~80 % — le fil et la
 * messagerie etaient illisibles — et les trois legendes s'empilaient dessous,
 * detachees des ecrans qu'elles decrivent (mesure a 390 px, Oct 2026).
 *
 * Le defilement est natif (`scroll-snap`) : c'est le geste du telephone
 * lui-meme. Le bord de la carte suivante depasse pour dire qu'on peut
 * balayer ; les points ne font que situer.
 *
 * La piste reste en LTR meme en arabe, pour la raison exposee dans
 * `HighlightsCarousel` : `scrollLeft` devient negatif en RTL sur une partie
 * des navigateurs, et le calcul de la carte active suppose un axe croissant.
 * Le contenu de chaque carte retrouve le sens de lecture de la langue.
 */
export function FeatureSwipe({ screens }: { screens: readonly AppScreen[] }) {
  const { dict, dir } = useI18n();
  const items = dict.features.items;
  const c = dict.carousel;
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Distance de chaque carte a la premiere : c'est la position de defilement
  // qui l'amene au bord, quel que soit le padding de la piste. Le navigateur
  // borne lui-meme la derniere, qui ne peut pas atteindre le bord.
  const offsets = () => {
    const track = trackRef.current;
    if (!track) return [];
    const cards = Array.from(track.children) as HTMLElement[];
    return cards.map((card) => card.offsetLeft - cards[0].offsetLeft);
  };

  const goTo = (index: number) => {
    const track = trackRef.current;
    const left = offsets()[index];
    if (!track || left === undefined) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left, behavior: reduced ? "instant" : "smooth" });
  };

  return (
    <div className="mt-10 md:hidden">
      <Reveal>
        <div
          ref={trackRef}
          id="features-track"
          dir="ltr"
          tabIndex={0}
          aria-label={c.slidesAria}
          className="relative -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto overscroll-x-contain px-5 pt-2 pb-4 [scrollbar-width:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--site-accent) sm:-mx-8 sm:scroll-px-8 sm:px-8 [&::-webkit-scrollbar]:hidden"
          onScroll={() => {
            const track = trackRef.current;
            if (!track) return;
            // En bout de course, c'est la derniere carte : sur une tablette
            // ou les trois tiennent presque, la piste s'arrete avant de
            // l'amener au bord et la plus proche du bord serait l'avant-derniere
            // — le troisieme point ne s'allumerait jamais (mesure a 700 px).
            if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 2) {
              setActive(items.length - 1);
              return;
            }
            const distances = offsets().map((left) => Math.abs(left - track.scrollLeft));
            setActive(distances.indexOf(Math.min(...distances)));
          }}
          onKeyDown={(event) => {
            // Piste figee en LTR : la fleche suit ce que l'oeil voit bouger.
            let target: number;
            if (event.key === "ArrowRight") target = Math.min(active + 1, items.length - 1);
            else if (event.key === "ArrowLeft") target = Math.max(active - 1, 0);
            else if (event.key === "Home") target = 0;
            else if (event.key === "End") target = items.length - 1;
            else return;
            event.preventDefault();
            goTo(target);
          }}
        >
          {items.map((item, i) => {
            const Icon = ICONS[i];
            return (
              <article
                key={item.title}
                role="group"
                aria-roledescription="diapositive"
                aria-label={c.slideAria
                  .replace("{n}", String(i + 1))
                  .replace("{total}", String(items.length))
                  .replace("{tag}", item.title)}
                dir={dir}
                className="relative flex w-[min(76vw,280px)] shrink-0 snap-start flex-col items-center gap-5 text-center"
              >
                <div aria-hidden className="site-glow-center absolute inset-x-0 top-0 h-[30rem] opacity-60" />
                <Phone
                  screen={screens[i]}
                  alt={`${item.title} — Ifriqiya Soccer Star`}
                  width={220}
                  className="relative"
                />
                <div className="relative flex flex-col items-center gap-2 px-1">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-(--site-line-strong) bg-(--site-bg) text-(--site-accent)">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="font-heading mt-1 text-xl font-extrabold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-(--site-muted)">{item.text}</p>
                </div>
              </article>
            );
          })}
        </div>
      </Reveal>

      {/* LTR comme la piste : en arabe, le point allume doit se trouver du
          meme cote que la carte affichee. */}
      <div dir="ltr" className="mt-2 flex items-center justify-center" aria-label={c.pickSlide}>
        {items.map((item, i) => (
          <button
            key={item.title}
            type="button"
            aria-label={c.showSlide.replace("{tag}", item.title)}
            aria-current={active === i ? "true" : undefined}
            aria-controls="features-track"
            onClick={() => goTo(i)}
            className="flex size-10 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-(--site-accent)"
          >
            <span
              className={`h-2 rounded-full transition-all motion-reduce:transition-none ${active === i ? "w-6 bg-(--site-accent)" : "w-2 bg-white/25"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
