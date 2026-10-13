import Image from "next/image";
import Link from "next/link";

import { BackToTop } from "@/components/site/back-to-top";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";


/**
 * Les comptes officiels de la marque.
 *
 * ⚠️ L'adresse YouTube fournie par le client portait un `?si=…` : c'est le
 * jeton de partage de la personne qui a copie le lien depuis l'application
 * YouTube, pas une partie de l'adresse de la chaine. Il n'apporte rien au
 * visiteur et attribue a ce partage chaque arrivee depuis le site. Retire.
 */
const YOUTUBE_URL = "https://www.youtube.com/@ifriqiyastar";
const INSTAGRAM_URL = "https://www.instagram.com/ifrystar_/";

/** Le logo, en vectoriel — voir `components/site/site-nav.tsx` pour le detail. */
function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image src="/brand/ifriqiya-star.svg" alt="Ifriqiya Soccer Star" width={size} height={size} className={className} />
  );
}

/**
 * Un compte social : une pastille ronde qui ne porte qu'un pictogramme.
 *
 * Donc **toujours** un `aria-label` — une marque dessinee n'a pas de texte, et
 * un lecteur d'ecran n'annoncerait sinon que « lien ». Le `title` donne la
 * meme phrase a la souris, et le SVG est `aria-hidden` pour qu'elle ne soit
 * pas annoncee deux fois.
 *
 * `rel="noreferrer"` plutot que rien : les navigateurs recents impliquent deja
 * `noopener` sur `target="_blank"`, mais le referent, lui, part toujours.
 */
function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex size-10 items-center justify-center rounded-full border border-(--site-line) text-(--site-muted) transition-colors hover:border-(--site-accent) hover:text-(--site-accent) focus-visible:border-(--site-accent) focus-visible:text-(--site-accent)"
    >
      {children}
    </a>
  );
}

/**
 * Marque YouTube, trace officiel, en `currentColor` — meme convention que
 * l'`AppleMark` de `components/site/store-buttons.tsx` : la pastille change de
 * couleur au survol, le pictogramme suit. Les deux marques autorisent cet
 * usage monochrome ; c'est leur version en couleurs qui est encadree.
 *
 * ⚠️ Le triangle est un **sous-chemin** du meme `d`, de sens inverse : c'est
 * ce qui le creuse dans la plaque. Le sortir dans un second `<path>` le
 * remplirait de la meme couleur que la plaque, donc l'effacerait. (La regle de
 * remplissage, elle, n'y change rien : mesure, `nonzero` et `evenodd` rendent
 * exactement la meme image ici.)
 *
 * ⚠️ `lucide-react` v1 n'a plus d'icones de marque (retirees des la serie 0.x),
 * d'ou ces traces ecrits a la main plutot qu'un import comme ailleurs dans
 * `components/site/`.
 */
function YoutubeMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden focusable="false">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

/**
 * Marque Instagram, trace officiel. Une boite de 24 remplie d'un carre, la ou
 * YouTube n'occupe que 17 de hauteur : a boite egale elle parait plus grosse,
 * d'ou le `size-[18px]` ici contre `size-5` la — mesure a l'oeil sur le rendu,
 * pas un chiffre rond.
 */
function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] fill-current" aria-hidden focusable="false">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.44 1.44 0 0 1 2.88 0z" />
    </svg>
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
    <>
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
          {/* Les comptes sociaux ferment la colonne de marque, pas une
              cinquieme colonne ni la barre du bas : ce sont deux adresses de
              la marque elle-meme, au meme titre que le logo et la signature
              au-dessus. Pas d'intitule visible — deux marques dessinees se
              reconnaissent, et un titre de colonne ici concurrencerait la
              signature pour deux liens. */}
          <ul className="mt-1 flex items-center gap-2">
            <li>
              <SocialLink href={YOUTUBE_URL} label={t.youtube}>
                <YoutubeMark />
              </SocialLink>
            </li>
            <li>
              <SocialLink href={INSTAGRAM_URL} label={t.instagram}>
                <InstagramMark />
              </SocialLink>
            </li>
          </ul>
        </div>

        <FooterColumn
          titre={t.academyHeading}
          liens={[
            { href: `${prefix}/#academie`, label: t.about },
            { href: `${prefix}/#scout-days`, label: t.scoutDays },
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

      {/* Les liens legaux vivent dans la barre du bas, a cote du (c) : c'est
          la convention, et c'est aussi l'endroit ou Google et les stores les
          cherchent. Les mettre dans une colonne thematique les noierait parmi
          des liens de contenu. */}
      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-3 border-t border-(--site-line) px-5 pt-6 text-xs text-(--site-muted) sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} Ifriqiya Soccer Star. {t.rights}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href={`${prefix}/confidentialite`} className="transition-colors hover:text-(--site-accent)">
            {t.privacy}
          </Link>
          <Link href={`${prefix}/conditions`} className="transition-colors hover:text-(--site-accent)">
            {t.terms}
          </Link>
          <p>{t.motto}</p>
        </div>
      </div>
    </footer>

    {/* Le ballon de retour en haut : monte ici parce que chaque page publique
        a ce pied de page, et qu'il est toujours dans `.site-shell`, dont il
        lit les couleurs. Il est en `position: fixed`, sa place dans le DOM
        ne compte pas. */}
    <BackToTop label={t.backToTop} />
    </>
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
