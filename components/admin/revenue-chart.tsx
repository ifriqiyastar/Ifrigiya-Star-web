import { makeFormat } from "@/lib/format";
import { EmptyState } from "@/components/admin/empty-state";
import { fill, getAdminDict, getAdminLocale } from "@/lib/i18n/admin";
import type { RevenueBucket } from "@/lib/queries/dashboard";
import { TrendingUpIcon } from "lucide-react";

export type RevenueRow = {
  /** Debut du pas de temps. Un jour, une semaine ou un mois selon `bucket`. */
  bucket: string | null;
  abonnement: number;
  scout_day: number;
};

/**
 * Revenus encaisses par pas de temps, decomposes en abonnements et Scout Days
 * (§12.4). Barres empilees horizontales : les libelles restent lisibles sur
 * telephone, ce que des barres verticales ne permettent pas.
 *
 * ⚠️ LE PAS N'EST PLUS TOUJOURS LE MOIS. Il suit la periode choisie — une
 * barre par jour sur une semaine, par semaine sur un mois ou un trimestre, par
 * mois au-dela — et c'est la base qui le decide (`admin_dashboard_counts`),
 * pas cet affichage. Etiqueter en mois une barre qui couvre une semaine
 * renverrait au defaut d'origine : un intitule qui ne decrit pas ce qu'il
 * surmonte.
 *
 * Le couple de couleurs (`--viz-1`, `--viz-2`) est valide pour le daltonisme,
 * mais la legende et les valeurs affichees portent l'information : la couleur
 * seule ne distingue rien.
 */
export async function RevenueChart({
  rows,
  granularity = "mois",
  currency = "TND",
}: {
  rows: RevenueRow[];
  granularity?: RevenueBucket;
  currency?: string;
}) {
  const [locale, dict] = await Promise.all([getAdminLocale(), getAdminDict()]);
  const { formatAmount, formatMonth, formatShortDay } = makeFormat(locale);

  /** L'intitule d'une barre, dans l'unite que la barre couvre reellement. */
  const bucketLabel = (value: string | null) => {
    if (granularity === "jour") return formatShortDay(value);
    if (granularity === "semaine") {
      return fill(dict.dashboard.weekOf, { date: formatShortDay(value) });
    }
    return formatMonth(value);
  };
  const max = Math.max(...rows.map((row) => row.abonnement + row.scout_day), 0);

  if (!rows.length || max === 0) {
    return (
      <EmptyState
        icon={TrendingUpIcon}
        title={dict.dashboard.chartEmptyTitle}
        description={dict.dashboard.chartEmptyDesc}
      />
    );
  }

  return (
    <div className="space-y-5 px-4 py-5 sm:px-5">
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <li className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-sm bg-viz-1" />
          {dict.common.subscriptions}
        </li>
        <li className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-sm bg-viz-2" />
          {dict.common.scoutDays}
        </li>
      </ul>

      <ul className="space-y-4">
        {rows.map((row) => {
          const total = row.abonnement + row.scout_day;
          return (
            <li key={row.bucket ?? "inconnu"} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-medium capitalize">{bucketLabel(row.bucket)}</span>
                <span className="font-semibold tabular-nums">
                  {formatAmount(total, currency)}
                </span>
              </div>
              <div className="flex h-3 w-full items-stretch gap-0.5" role="presentation">
                {row.abonnement > 0 ? (
                  <div
                    className="group/seg relative rounded-sm bg-viz-1"
                    style={{ width: `${(row.abonnement / max) * 100}%` }}
                  >
                    <Tip>
                      {dict.common.subscriptions} — {formatAmount(row.abonnement, currency)}
                    </Tip>
                  </div>
                ) : null}
                {row.scout_day > 0 ? (
                  <div
                    className="group/seg relative rounded-sm bg-viz-2"
                    style={{ width: `${(row.scout_day / max) * 100}%` }}
                  >
                    <Tip>
                      {dict.common.scoutDays} — {formatAmount(row.scout_day, currency)}
                    </Tip>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Infobulle au survol, en CSS seul — le graphique reste un Server Component. */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-0 z-10 mb-1.5 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[0.6875rem] text-popover-foreground shadow-md group-hover/seg:block">
      {children}
    </span>
  );
}
