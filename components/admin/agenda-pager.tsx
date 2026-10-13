"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { makeFormat } from "@/lib/format";
import { useAdminI18n } from "@/lib/i18n/admin-client";
import { fill } from "@/lib/i18n/admin-shared";
import { cn } from "@/lib/utils";

/**
 * Pagination **cote client** de l'agenda de telephone du calendrier.
 *
 * ⚠️ C'EST UNE EXCEPTION ASSUMEE A LA REGLE « l'etat de liste vit dans l'URL ».
 * Cette regle existe pour que la page reste un Server Component qui refait sa
 * requete — or il n'y a rien a refaire ici : le calendrier recoit **deja tous
 * les evenements du mois** pour dessiner la grille de bureau. Paginer par
 * l'URL rejouait donc toutes les requetes de l'ecran (les deux tableaux, les
 * compteurs, la grille) pour decouper un tableau deja en memoire, et
 * remplacait l'arbre entier a chaque « Suivant ». Ici seul ce bloc change.
 *
 * Les groupes de jours sont rendus **par le serveur** et passes en `children` :
 * rien de ce composant ne connait un evenement. Il ne fait que masquer les
 * groupes hors de la page courante, ce qui evite de serialiser titres, lieux et
 * libelles de statut vers le client.
 *
 * Les pages sont decoupees **sans couper un jour** : on empile des journees
 * entieres tant qu'on ne depasse pas `pageSize` evenements, avec au minimum une
 * journee par page. Une page compte donc environ huit evenements, jamais la
 * moitie d'un mardi.
 */
export function AgendaPager({
  counts,
  ids,
  pageSize,
  children,
}: {
  /** Nombre d'evenements de chaque groupe de jour, dans l'ordre d'affichage. */
  counts: number[];
  /** L'`id` de chaque groupe (`jour-YYYY-MM-DD`), pour retrouver une ancre. */
  ids: string[];
  pageSize: number;
  children: React.ReactNode;
}) {
  const { dict, locale } = useAdminI18n();
  // `fill()` plutot qu'un `replace` ecrit a la main : le gabarit
  // (« {from}–{to} sur {total} ») appartient au dictionnaire, et le recopier
  // ici le ferait diverger a la premiere retouche de la copie.
  const { formatNumber } = React.useMemo(() => makeFormat(locale), [locale]);
  const groups = React.Children.toArray(children);

  // Les pages, en indices de groupes. Recalculees seulement si le mois change.
  const pages = React.useMemo(() => {
    const result: number[][] = [];
    let current: number[] = [];
    let size = 0;
    counts.forEach((count, index) => {
      if (current.length && size + count > pageSize) {
        result.push(current);
        current = [];
        size = 0;
      }
      current.push(index);
      size += count;
    });
    if (current.length) result.push(current);
    return result.length ? result : [[]];
  }, [counts, pageSize]);

  const [page, setPage] = React.useState(1);

  // ⚠️ COMPARAISON PAR VALEUR, PAS PAR REFERENCE. `counts` et `ids` sont
  // reconstruits a chaque rendu serveur, et `AutoRefresh` en declenche un
  // toutes les trente secondes : comparer les tableaux par identite remettait
  // l'agenda en page 1 a chaque battement, sous les doigts de l'utilisateur.
  // La signature ne retient que les jours — si un evenement s'ajoute a une
  // journee deja listee, les bornes de page bougent mais on reste ou on est.
  const signature = ids.join("|");
  const [seen, setSeen] = React.useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setPage(1);
  }

  const current = Math.min(page, pages.length);
  const visible = new Set(pages[current - 1] ?? []);

  // Une ancre `#jour-…` peut viser un jour qui n'est pas sur la page affichee —
  // c'est le cas des que l'on touche une journee dans la grille compacte
  // au-dessus. On bascule sur la bonne page, puis on fait defiler.
  // ⚠️ `handled` evite de rejouer le saut a chaque rafraichissement. Cet effet
  // se relance toutes les trente secondes (nouvelles props, donc nouvelles
  // dependances) ; sans ce garde-fou il relisait le `#jour-…` encore present
  // dans l'URL et ramenait l'ecran sur une journee quittee depuis longtemps.
  const handled = React.useRef<string | null>(null);
  React.useEffect(() => {
    const jump = (forced: boolean) => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      if (!forced && handled.current === hash) return;
      handled.current = hash;
      const index = ids.indexOf(hash);
      if (index < 0) return;
      const target = pages.findIndex((group) => group.includes(index));
      if (target >= 0) setPage(target + 1);
      // Apres le rendu de la nouvelle page, sinon la cible est encore masquee
      // et `scrollIntoView` ne trouve rien a faire defiler.
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    };
    jump(false);
    const onHashChange = () => jump(true);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [ids, pages]);

  const before = (pages[current - 1]?.[0] ?? 0);
  const from = counts.slice(0, before).reduce((total, count) => total + count, 0) + 1;
  const to =
    from - 1 + (pages[current - 1] ?? []).reduce((total, index) => total + counts[index], 0);
  const total = counts.reduce((sum, count) => sum + count, 0);

  const step = cn(buttonVariants({ variant: "outline", size: "xs" }), "h-9 flex-1");

  return (
    <>
      <div className="flex flex-col gap-3">
        {groups.map((group, index) => (
          <div key={ids[index] ?? index} hidden={!visible.has(index)}>
            {group}
          </div>
        ))}
      </div>

      {pages.length > 1 ? (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            {fill(dict.common.range, {
              from: formatNumber(from),
              to: formatNumber(to),
              total: formatNumber(total),
            })}
          </p>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className={step}
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeftIcon />
              {dict.common.previous}
            </button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {current} / {pages.length}
            </span>
            <button
              type="button"
              className={step}
              disabled={current >= pages.length}
              onClick={() => setPage(current + 1)}
            >
              {dict.common.next}
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
