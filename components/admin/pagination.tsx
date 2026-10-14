import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { LinkPendingIcon } from "@/components/admin/link-pending-icon";
import { buttonVariants } from "@/components/ui/button";
import { makeFormat } from "@/lib/format";
import { fill, getAdminDict, getAdminLocale } from "@/lib/i18n/admin";
import { cn } from "@/lib/utils";

/**
 * Pagination par liens (pas d'etat client) : `?page=n` sur la route courante.
 *
 * ⚠️ **`prefetch` est explicite, et il faut qu'il le reste.** Un ecran du
 * back-office est une route dynamique : par defaut (`auto`), Next ne
 * prefetche d'une route dynamique que le squelette jusqu'a la premiere
 * frontiere `loading.js` — donc la page voisine etait **toujours** entierement
 * calculee apres le clic, serveur compris. `prefetch` a `true` demande la
 * charge complete, donnees incluses : la page suivante est deja la quand on
 * clique.
 *
 * Deux choses a savoir avant de toucher a ceci :
 *
 *  * **le prefetch n'existe qu'en production** (regle de Next) — en
 *    `next dev`, « Suivant » reste aussi lent qu'avant, et s'y fier pour
 *    juger la vitesse est trompeur ;
 *  * une page prefetchee est servie depuis le cache client pendant
 *    `staleTimes.static`, **ramene a 30 s dans `next.config.ts`** pour cette
 *    raison precise : la valeur par defaut (5 min) aurait pu montrer une file
 *    vieille de cinq minutes au clic, et une file qui contredit la pastille
 *    de la cloche est exactement le defaut qu'`AutoRefresh` a ete ecrit pour
 *    corriger.
 */
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
    // Sur telephone le decompte passe au-dessus et les deux boutons se
    // partagent la largeur : empiles a droite d'un texte qui se replie, ils
    // se retrouvaient a cheval sur deux lignes, desalignes.
    <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-5">
      <p className="text-xs text-muted-foreground">
        {total === 0
          ? dict.common.noResult
          : fill(dict.common.range, {
              from: formatNumber(from),
              to: formatNumber(to),
              total: formatNumber(total),
            })}
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        {page > 1 ? (
          // `scroll={false}` : sans lui, chaque « Precedent / Suivant » ramenait
          // la fenetre en haut du document, et changer de page se lisait comme
          // un rechargement complet alors que seules les lignes changent. C'est
          // deja ce que font `FilterBar`, `AutoFilterForm` et le selecteur de
          // periode du tableau de bord ; la pagination etait le seul controle de
          // liste a ne pas le faire.
          //
          // `LinkPendingIcon` dit lequel des deux boutons travaille : une page
          // du back-office est rendue par le serveur, donc le clic reste sans
          // effet visible le temps de la requete.
          <Link
            href={href(page - 1)}
            prefetch
            scroll={false}
            className={cn(buttonVariants({ variant: "outline", size: "xs" }), "h-9 flex-1 sm:h-7 sm:flex-none")}
          >
            <ChevronLeftIcon />
            {dict.common.previous}
            <LinkPendingIcon />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "outline", size: "xs" }), "h-9 flex-1 pointer-events-none opacity-40 sm:h-7 sm:flex-none")}>
            <ChevronLeftIcon />
            {dict.common.previous}
          </span>
        )}
        <span className="text-xs tabular-nums text-muted-foreground">
          {page} / {lastPage}
        </span>
        {page < lastPage ? (
          <Link
            href={href(page + 1)}
            prefetch
            scroll={false}
            className={cn(buttonVariants({ variant: "outline", size: "xs" }), "h-9 flex-1 sm:h-7 sm:flex-none")}
          >
            {dict.common.next}
            <ChevronRightIcon />
            <LinkPendingIcon />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "outline", size: "xs" }), "h-9 flex-1 pointer-events-none opacity-40 sm:h-7 sm:flex-none")}>
            {dict.common.next}
            <ChevronRightIcon />
          </span>
        )}
      </div>
    </div>
  );
}
