import { cn } from "@/lib/utils";

type Accent = "primary" | "secondary" | "tertiary" | "neutral";

const ICON: Record<Accent, string> = {
  primary: "text-brand",
  secondary: "text-info",
  tertiary: "text-warning",
  neutral: "text-muted-foreground",
};
const QUALIFIER: Record<Accent, string> = {
  primary: "text-brand",
  secondary: "text-info",
  tertiary: "text-warning",
  neutral: "text-muted-foreground",
};
const BAR: Record<Accent, string> = {
  primary: "bg-brand",
  secondary: "bg-info",
  tertiary: "bg-warning",
  neutral: "bg-muted-foreground",
};

/**
 * Tuile d'entete de l'annuaire, telle que la maquette HTML la dessine :
 * intitule en capitales a gauche et icone a droite, valeur et qualificatif
 * colore sur la meme ligne, puis une barre fine de proportion.
 *
 * La barre n'est dessinee que si `share` est fourni : elle represente une part
 * d'un total connu, jamais un remplissage decoratif.
 */
export function KpiTile({
  label,
  value,
  qualifier,
  share,
  icon: Icon,
  accent = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  /** Precision coloree a droite de la valeur (« 60 % de la base »). */
  qualifier?: string;
  /** Part de 0 a 1 d'un total reel. */
  share?: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: Accent;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-3", className)}>
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="micro-label truncate">{label}</span>
        <Icon className={cn("size-4 shrink-0", ICON[accent])} />
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span className="font-heading text-2xl leading-none font-bold tracking-tight tabular-nums">
          {value}
        </span>
        {qualifier ? (
          <span className={cn("text-[0.6875rem] font-semibold", QUALIFIER[accent])}>
            {qualifier}
          </span>
        ) : null}
      </div>
      {typeof share === "number" ? (
        <span aria-hidden className="mt-3 block h-1 w-full overflow-hidden rounded-full bg-accent">
          <span
            className={cn("block h-full rounded-full", BAR[accent])}
            style={{ width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}
