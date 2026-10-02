"use client";

import * as React from "react";
import { CheckIcon, Loader2Icon, SearchIcon, UserRoundIcon, XIcon } from "lucide-react";

import { initials } from "@/lib/format";
import { useAdminTranslations } from "@/lib/i18n/admin-client";
import { cn } from "@/lib/utils";

export type Account = { id: string; name: string; email: string | null; role: string };

/**
 * Choix d'un compte destinataire, par recherche.
 *
 * ⚠️ **Remplace un `<select>` natif de deux mille lignes.** Celui-ci ne se
 * parcourait pas — il fallait deviner l'ordre alphabetique et faire defiler —
 * et surtout il obligeait la page a serialiser deux mille comptes a chaque
 * ouverture, pour un choix qu'on fait rarement. La recherche interroge le
 * serveur au fil de la frappe et ne rend que ce qui s'affiche.
 *
 * ⚠️ La liste est un `role="listbox"` pilote a `aria-activedescendant` : le
 * focus reste dans le champ de saisie pendant qu'on parcourt aux fleches,
 * ce qui est le motif attendu d'une zone de recherche — deplacer le focus
 * sur chaque option couperait la frappe.
 */
export function AccountPicker({
  value,
  selected,
  onSelect,
  search,
  disabled,
}: {
  /** Identifiant retenu, ou chaine vide. */
  value: string;
  /** Le compte deja choisi, pour l'afficher sans le rechercher. */
  selected: Account | null;
  onSelect: (account: Account | null) => void;
  search: (query: string) => Promise<Account[]>;
  disabled?: boolean;
}) {
  const i18n = useAdminTranslations();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Account[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  // La recherche part apres une pause de frappe : une requete par touche
  // ferait dix allers-retours pour un nom de dix lettres.
  React.useEffect(() => {
    const term = query.trim();
    let cancelled = false;
    // ⚠️ Tout `setState` vit **dans** le minuteur, jamais dans le corps de
    // l'effet : `react-hooks` refuse le second (« cascading renders »), et il
    // a raison — l'indicateur de recherche doit s'allumer quand la requete
    // part, pas a chaque touche.
    const timer = setTimeout(() => {
      if (term.length < 2) {
        setResults([]);
        return;
      }
      setBusy(true);
      search(term)
        .then((rows) => {
          // Une reponse arrivee apres une frappe plus recente est perimee :
          // l'afficher ferait clignoter la liste vers un etat passe.
          if (cancelled) return;
          setResults(rows);
          setActive(0);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, search]);

  // Un clic hors du panneau le referme, comme tout menu.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (account: Account) => {
    onSelect(account);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      setActive((index) =>
        event.key === "ArrowDown"
          ? (index + 1) % results.length
          : (index - 1 + results.length) % results.length,
      );
      return;
    }
    if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      choose(results[active]);
      return;
    }
    if (event.key === "Escape") setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      {/* La valeur retenue voyage dans `FormData` sous le nom attendu par le
          Server Action : le composant n'en change pas le contrat. */}
      <input type="hidden" name="target_value" value={value} />

      {selected && !open ? (
        <div className="flex items-center gap-2 rounded-lg bg-background p-2">
          <Initials name={selected.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">{selected.name}</span>
            <span className="block truncate text-[0.625rem] text-muted-foreground">
              {[selected.email, selected.role].filter(Boolean).join(" · ")}
            </span>
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen(true)}
            className="h-7 shrink-0 rounded-md px-2 text-[0.6875rem] font-semibold text-brand hover:bg-accent"
          >
            {i18n.t("Changer")}
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-label={i18n.t("Retirer le compte choisi")}
            onClick={() => onSelect(null)}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            disabled={disabled}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder={i18n.t("Chercher un compte par nom ou adresse")}
            className="h-9 w-full rounded-lg bg-background pr-8 pl-8 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-brand"
          />
          {busy ? (
            <Loader2Icon className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      )}

      {open && !selected ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {query.trim().length < 2 ? (
            <p className="px-3 py-2.5 text-[0.6875rem] text-muted-foreground">
              {i18n.t("Tapez au moins deux caracteres.")}
            </p>
          ) : results.length ? (
            <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
              {results.map((account, index) => (
                <li key={account.id}>
                  <button
                    type="button"
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(account)}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-1.5 text-left",
                      index === active && "bg-accent",
                    )}
                  >
                    <Initials name={account.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{account.name}</span>
                      <span className="block truncate text-[0.625rem] text-muted-foreground">
                        {[account.email, account.role].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {account.id === value ? (
                      <CheckIcon className="size-3.5 shrink-0 text-brand" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2.5 text-[0.6875rem] text-muted-foreground">
              {busy ? i18n.t("Recherche en cours") : i18n.t("Aucun compte ne correspond.")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Pastille d'initiales : l'administration n'a pas la photo sous la main ici. */
function Initials({ name }: { name: string }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[0.5625rem] font-bold tracking-wider">
      {name ? initials(name) : <UserRoundIcon className="size-3.5" />}
    </span>
  );
}
