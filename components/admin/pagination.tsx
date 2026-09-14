import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { makeFormat } from "@/lib/format";
import { fill, getAdminDict, getAdminLocale } from "@/lib/i18n/admin";
import { cn } from "@/lib/utils";

/** Pagination par liens (pas d'etat client) : `?page=n` sur la route courante. */
export async function Pagination({
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
  const [locale, dict] = await Promise.all([getAdminLocale(), getAdminDict()]);
  const { formatNumber } = makeFormat(locale);
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
          ? dict.common.noResult
          : fill(dict.common.range, {
              from: formatNumber(from),
              to: formatNumber(to),
              total: formatNumber(total),
            })}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>
            <ChevronLeftIcon />
            {dict.common.previous}
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "outline", size: "xs" }), "pointer-events-none opacity-40")}>
            <ChevronLeftIcon />
            {dict.common.previous}
          </span>
        )}
        <span className="text-xs tabular-nums text-muted-foreground">
          {page} / {lastPage}
        </span>
        {page < lastPage ? (
          <Link href={href(page + 1)} className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>
            {dict.common.next}
            <ChevronRightIcon />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "outline", size: "xs" }), "pointer-events-none opacity-40")}>
            {dict.common.next}
            <ChevronRightIcon />
          </span>
        )}
      </div>
    </div>
  );
}
