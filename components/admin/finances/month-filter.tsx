"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";
import { useAdminI18n } from "@/lib/i18n/admin-client";
import { cn } from "@/lib/utils";

/**
 * Le mois d'UNE carte du panneau des revenus.
 *
 * Chaque carte porte le sien, sous son propre parametre (`mois`,
 * `mois-serie`, `mois-abonnements`, `mois-scout-days`) : on peut comparer
 * septembre dans une carte et octobre dans la suivante. Comme
 * `DashboardPeriod`, la page se recalcule cote serveur, d'ou le spinner —
 * sans lui le choix semblait sans effet pendant le recalcul.
 *
 * ⚠️ LES AUTRES PARAMETRES SONT CONSERVES, et c'est tout le soin de ce
 * composant. La file de paiements qui suit porte sa recherche, son statut et
 * sa page dans la meme adresse, **et les trois autres cartes portent leur
 * propre mois** : reconstruire la requete a partir du seul parametre modifie
 * les effacerait tous. `params` arrive deja `await searchParams` depuis la
 * page, comme pour `FilterBar` — une seule source de verite, pas
 * `useSearchParams()`.
 *
 * ⚠️ `page` N'EST PAS TOUCHEE : ce filtre ne porte que sur sa carte, pas sur
 * la file. La remettre a 1 deplacerait une liste que le geste ne concerne pas.
 */
export function FinanceMonthFilter({
  basePath,
  params,
  param,
  label,
  value,
  options,
  allOption = true,
  className,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  /** La cle d'URL de cette carte, et d'elle seule. */
  param: string;
  /** Intitule accessible : le select n'a pas d'etiquette visible. */
  label: string;
  /** Le mois courant de cette carte, ou "" pour « tous les mois ». */
  value: string;
  /** Les mois qui ont encaisse, du plus recent au plus ancien. */
  options: { value: string; label: string }[];
  /**
   * ⚠️ FAUX POUR LA CARTE DE TETE. « Tous les mois » n'y veut rien dire : un
   * cumul et une projection sont des grandeurs de mois. L'option ouvrirait un
   * choix dont la carte ne saurait quoi faire, et l'intitule mentirait sur ce
   * que le grand nombre compte.
   */
  allOption?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { dict } = useAdminI18n();
  const [pending, startTransition] = React.useTransition();

  function choose(month: string) {
    const next = new URLSearchParams();
    for (const [key, entry] of Object.entries(params)) {
      if (entry && key !== param) next.set(key, entry);
    }
    if (month) next.set(param, month);
    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false });
    });
  }

  return (
    // `div` et non `span` : `NativeSelect` enveloppe son `<select>` dans un
    // `div` positionne, qui n'a pas sa place dans un contenu de phrase.
    // ⚠️ `shrink-0` : mesure en main a 320 px, le select se laissait comprimer
    // a 94 px par la ligne de l'en-tete et affichait « octobre 20 ». Un
    // selecteur de mois qui tronque le mois ne selectionne plus rien de
    // lisible — il vaut mieux que la ligne passe a la ligne.
    <div className="inline-flex shrink-0 items-center gap-1.5" aria-busy={pending}>
      <Loader2Icon
        aria-hidden
        className={cn(
          "size-3.5 animate-spin text-brand transition-opacity",
          pending ? "opacity-100" : "opacity-0",
        )}
      />
      <NativeSelect
        aria-label={label}
        title={dict.finances.monthLabel}
        value={value}
        disabled={pending}
        onChange={(event) => choose(event.target.value)}
        className={cn(
          // Le select EST la pastille de periode de la carte : meme fond, meme
          // rayon, meme taille de texte. Une pastille en plus d'un select
          // repeterait la meme information deux fois dans un en-tete deja
          // court.
          "h-auto rounded-full border-0 bg-accent py-0.5 pr-7 pl-2 text-[0.6875rem] font-medium capitalize",
          className,
        )}
      >
        {allOption ? <option value="">{dict.finances.allMonths}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
