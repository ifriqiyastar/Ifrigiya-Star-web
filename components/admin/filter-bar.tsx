"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminI18n, useAdminTranslations } from "@/lib/i18n/admin-client";
import { cn } from "@/lib/utils";

export type FilterDef = {
  name: string;
  label: string;
  options: { value: string; label: string }[];
};

/**
 * Barre de recherche et de filtres. L'etat vit dans l'URL (`searchParams`) et
 * non dans le composant : la page reste un Server Component qui refait sa
 * requete, un filtre est partageable par lien, et le retour navigateur
 * fonctionne. `params` est passe par la page (deja `await searchParams`)
 * plutot que lu via `useSearchParams`, pour n'avoir qu'une source de verite.
 */
export function FilterBar({
  basePath,
  params,
  filters = [],
  searchName = "q",
  searchPlaceholder,
  className,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  filters?: FilterDef[];
  searchName?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const { dict } = useAdminI18n();
  const i18n = useAdminTranslations();
  const [search, setSearch] = React.useState(params[searchName] ?? "");

  const buildUrl = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value) next.set(key, value);
      }
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      // Tout changement de filtre ramene a la premiere page.
      next.delete("page");
      const query = next.toString();
      return query ? `${basePath}?${query}` : basePath;
    },
    [basePath, params],
  );

  const activeCount = filters.filter((filter) => params[filter.name]).length + (params[searchName] ? 1 : 0);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          router.push(buildUrl({ [searchName]: search.trim() || null }));
        }}
        className="flex w-full items-center gap-2 lg:max-w-sm"
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-0 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder ?? dict.common.searchPlaceholder}
            className="pl-6"
            aria-label={dict.common.search}
          />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          {dict.common.filter}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {filters.map((filter) => (
          <label key={filter.name} className="flex items-center gap-2">
            <span className="micro-label hidden text-muted-foreground sm:inline">
              {filter.label}
            </span>
            <Select
              items={[{ value: "__all", label: i18n.t("Tous") }, ...filter.options]}
              value={params[filter.name] ?? "__all"}
              onValueChange={(value) =>
                router.push(buildUrl({ [filter.name]: value === "__all" ? null : String(value) }))
              }
            >
              <SelectTrigger
                size="sm"
                className={cn(
                  "min-w-28 rounded-md",
                  params[filter.name] && "border-brand/40 text-brand",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{dict.common.all}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ))}

        {activeCount > 0 ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setSearch("");
              router.push(basePath);
            }}
          >
            <XIcon />
            {dict.common.reset}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
