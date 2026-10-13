import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Bandeau d'indicateur des maquettes de validation : intitule en capitales
 * espacees et valeur a gauche, pastille d'icone carree a droite.
 *
 * Il differe volontairement de `StatCard` — la maquette pose deux formes
 * distinctes : la tuile haute du tableau de bord, et cette barre courte qui
 * coiffe une file de travail.
 */
export function MetricStrip({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  /** Couleur de la valeur et de la pastille : neutre, marque, alerte, info. */
  tone?: "default" | "brand" | "danger" | "info";
  /** Rend le bandeau cliquable : une mesure qui designe un reste de travail
   *  doit mener a la liste filtree qui le contient. */
  href?: string;
  className?: string;
}) {
  const valueTone = {
    default: "text-foreground",
    brand: "text-brand",
    danger: "text-destructive",
    info: "text-info",
  }[tone];
  const chipTone = {
    default: "bg-secondary text-muted-foreground",
    brand: "bg-brand/15 text-brand",
    danger: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info",
  }[tone];

  const body = (
    <>
      <div className="flex min-w-0 flex-col">
        {/* Comme `KpiTile` : deux lignes sous `sm`, ou le bandeau ne fait plus
            que la moitie d'un ecran de telephone. */}
        <span className="micro-label line-clamp-2 text-muted-foreground sm:line-clamp-1">
          {label}
        </span>
        <span
          className={cn(
            "mt-1 font-heading text-base leading-tight font-bold tracking-tight tabular-nums sm:text-lg",
            valueTone,
          )}
        >
          {value}
        </span>
        {hint ? (
          <span className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-10",
          chipTone,
        )}
      >
        <Icon className="size-4 sm:size-5" />
      </span>
    </>
  );

  const shell = cn(
    "flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3",
    href && "transition-colors hover:bg-muted",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  }
  return <div className={shell}>{body}</div>;
}
