import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { getAdminDict } from "@/lib/i18n/admin";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/**
 * Tete de page des maquettes « console operationnelle » : fil d'ariane en
 * capitales espacees, titre large accompagne d'une pastille de contexte, puis
 * la phrase qui dit ce que l'ecran permet de faire, et les actions a droite.
 *
 * Le fil d'ariane n'est pas decoratif : les ecrans du back-office se rangent
 * en deux niveaux (« Utilisateurs et validations › Comptes »), et c'est la
 * seule indication de ce regroupement une fois la page ouverte.
 */
export async function PageHeader({
  breadcrumb,
  kicker,
  title,
  meta,
  description,
  actions,
  className,
}: {
  /** Chemin de section. Le dernier element est la page courante, en lime. */
  breadcrumb?: Crumb[];
  /**
   * Ancien sur-titre, conserve pour les ecrans qui n'ont pas de fil d'ariane :
   * il est rendu comme le premier maillon d'un chemin a un seul niveau.
   */
  kicker?: string;
  title: string;
  /** Pastille collee au titre : volumetrie, version, etat de la file. */
  meta?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  // Composant serveur : il lit le dictionnaire plutot que de se faire passer
  // un libelle qu'aucun de ses quinze appelants n'a de raison de connaitre.
  const dict = await getAdminDict();
  const crumbs = breadcrumb ?? (kicker ? [{ label: kicker }] : []);

  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        {crumbs.length ? (
          <nav aria-label={dict.common.breadcrumb} className="flex flex-wrap items-center gap-1.5">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              const content = (
                <span
                  className={cn(
                    "micro-label",
                    isLast ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  {crumb.label}
                </span>
              );
              return (
                <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                  {index > 0 ? (
                    <ChevronRightIcon aria-hidden className="size-3 text-muted-foreground/60" />
                  ) : null}
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className="hover:text-foreground">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </span>
              );
            })}
          </nav>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-[1.375rem] leading-tight font-extrabold sm:text-[1.65rem]">
            {title}
          </h1>
          {meta}
        </div>

        {description ? (
          <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:pt-1">{actions}</div>
      ) : null}
    </div>
  );
}

/** Pastille de contexte posee a cote du titre (« 3 en attente », « 5 comptes »). */
export function HeaderMeta({
  children,
  tone = "neutral",
  dot,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "danger";
  /** Point colore devant le libelle, pour une file non vide. */
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "micro-label inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        tone === "brand"
          ? "border-brand/40 bg-brand/10 text-brand"
          : tone === "danger"
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-border bg-secondary text-muted-foreground",
      )}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            tone === "danger" ? "bg-destructive" : tone === "brand" ? "bg-brand" : "bg-muted-foreground",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

/** Titre de section avec son lien « voir tout », entre deux blocs de la page. */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="font-heading text-base font-bold">{title}</h2>
      {action}
    </div>
  );
}
