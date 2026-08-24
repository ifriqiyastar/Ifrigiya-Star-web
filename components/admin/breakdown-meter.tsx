import { formatNumber } from "@/lib/format";
import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

const FILL: Record<Tone, string> = {
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

export type BreakdownRow = { label: string; value: number; tone?: Tone };

/**
 * Repartition d'un total en parts. Chaque ligne porte son libelle et sa valeur
 * en clair : la couleur n'est jamais le seul porteur d'information, elle ne
 * fait que rappeler l'etat (valide / en attente / refuse…).
 */
export function BreakdownMeter({
  rows,
  total,
  className,
}: {
  rows: BreakdownRow[];
  total?: number;
  className?: string;
}) {
  const sum = total ?? rows.reduce((acc, row) => acc + row.value, 0);

  return (
    <ul className={cn("space-y-3.5", className)}>
      {rows.map((row) => {
        const share = sum > 0 ? (row.value / sum) * 100 : 0;
        return (
          <li key={row.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">{row.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatNumber(row.value)}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {sum > 0 ? `${Math.round(share)} %` : "—"}
                </span>
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-foreground/10"
              role="presentation"
            >
              <div
                className={cn("h-full rounded-full", FILL[row.tone ?? "neutral"])}
                style={{ width: `${share}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
