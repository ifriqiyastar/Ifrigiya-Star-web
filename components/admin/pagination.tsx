import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Pagination par liens (pas d'etat client) : `?page=n` sur la route courante. */
export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
  pageParam = "page",
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
  pageParam?: string;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const href = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== pageParam) next.set(key, value);
    }
    if (target > 1) next.set(pageParam, String(target));
    const query = next.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
      <p className="text-xs text-muted-foreground">
        {total === 0
          ? "Aucun resultat"
          : `${formatNumber(from)}–${formatNumber(to)} sur ${formatNumber(total)}`}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>
            <ChevronLeftIcon />
            Precedent
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "outline", size: "xs" }), "pointer-events-none opacity-40")}>
            <ChevronLeftIcon />
            Precedent
          </span>
        )}
        <span className="text-xs tabular-nums text-muted-foreground">
          {page} / {lastPage}
        </span>
        {page < lastPage ? (
          <Link href={href(page + 1)} className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>
            Suivant
            <ChevronRightIcon />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "outline", size: "xs" }), "pointer-events-none opacity-40")}>
            Suivant
            <ChevronRightIcon />
          </span>
        )}
      </div>
    </div>
  );
}
