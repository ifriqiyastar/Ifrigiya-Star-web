import Image from "next/image";
import { QuoteIcon } from "lucide-react";

import { Pill } from "@/components/site/pieces";

// Demonstration content: these people, portraits and stories are fictional.
const TESTIMONIALS = [
  {
    name: "Yassine",
    role: "Joueur · Milieu de terrain",
    image: "/images/testimonial-yassine.webp",
    theme: "Oser se montrer",
    quote:
      "Je gardais mes vidéos de match sur mon téléphone sans savoir quoi en faire. En construisant mon profil, j’ai appris à montrer mon jeu et mes points forts. Mon premier Scout Day m’a surtout donné une chose : l’envie de viser plus haut.",
  },
  {
    name: "Inès",
    role: "Joueuse · Ailière",
    image: "/images/testimonial-ines.webp",
    theme: "Avancer avec confiance",
    quote:
      "Après une détection, j’avais enfin des retours concrets sur mon jeu. J’ai repris l’entraînement avec des objectifs précis : mon placement, mes appels, ma dernière passe. Chaque séance avait un sens et je voyais mes progrès autrement.",
  },
  {
    name: "Mehdi",
    role: "Entraîneur · Formation",
    image: "/images/testimonial-mehdi.webp",
    theme: "Créer la rencontre",
    quote:
      "Un profil ne remplace pas le terrain, mais il peut ouvrir la discussion. Les vidéos m’ont permis de découvrir des joueurs hors de mon réseau habituel. Ensuite, une journée de détection nous a donné le temps de les voir jouer et d’échanger.",
  },
];

export function TestimonialsSection() {
  return (
    <section
      id="temoignages"
      aria-labelledby="testimonials-heading"
      className="scroll-mt-20 border-y border-(--site-line) bg-(--site-card) py-16 sm:py-24 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="max-w-2xl">
            <Pill>Témoignages · Exemples fictifs</Pill>
            <h2 id="testimonials-heading" className="font-heading mt-5 text-3xl leading-[1.1] font-extrabold text-balance sm:text-4xl md:text-5xl">
              Des ambitions.
              <br />
              Des parcours. <span className="text-(--site-accent)">Une passion.</span>
            </h2>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3 lg:mt-14">
          {TESTIMONIALS.map((testimonial, index) => (
            <figure key={testimonial.name} className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-(--site-line-strong) bg-black">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={testimonial.image}
                  alt={`Portrait généré par IA de ${testimonial.name}, personnage fictif`}
                  fill
                  sizes="(min-width: 1280px) 389px, (min-width: 768px) 33vw, 100vw"
                  className="object-cover object-[center_10%]"
                />
                <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
                <span aria-hidden className="font-heading absolute right-5 bottom-4 text-4xl font-extrabold text-white/80">
                  0{index + 1}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-6 lg:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-heading text-lg leading-tight font-extrabold">{testimonial.theme}</h3>
                  <QuoteIcon className="size-6 shrink-0 text-(--site-accent)" aria-hidden />
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-7 text-(--site-muted)">
                  <p>« {testimonial.quote} »</p>
                </blockquote>
              </div>
              <figcaption className="mx-6 border-t border-(--site-line-strong) pt-5 pb-6 lg:mx-7 lg:pb-7">
                <p className="font-heading text-base font-extrabold">{testimonial.name}</p>
                <p className="mt-1 text-xs text-(--site-muted)">{testimonial.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
