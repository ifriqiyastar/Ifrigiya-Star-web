import Image from "next/image";
import type { CSSProperties } from "react";
import { QuoteIcon } from "lucide-react";

import { CardStack } from "@/components/site/card-stack";
import { Pill } from "@/components/site/pieces";
import { Reveal } from "@/components/site/reveal";
import { getDictionary } from "@/lib/i18n/dictionaries";

/**
 * Contenu de demonstration : ces personnes, ces portraits et ces recits sont
 * fictifs. Les textes vivent dans `messages/*.json` ; seules les images
 * restent ici, puisqu'elles ne se traduisent pas et que l'ordre des deux
 * listes doit rester le meme.
 */
const TESTIMONIAL_IMAGES = [
  "/images/testimonial-yassine.webp",
  "/images/testimonial-karim.webp",
  "/images/testimonial-mehdi.webp",
] as const;

export async function TestimonialsSection() {
  const dict = await getDictionary();
  const t = dict.testimonials;

  return (
    <section
      id="temoignages"
      aria-labelledby="testimonials-heading"
      className="relative scroll-mt-20 border-y border-(--site-line) py-16 sm:py-24 lg:py-28"
    >
      {/* Fond noir et halo de la charte en bas a gauche, comme les autres
          sections — plus de bande grise : elle etait la seule de la page
          (retiree a la demande du client, oct. 2026). Pas de `overflow-hidden`
          ici : la pile de cartes est en `sticky`, il la decollerait. */}
      <div className="site-glow pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="max-w-2xl">
            <Pill>{t.pill}</Pill>
            <h2 id="testimonials-heading" className="font-heading mt-5 text-3xl leading-[1.1] font-extrabold text-balance sm:text-4xl md:text-5xl">
              {t.titleLine1}
              <br />
              {t.titleLine2} <span className="text-(--site-accent)">{t.titleAccent}</span>
            </h2>
          </div>
        </Reveal>

        {/* Pile de cartes : chacune se colle sous l'entete et la suivante
            glisse par-dessus (bloc 4c de `globals.css`, `CardStack`).
            Une colonne, et non plus trois : une pile se lit de haut en bas.
            A partir de `md` la carte passe a l'horizontale — portrait a
            gauche, texte a droite — pour rester assez basse pour tenir
            entiere dans l'ecran une fois collee. */}
        <CardStack className="mx-auto mt-10 flex max-w-4xl flex-col gap-6 lg:mt-14">
          {t.items.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="site-stack-item"
              style={{ "--i": index } as CSSProperties}
            >
              <Reveal>
                <figure className="site-stack-card relative grid min-w-0 overflow-hidden rounded-3xl border border-(--site-line-strong) bg-black md:grid-cols-[2fr_3fr] md:grid-rows-[1fr_auto]">
                  <div className="relative aspect-[16/10] overflow-hidden md:row-span-2 md:aspect-auto md:min-h-[20rem]">
                    <Image
                      src={TESTIMONIAL_IMAGES[index]}
                      alt={t.portraitAlt.replace("{name}", testimonial.name)}
                      fill
                      sizes="(min-width: 896px) 358px, (min-width: 768px) 40vw, 100vw"
                      className="object-cover object-[center_15%]"
                    />
                    <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
                    <span aria-hidden className="font-heading absolute end-5 bottom-4 text-4xl font-extrabold text-white/80">
                      0{index + 1}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6 lg:p-7">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-heading text-lg leading-tight font-extrabold">{testimonial.theme}</h3>
                      <QuoteIcon className="size-6 shrink-0 text-(--site-accent)" aria-hidden />
                    </div>
                    <blockquote className="mt-4 flex-1 text-sm leading-7 text-(--site-muted)">
                      <p>
                        {t.quoteOpen}
                        {testimonial.quote}
                        {t.quoteClose}
                      </p>
                    </blockquote>
                  </div>
                  <figcaption className="mx-5 border-t border-(--site-line-strong) pt-4 pb-5 sm:mx-6 sm:pt-5 sm:pb-6 lg:mx-7 lg:pb-7">
                    <p className="font-heading text-base font-extrabold">{testimonial.name}</p>
                    <p className="mt-1 text-xs text-(--site-muted)">{testimonial.role}</p>
                  </figcaption>
                  {/* Voile qui s'epaissit a mesure que la carte suivante la
                      recouvre : la carte du dessus reste la seule a lire. */}
                  <span aria-hidden className="site-stack-shade pointer-events-none absolute inset-0 bg-black" />
                </figure>
              </Reveal>
            </div>
          ))}
        </CardStack>
      </div>
    </section>
  );
}
