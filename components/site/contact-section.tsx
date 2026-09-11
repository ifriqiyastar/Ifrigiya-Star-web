import Image from "next/image";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";

import { Pill } from "@/components/site/pieces";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export async function ContactSection() {
  const dict = await getDictionary();
  const t = dict.contactSection;
  const locale = await getLocale();

  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="relative isolate scroll-mt-20 overflow-hidden border-t border-(--site-line)"
    >
      <Image
        src="/images/contact-football-tunisia.webp"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-[72%_center] rtl:object-[28%_center] lg:object-center"
      />
      {/* Le degrade part du cote du texte : a gauche en LTR, a droite en RTL. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/60 lg:bg-linear-to-r lg:from-black/90 lg:via-black/55 lg:to-black/10 lg:rtl:bg-linear-to-l"
      />
      <div className="relative mx-auto flex min-h-[480px] max-w-7xl items-center px-5 py-20 sm:px-8 sm:py-24 lg:min-h-[520px]">
        {/* `max-w-2xl` et non `xl` : a `lg:text-6xl`, « faisons-le ensemble. »
            ne tient pas dans 36 rem et le titre repassait sur trois lignes
            malgre son <br />. Le paragraphe garde sa propre largeur, plus
            etroite, pour ne pas s'etendre sur toute la colonne. */}
        <div className="max-w-2xl">
          <Pill className="border-white/25 bg-black/30">{t.pill}</Pill>
          <h2 id="contact-heading" className="font-heading mt-6 text-4xl leading-[1.1] font-extrabold text-balance sm:text-5xl lg:text-6xl">
            {t.titleLine1}
            <br />
            <span className="text-(--site-accent)">{t.titleLine2}</span>
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-balance text-(--site-muted) sm:text-base">
            {t.lead}
          </p>
          <Link
            href={locale === "fr" ? "/contact" : `/${locale}/contact`}
            className="mt-8 inline-flex items-center gap-5 rounded-full bg-(--site-accent) px-7 py-4 text-sm font-semibold text-(--site-ink) transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent)"
          >
            {t.cta}
            <ArrowUpRightIcon className="size-5 rtl:-scale-x-100" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
