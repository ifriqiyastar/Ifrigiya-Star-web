import Image from "next/image";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import type { AppScreen } from "@/lib/app-screens";
import { Reveal } from "@/components/site/reveal";
import { cn } from "@/lib/utils";

/**
 * Les pieces repetees de la page publique.
 *
 * Elles ne sont **pas** dans `components/admin/*` : le back-office et le site
 * public n'ont ni la meme palette (`.site-shell` contre
 * `.admin-dashboard-shell`) ni le meme public. Les melanger ferait qu'un
 * ajustement marketing repeindrait un ecran d'administration.
 */

/** Pastille de section, reprise de la maquette : bord fin, texte discret. */
export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full border border-[var(--site-line-strong)] px-4 py-1.5",
        "text-xs font-medium text-[var(--site-muted)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Chassis de telephone contenant une capture reelle de l'application.
 *
 * DEUX DECISIONS DE QUALITE, et la deuxieme comptait plus que la premiere.
 *
 * 1. `unoptimized` : par defaut `next/image` reencode en WebP a **qualite 75**.
 *    Sur une photo cela ne se voit pas ; sur une capture d'interface, ou tout
 *    est texte fin et aplats contrastes, cela bave visiblement. Le PNG
 *    d'origine fait 100 a 260 Ko et se sert tel quel, sans perte.
 *
 * 2. La largeur d'affichage est plafonnee. Les captures font 426 px de large
 *    a la source : au-dela d'environ 215 px CSS, un ecran haute densite
 *    demande plus de pixels qu'il n'en existe et le navigateur interpole.
 *    Les maquettes sont donc dimensionnees pour rester proches de 2x.
 *
 * Les dimensions natives viennent de `APP_SCREENS` : elles ne sont pas
 * identiques d'une capture a l'autre, et les uniformiser deformait l'image.
 */
export function Phone({
  screen,
  alt,
  width = 212,
  className,
  priority = false,
}: {
  screen: AppScreen;
  alt: string;
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    // `max-w-full` fait de `width` un **plafond** et non une largeur fixe :
    // sur un ecran de 320 px, une maquette de 268 px plus le padding de la
    // section debordait. La largeur passe donc a min(width, place disponible).
    <div className={cn("site-phone max-w-full shrink-0", className)} style={{ width }}>
      <Image
        src={screen.src}
        alt={alt}
        width={screen.width}
        height={screen.height}
        sizes={`${width}px`}
        priority={priority}
        unoptimized
        className="h-auto w-full rounded-[1.9rem]"
      />
    </div>
  );
}

/** Ligne de la liste a puces vertes de la maquette. */
export function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--site-accent)]">
        <svg viewBox="0 0 20 20" className="size-3 fill-none stroke-black stroke-[3]">
          <path d="M4 10.5 8 14.5 16 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-sm text-[var(--site-fg)]">{children}</span>
    </li>
  );
}

/** Titre de section centre, avec sa pastille et son chapeau. */
export function SectionHeading({
  pill,
  title,
  lead,
  className,
}: {
  pill?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={cn("flex flex-col items-center gap-4 text-center", className)}>
      {pill ? <Pill>{pill}</Pill> : null}
      <h2 className="font-heading max-w-3xl text-3xl leading-[1.1] font-extrabold text-balance sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {lead ? (
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--site-muted)] sm:text-base">
          {lead}
        </p>
      ) : null}
    </Reveal>
  );
}

/**
 * Pagination par liens (`?page=n`), sur le modele des fleches
 * precedent/suivant de `steps-time-machine.tsx` — meme forme, cercle bordé,
 * pour rester dans le meme vocabulaire visuel que le reste de la page.
 * Non l'equivalent de `components/admin/pagination.tsx` : deux design
 * systems distincts (voir le commentaire en tete de fichier), et le blog
 * n'est pas multilingue, donc pas besoin d'un dictionnaire pour "page X / Y".
 */
export function SitePagination({
  basePath,
  page,
  pageSize,
  total,
  params,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  /** Autres filtres actifs (`?q=`, `?auteur=`...) a reporter d'une page a l'autre. */
  params?: Record<string, string | undefined>;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage <= 1) return null;

  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) query.set(key, value);
    }
    if (target > 1) query.set("page", String(target));
    const search = query.toString();
    return search ? `${basePath}?${search}` : basePath;
  };
  const arrowClass =
    "flex size-11 shrink-0 items-center justify-center rounded-full border text-[var(--site-fg)] transition-colors";

  return (
    <nav aria-label="Pagination des articles" className="mt-14 flex items-center justify-center gap-4">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          aria-label="Page precedente"
          className={cn(arrowClass, "border-[var(--site-line-strong)] hover:border-[var(--site-accent)] hover:text-[var(--site-accent)]")}
        >
          <ChevronLeftIcon className="size-4 rtl:-scale-x-100" aria-hidden />
        </Link>
      ) : (
        <span aria-hidden className={cn(arrowClass, "border-[var(--site-line)] text-[var(--site-muted)] opacity-40")}>
          <ChevronLeftIcon className="size-4 rtl:-scale-x-100" />
        </span>
      )}
      <span className="font-mono text-xs tracking-[0.18em] text-[var(--site-muted)] uppercase">
        Page {page} / {lastPage}
      </span>
      {page < lastPage ? (
        <Link
          href={href(page + 1)}
          aria-label="Page suivante"
          className={cn(arrowClass, "border-[var(--site-line-strong)] hover:border-[var(--site-accent)] hover:text-[var(--site-accent)]")}
        >
          <ChevronRightIcon className="size-4 rtl:-scale-x-100" aria-hidden />
        </Link>
      ) : (
        <span aria-hidden className={cn(arrowClass, "border-[var(--site-line)] text-[var(--site-muted)] opacity-40")}>
          <ChevronRightIcon className="size-4 rtl:-scale-x-100" />
        </span>
      )}
    </nav>
  );
}
