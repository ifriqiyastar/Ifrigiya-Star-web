"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminI18n } from "@/lib/i18n/admin-client";
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
  const [pending, startTransition] = React.useTransition();
  const urlSearch = params[searchName] ?? "";
  const [search, setSearch] = React.useState(urlSearch);

  // La recherche suit l'URL quand elle change sans nous — « Reinitialiser »,
  // retour arriere. Mais pas quand c'est notre propre frappe qui revient : la
  // reponse a « abc » arrive pendant qu'on tape « abcd », et l'ecraser
  // mangerait la derniere lettre. `sent` retient ce que nous avons envoye.
  // Ajustement pendant le rendu (motif React d'un etat qui suit une prop),
  // pas dans un effet.
  const [sent, setSent] = React.useState(urlSearch);
  const [seenUrl, setSeenUrl] = React.useState(urlSearch);
  if (seenUrl !== urlSearch) {
    setSeenUrl(urlSearch);
    if (urlSearch !== sent) {
      setSearch(urlSearch);
      setSent(urlSearch);
    }
  }

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

  // `replace` et non `push` : sans rechargement, le champ garde le focus, et
  // chaque frappe ne laisse pas une entree dans l'historique.
  const navigate = React.useCallback(
    (changes: Record<string, string | null>) => {
      startTransition(() => router.replace(buildUrl(changes), { scroll: false }));
    },
    [buildUrl, router],
  );

  // La recherche s'applique seule, 300 ms apres la derniere frappe — il
  // fallait cliquer « Filtrer ». Entree part sans attendre.
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const submitSearch = (value: string) => {
    clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed === sent) return;
    setSent(trimmed);
    navigate({ [searchName]: trimmed || null });
  };

  const activeCount = filters.filter((filter) => params[filter.name]).length + (params[searchName] ? 1 : 0);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      <form
        role="search"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          submitSearch(search);
        }}
        className="flex w-full items-center gap-2 lg:max-w-sm"
      >
        <div className="relative flex-1">
          {/* La loupe cede la place a un spinner pendant le rechargement. */}
          {pending ? (
            <Loader2Icon className="pointer-events-none absolute top-1/2 left-0 size-3.5 -translate-y-1/2 animate-spin text-brand" />
          ) : (
            <SearchIcon className="pointer-events-none absolute top-1/2 left-0 size-3.5 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => submitSearch(value), 300);
            }}
            placeholder={searchPlaceholder ?? dict.common.searchPlaceholder}
            className="pl-6"
            aria-label={dict.common.search}
          />
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {/* La meme pastille que les filtres des autres ecrans (utilisateurs,
            moderation) : libelle en capitales colle a un `<select>` natif, dont
            la liste ouverte prend le style commun de `globals.css`. C'etait un
            `Select` de Base UI — bouton borde, fenetre d'options a part — si
            bien que les filtres ne se ressemblaient pas d'un ecran a l'autre. */}
        {filters.map((filter) => (
          <label
            key={filter.name}
            className="flex min-w-0 items-center gap-2 rounded-lg bg-background px-3 py-1.5"
          >
            <span className="micro-label shrink-0 whitespace-nowrap text-muted-foreground">
              {filter.label} :
            </span>
            <select
              name={filter.name}
              value={params[filter.name] ?? ""}
              onChange={(event) => navigate({ [filter.name]: event.target.value || null })}
              className={cn(
                "min-w-0 cursor-pointer bg-transparent text-xs font-semibold outline-none",
                params[filter.name] && "text-brand",
              )}
            >
              <option value="">{dict.common.all}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        {activeCount > 0 ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              clearTimeout(timer.current);
              setSearch("");
              setSent("");
              startTransition(() => router.replace(basePath, { scroll: false }));
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
