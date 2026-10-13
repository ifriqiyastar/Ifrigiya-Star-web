import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";

import { getAdminDict } from "@/lib/i18n/admin";
import { cn } from "@/lib/utils";

/** Accent de la tuile : chaque indicateur porte la couleur de son domaine. */
type Accent = "primary" | "secondary" | "tertiary" | "error" | "neutral";

const CHIP: Record<Accent, string> = {
  primary: "bg-brand/10 text-brand",
  secondary: "bg-info/10 text-info",
  tertiary: "bg-warning/15 text-warning",
  error: "bg-destructive/25 text-destructive",
  neutral: "bg-accent text-foreground",
};

const ARROW: Record<Accent, string> = {
  primary: "group-hover:text-brand",
  secondary: "group-hover:text-info",
  tertiary: "text-warning",
  error: "text-destructive",
  neutral: "group-hover:text-foreground",
};

const VALUE: Record<Accent, string> = {
  primary: "text-foreground",
  secondary: "text-foreground",
  tertiary: "text-warning",
  error: "text-destructive",
  neutral: "text-foreground",
};

const BADGE: Record<string, string> = {
  brand: "bg-brand/15 text-brand font-bold",
  info: "bg-info/20 text-info font-bold",
  warning: "bg-warning/20 text-warning font-bold",
  danger: "bg-destructive text-destructive-foreground font-bold uppercase",
  neutral: "bg-accent text-muted-foreground",
};

/**
 * Tuile d'indicateur du tableau de bord, calquee sur la maquette HTML du
 * client : pastille d'icone carree et intitule en haut, fleche discrete a
 * droite, grande valeur avec sa pastille de qualification, puis une ligne de
 * pied — precision a gauche, complement ou lien a droite.
 *
 * Les noms de proprietes historiques (`label`, `hint`, `delta`) sont conserves :
 * les autres ecrans les utilisent deja et retombent naturellement dans cette
 * anatomie.
 */
export async function StatCard({
  label,
  value,
  unit,
  delta,
  deltaTone = "brand",
  hint,
  footNote,
  footHref,
  footLabel,
  icon: Icon,
  accent = "primary",
  progress,
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  /** Unite posee a cote de la valeur, en plus petit (« TND »). */
  unit?: string;
  /** Pastille de qualification a droite de la valeur. */
  delta?: string;
  deltaTone?: "brand" | "info" | "warning" | "danger" | "neutral";
  /** Ligne de pied, a gauche. */
  hint?: React.ReactNode;
  /** Ligne de pied, a droite (texte). */
  footNote?: React.ReactNode;
  /** Ligne de pied, a droite (lien) — prend le pas sur `footNote`. */
  footHref?: string;
  footLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: Accent;
  /** Part de 0 a 1 d'un total reellement connu : dessine une barre en pied. */
  progress?: number;
  /** Rend la tuile cliquable et allume la fleche du coin. */
  href?: string;
  className?: string;
}) {
  const dict = await getAdminDict();
  const body = (
    <>
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? (
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-lg sm:size-8",
                CHIP[accent],
              )}
            >
              <Icon className="size-4" />
            </span>
          ) : null}
          {/* Deux lignes sur telephone, une seule des `sm`. A deux tuiles par
              rangee sur un ecran de 390 px, l'intitule ne dispose que d'une
              petite centaine de pixels : tronque, « Joueurs valides » devenait
              « Joueurs… » et la tuile ne disait plus ce qu'elle comptait.
              `line-clamp` aux deux paliers plutot que `truncate` a l'un et
              `line-clamp` a l'autre : les deux mecanismes se contredisent
              (`white-space: nowrap` contre `display: -webkit-box`). */}
          <span className="line-clamp-2 text-xs leading-snug font-semibold sm:line-clamp-1 sm:text-sm">
            {label}
          </span>
        </div>
        <ArrowUpRightIcon
          className={cn(
            "hidden size-4 shrink-0 text-muted-foreground transition-all sm:block",
            href && "group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
            ARROW[accent],
          )}
        />
      </div>

      <div className="relative mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:mt-3 sm:justify-between">
        <span className="flex items-baseline gap-1">
          <span
            className={cn(
              "font-heading text-2xl leading-none font-bold tracking-tight tabular-nums sm:text-[1.75rem]",
              VALUE[accent],
            )}
          >
            {value}
          </span>
          {unit ? <span className="text-xs font-bold text-muted-foreground">{unit}</span> : null}
        </span>
        {delta ? (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] tracking-wide",
              BADGE[deltaTone],
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>

      {hint || footNote || footHref ? (
        <div className="relative mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[0.6875rem] text-muted-foreground sm:text-xs">
          <span className="min-w-0 truncate">{hint}</span>
          {footHref ? (
            <span className={cn("shrink-0 font-semibold", accent === "error" ? "text-destructive" : accent === "tertiary" ? "text-warning" : "text-brand")}>
              {footLabel ?? dict.common.open}
            </span>
          ) : footNote ? (
            <span className="shrink-0 text-muted-foreground/70">{footNote}</span>
          ) : null}
        </div>
      ) : null}

      {typeof progress === "number" ? (
        <span
          aria-hidden
          className="relative mt-2 block h-1 w-full overflow-hidden rounded-full bg-accent"
        >
          <span
            className={cn("block h-full rounded-full", accent === "secondary" ? "bg-info" : "bg-brand")}
            style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
          />
        </span>
      ) : null}
    </>
  );

  const shell = cn(
    "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-3 transition-colors",
    (href || footHref) && "hover:bg-muted",
    className,
  );

  const target = href ?? footHref;
  if (target) {
    return (
      <Link href={target} className={shell}>
        {body}
      </Link>
    );
  }
  return <div className={shell}>{body}</div>;
}
