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
        <span className="micro-label truncate text-muted-foreground">{label}</span>
        <span
          className={cn(
            "mt-1 font-heading text-lg leading-tight font-bold tracking-tight tabular-nums",
            valueTone,
          )}
        >
          {value}
        </span>
        {hint ? (
          <span className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", chipTone)}>
        <Icon className="size-5" />
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
