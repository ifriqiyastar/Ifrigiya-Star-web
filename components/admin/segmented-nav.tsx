import Link from "next/link";

import { LinkPendingIcon } from "@/components/admin/link-pending-icon";
import { ScrollIntoView } from "@/components/admin/scroll-into-view";
import { cn } from "@/lib/utils";

export type Segment = {
  value: string;
  label: string;
  count?: number;
  /** Icone posee devant le libelle, comme dans les maquettes de validation. */
  icon?: React.ComponentType<{ className?: string }>;
};

/**
 * Onglets rendus en liens : l'onglet actif vit dans l'URL, donc la page reste
 * un Server Component qui ne charge que les donnees de l'onglet demande —
 * plutot qu'un `Tabs` client qui obligerait a tout charger d'avance.
 */
export function SegmentedNav({
  basePath,
  paramName = "vue",
  segments,
  active,
  params = {},
  className,
}: {
  basePath: string;
  paramName?: string;
  segments: Segment[];
  active: string;
  params?: Record<string, string | undefined>;
  className?: string;
}) {
  const href = (value: string) => {
    const next = new URLSearchParams();
    // On repart d'une URL propre : changer d'onglet remet a zero filtres et page.
    for (const [key, current] of Object.entries(params)) {
      if (current && key === "q") next.set(key, current);
    }
    if (value !== segments[0]?.value) next.set(paramName, value);
    const query = next.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <div
      className={cn(
        // ⚠️ `-mx-3` ET NON `-mx-4` : la barre deborde volontairement jusqu'aux
        // bords de l'ecran sous `sm`, et cette marge negative doit annuler le
        // padding de `<main>` — qui vaut `p-3` (12 px) a cette largeur, pas
        // `p-4`. Avec -16 px la barre faisait 8 px de plus que la fenetre et
        // c'est la PAGE ENTIERE qui defilait lateralement, pas seulement les
        // onglets. Elle suppose donc d'etre fille directe de `<main>` ; posee
        // dans un `Panel`, il faudrait reprendre le calcul.
        "-mx-3 flex snap-x gap-1 overflow-x-auto scroll-px-1 border-y border-border bg-card p-1 sm:mx-0 sm:w-fit sm:rounded-lg sm:border",
        className,
      )}
    >
      {segments.map((segment) => {
        const isActive = segment.value === active;
        return (
          <Link
            key={segment.value}
            href={href(segment.value)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              // `min-h-11` = 44 px sur telephone, le plancher de cible
              // tactile des deux plateformes (44 pt iOS, 48 dp Material). Les
              // onglets tenaient sur ~32 px : viser le bon parmi quatre, dans
              // une barre qui defile, demandait de la precision. La hauteur
              // retombe a celle du contenu des `sm`, ou l'on pointe a la
              // souris et ou la barre redevient une pastille compacte.
              "flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-md border border-transparent px-3 py-2 text-xs font-semibold transition-colors sm:min-h-0",
              isActive
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {segment.icon ? (
              <segment.icon
                className={cn("size-3.5", isActive ? "" : "text-muted-foreground")}
              />
            ) : null}
            {isActive ? <ScrollIntoView /> : null}
            {segment.label}
            {typeof segment.count === "number" && segment.count > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.625rem] tabular-nums",
                  isActive ? "bg-black/15 font-bold" : "bg-secondary text-muted-foreground",
                )}
              >
                {segment.count}
              </span>
            ) : null}
            <LinkPendingIcon />
          </Link>
        );
      })}
    </div>
  );
}
