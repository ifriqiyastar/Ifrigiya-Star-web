import Image from "next/image";
import { QuoteIcon } from "lucide-react";

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
  "/images/testimonial-ines.webp",
  "/images/testimonial-mehdi.webp",
] as const;

export async function TestimonialsSection() {
  const dict = await getDictionary();
  const t = dict.testimonials;

  return (
    <section
      id="temoignages"
      aria-labelledby="testimonials-heading"
      className="scroll-mt-20 border-y border-(--site-line) bg-(--site-card) py-16 sm:py-24 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
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

        <div className="mt-10 grid gap-6 md:grid-cols-3 lg:mt-14">
          {t.items.map((testimonial, index) => (
            <Reveal
              key={testimonial.name}
              as="figure"
              delay={index * 90}
              className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-(--site-line-strong) bg-black">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={TESTIMONIAL_IMAGES[index]}
                  alt={t.portraitAlt.replace("{name}", testimonial.name)}
                  fill
                  sizes="(min-width: 1280px) 389px, (min-width: 768px) 33vw, 100vw"
                  className="object-cover object-[center_10%]"
                />
                <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
                <span aria-hidden className="font-heading absolute end-5 bottom-4 text-4xl font-extrabold text-white/80">
                  0{index + 1}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-6 lg:p-7">
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
              <figcaption className="mx-6 border-t border-(--site-line-strong) pt-5 pb-6 lg:mx-7 lg:pb-7">
                <p className="font-heading text-base font-extrabold">{testimonial.name}</p>
                <p className="mt-1 text-xs text-(--site-muted)">{testimonial.role}</p>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
