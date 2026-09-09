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
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  /** Couleur de la valeur et de la pastille : neutre, marque, alerte, info. */
  tone?: "default" | "brand" | "danger" | "info";
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

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3",
        className,
      )}
    >
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
    </div>
  );
}
