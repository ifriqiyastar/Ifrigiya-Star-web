import Image from "next/image";
import Link from "next/link";

import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";


/** Le logo, en vectoriel — voir `components/site/site-nav.tsx` pour le detail. */
function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image src="/brand/ifriqiya-star.svg" alt="Ifriqiya Soccer Star" width={size} height={size} className={className} />
  );
}

/**
 * Langue et dictionnaire sont **optionnels** : le pied de page les lit du
 * segment `[locale]` quand il en a un. `app/global-not-found.tsx` n'en a pas —
 * il court-circuite la mise en page, donc `next/root-params` — et les lui
 * passe alors en props.
 */
export async function SiteFooter({
  locale: localeFourni,
  dict: dictFourni,
}: {
  locale?: Locale;
  dict?: Dictionary;
} = {}) {
  const dict = dictFourni ?? (await getDictionary());
  const t = dict.footer;
  const locale = localeFourni ?? (await getLocale());
  // Comme dans l'entete : les ancres restent en francais, le prefixe porte la
  // langue. Sans lui, chaque lien du pied de page ramenerait en francais.
  const prefix = locale === "fr" ? "" : `/${locale}`;

  return (
    <footer className="border-t border-(--site-line) py-14">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-4">
          {/* Un peu plus grand sur telephone qu'a partir de `sm` (demande
              client) : `size` reste au plus grand rendu (40) pour que
              `next/image` ne serve jamais une image plus petite que ce que
              `size-9` affiche, la classe se contentant de la reduire a
              `sm:size-8` sur plus grand ecran. */}
          <Link href={prefix || "/"} className="flex items-center gap-2.5">
            <Logo size={40} className="size-9 sm:size-8" />
            <span className="font-heading text-lg font-extrabold sm:text-base">Ifriqiya Soccer Star</span>
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-(--site-muted)">
            {t.tagline}
          </p>
        </div>

        <FooterColumn
          titre={t.academyHeading}
          liens={[
            { href: `${prefix}/#academie`, label: t.about },
            { href: `${prefix}/#comment`, label: t.how },
            { href: `${prefix}/#scout-days-videos`, label: t.scoutDaysVideo },
            { href: `${prefix}/#fonctionnalites`, label: t.app },
            { href: `${prefix}/#vision`, label: t.values },
          ]}
        />

        <FooterColumn
          titre={t.resourcesHeading}
          liens={[
            { href: `${prefix}/#faq`, label: t.faq },
            { href: `${prefix}/#temoignages`, label: t.testimonials },
            { href: `${prefix}/blog`, label: t.blog },
            { href: `${prefix}/contact`, label: t.contact },
          ]}
        />

        <div className="flex flex-col gap-3">
          <p className="font-heading text-sm font-bold tracking-wide uppercase">{t.writeHeading}</p>
          <p className="text-sm leading-relaxed text-(--site-muted)">{t.writeBody}</p>
          <a
            href="mailto:ifriqiya.star@gmail.com"
            className="w-fit text-sm font-semibold text-(--site-accent) hover:underline"
          >
            ifriqiya.star@gmail.com
          </a>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-2 border-t border-(--site-line) px-5 pt-6 text-xs text-(--site-muted) sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} Ifriqiya Soccer Star. {t.rights}</p>
        <p>{t.motto}</p>
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
            <Link
              href={lien.href}
              className="text-sm text-(--site-muted) transition-colors hover:text-(--site-accent)"
            >
              {lien.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
