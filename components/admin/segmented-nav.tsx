import Link from "next/link";

import { cn } from "@/lib/utils";

export type Segment = { value: string; label: string; count?: number };

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
        "-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0",
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
              "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold tracking-wide transition-colors",
              isActive
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {segment.label}
            {typeof segment.count === "number" && segment.count > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.625rem] tabular-nums",
                  isActive ? "bg-black/15" : "bg-accent",
                )}
              >
                {segment.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
