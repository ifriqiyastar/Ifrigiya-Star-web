import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";

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
export function StatCard({
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
  glow = false,
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
  /** Halo diffus dans le coin, pour les deux tuiles d'alerte de la maquette. */
  glow?: boolean;
  /** Part de 0 a 1 d'un total reellement connu : dessine une barre en pied. */
  progress?: number;
  /** Rend la tuile cliquable et allume la fleche du coin. */
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      {glow ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-6 -right-6 size-24 rounded-full blur-2xl",
            accent === "error" ? "bg-destructive/15" : "bg-warning/10",
          )}
        />
      ) : null}

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? (
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                CHIP[accent],
              )}
            >
              <Icon className="size-4" />
            </span>
          ) : null}
          <span className="truncate text-sm font-semibold">{label}</span>
        </div>
        <ArrowUpRightIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-all",
            href && "group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
            ARROW[accent],
          )}
        />
      </div>

      <div className="relative mt-3 flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-1">
          <span
            className={cn(
              "font-heading text-[1.75rem] leading-none font-bold tracking-tight tabular-nums",
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
        <div className="relative mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{hint}</span>
          {footHref ? (
            <span className={cn("shrink-0 font-semibold", accent === "error" ? "text-destructive" : accent === "tertiary" ? "text-warning" : "text-brand")}>
              {footLabel ?? "Ouvrir"}
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
