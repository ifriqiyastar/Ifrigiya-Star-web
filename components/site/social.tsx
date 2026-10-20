import { cn } from "@/lib/utils";

/**
 * Les comptes sociaux de la marque : adresses, pastille et marques dessinees.
 *
 * Ce module est **neutre** — il n'importe ni `server-only`, ni `next/headers`,
 * ni le dictionnaire. C'est ce qui lui permet d'etre partage entre le pied de
 * page (Server Component) et l'entete (`site-nav.tsx`, le seul composant
 * client du site public) : les deux rendent exactement la meme pastille, et
 * une correction de trace n'a plus a etre faite deux fois. Les intitules
 * arrivent en props, depuis le dictionnaire de l'appelant.
 *
 * ⚠️ L'adresse YouTube fournie par le client portait un `?si=…` : c'est le
 * jeton de partage de la personne qui a copie le lien depuis l'application
 * YouTube, pas une partie de l'adresse de la chaine. Il n'apporte rien au
 * visiteur et attribue a ce partage chaque arrivee depuis le site. Retire.
 */
export const YOUTUBE_URL = "https://www.youtube.com/@ifriqiyastar";
export const INSTAGRAM_URL = "https://www.instagram.com/ifriqiya_soccer_star/";

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
 *
 * `className` n'est la que pour la taille de la pastille : l'entete, haute de
 * 64 px, la veut un cran plus petite que le pied de page. Les couleurs, elles,
 * restent ici — c'est le meme objet sur les deux surfaces. Le `cn()` est celui
 * de tailwind-merge : `size-9` passe par l'appelant remplace `size-10`, et une
 * classe d'une autre famille s'ajoute sans emporter la taille par defaut.
 */
export function SocialLink({
  href,
  label,
  className,
  children,
}: {
  href: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-full border border-(--site-line) text-(--site-muted) transition-colors hover:border-(--site-accent) hover:text-(--site-accent) focus-visible:border-(--site-accent) focus-visible:text-(--site-accent)",
        className,
      )}
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
export function YoutubeMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("fill-current", className)} aria-hidden focusable="false">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

/**
 * Marque Instagram, trace officiel. Une boite de 24 remplie d'un carre, la ou
 * YouTube n'occupe que 17 de hauteur : a boite egale elle parait plus grosse,
 * d'ou le `size-[18px]` par defaut ici contre `size-5` la — mesure a l'oeil
 * sur le rendu, pas un chiffre rond. Le meme ecart est conserve quand
 * l'appelant reduit les deux marques.
 */
export function InstagramMark({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("fill-current", className)} aria-hidden focusable="false">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.44 1.44 0 0 1 2.88 0z" />
    </svg>
  );
}
