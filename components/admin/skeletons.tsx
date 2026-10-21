import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Les squelettes de chargement du back-office.
 *
 * POURQUOI UN JEU DE PIECES ET NON UN SEUL ECRAN. Il n'y avait qu'un
 * `app/[locale]/admin/loading.tsx`, et il servait de squelette a **tous** les
 * ecrans : un titre, quatre tuiles, un grand bloc. Or la moitie des ecrans
 * n'a pas de rangee de tuiles — une file de moderation, un dossier, un
 * formulaire de reglages — et ceux-la affichaient quatre tuiles qui
 * disparaissaient a l'arrivee de la donnee, en decalant toute la page. Un
 * squelette qui ne correspond pas est **pire** qu'un squelette sobre : il
 * annonce une mise en page, puis la dement.
 *
 * LA REGLE SUIVIE ICI : **on calque le mobilier, pas le contenu.** Les
 * classes de chrome sont celles des vrais composants — `rounded-lg border
 * border-border bg-card` pour `Panel` et `KpiTile`, `rounded-xl` pour
 * `StatCard`, l'en-tete de panneau a `border-b border-border/70 px-4 py-3`,
 * le pied de pagination a `border-t border-border px-4 py-3`. Ce qui varie
 * d'un chargement a l'autre (le nombre de lignes reellement trouvees, la
 * longueur d'un nom) n'est pas imite : une barre grise suffit, et personne ne
 * compte les lignes d'un squelette.
 *
 * ⚠️ `Skeleton` n'a **pas** d'arrondi par defaut (`components/ui/skeleton.tsx`
 * ne pose que `animate-pulse bg-muted`) : chaque appel doit donner le sien,
 * sans quoi on obtient des rectangles vifs au milieu d'une interface ou tout
 * est arrondi. L'ancien squelette posait `rounded-2xl` la ou `Panel` arrondit
 * a `rounded-lg` — deux rayons differents pour la meme carte.
 *
 * Tout est serveur et sans donnee : ces composants sont rendus dans un
 * `loading.tsx` ou une frontiere `<Suspense>`, donc avant toute requete.
 */

/** Une barre de texte. `h-3` ~ `text-xs`, `h-4` ~ `text-sm`. */
function Line({ className }: { className?: string }) {
  return <Skeleton className={cn("h-3 rounded-full", className)} />;
}

/**
 * La tete de page (`PageHeader`) : fil d'ariane en capitales, titre, phrase
 * de description, et les actions a droite quand l'ecran en a.
 */
export function HeaderSkeleton({
  actions = false,
  description = true,
  className,
}: {
  actions?: boolean;
  description?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <Line className="w-44" />
        {/* Memes hauteurs que le `h1` : text-[1.375rem] puis sm:text-[1.65rem]. */}
        <Skeleton className="h-7 w-64 rounded-lg sm:h-8 sm:w-80" />
        {description ? <Line className="w-full max-w-2xl" /> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:pt-1">
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Une rangee de tuiles d'indicateur.
 *
 * `grid` est passe par l'appelant parce qu'il change d'un ecran a l'autre et
 * que c'est precisement ce qu'il faut faire correspondre : le tableau de bord
 * compte six tuiles sur quatre colonnes, les Scout Days cinq sur cinq,
 * l'annuaire quatre. Une grille de secours differente de la vraie ferait
 * sauter la page d'une disposition a l'autre au moment ou la donnee arrive —
 * le defaut que ce fichier existe pour supprimer.
 */
export function TileRowSkeleton({
  count = 4,
  grid = "grid-cols-2 gap-3 lg:grid-cols-4",
  /** `StatCard` arrondit a `rounded-xl`, `KpiTile` a `rounded-lg`. */
  radius = "rounded-lg",
  /** `KpiTile` et `StatCard` dessinent une barre de proportion en pied. */
  bar = false,
}: {
  count?: number;
  grid?: string;
  radius?: "rounded-lg" | "rounded-xl";
  bar?: boolean;
}) {
  return (
    <section className={cn("grid", grid)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={cn("border border-border bg-card p-3", radius)}>
          <div className="flex items-start justify-between gap-2">
            <Line className="w-24" />
            <Skeleton className="size-4 shrink-0 rounded" />
          </div>
          <Skeleton className="mt-1.5 h-6 w-16 rounded-lg sm:h-7" />
          {bar ? <Skeleton className="mt-3 h-1 w-full rounded-full" /> : null}
        </div>
      ))}
    </section>
  );
}

/**
 * La barre de filtres (`FilterBar` / `AutoFilterForm`) : la recherche a
 * gauche, les listes deroulantes a droite.
 */
export function FilterSkeleton({
  selects = 3,
  /** Les files de validation dessinent la leur en `rounded-xl p-2.5`. */
  className,
}: {
  selects?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-stretch justify-between gap-3 rounded-lg border border-border bg-card p-3 lg:flex-row lg:items-center",
        className,
      )}
    >
      <Skeleton className="h-8 w-full rounded-lg lg:max-w-sm" />
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: selects }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Un panneau de liste : en-tete optionnel, lignes de tableau, pied de
 * pagination optionnel.
 *
 * Les lignes reprennent la geometrie de `TableCell` (`px-3 py-2.5`) et le
 * filet de `TableRow` (`border-b border-border/60`), pour que la hauteur du
 * bloc soit celle du tableau qu'il remplace et non une approximation.
 */
export function TableSkeleton({
  rows = 8,
  header = false,
  pagination = true,
  /** Premiere colonne large, comme une cellule d'identite (avatar + deux lignes). */
  identity = true,
}: {
  rows?: number;
  header?: boolean;
  pagination?: boolean;
  identity?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      {header ? (
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Skeleton className="mt-0.5 size-7 shrink-0 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-40 rounded" />
              <Line className="w-56" />
            </div>
          </div>
        </div>
      ) : null}

      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0"
        >
          {identity ? (
            <>
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40 max-w-[60%] rounded-full" />
                <Line className="w-24" />
              </div>
            </>
          ) : (
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-56 max-w-[70%] rounded-full" />
              <Line className="w-32" />
            </div>
          )}
          <Skeleton className="hidden h-5 w-20 shrink-0 rounded-full sm:block" />
          <Skeleton className="h-7 w-16 shrink-0 rounded-lg" />
        </div>
      ))}

      {pagination ? (
        <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Line className="w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Un panneau de formulaire : en-tete, puis des champs en deux colonnes. */
export function FormPanelSkeleton({
  fields = 4,
  className,
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="flex items-start gap-2.5 border-b border-border/70 px-4 py-3">
        <Skeleton className="mt-0.5 size-7 shrink-0 rounded-lg" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-44 rounded" />
          <Line className="w-64" />
        </div>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Line className="w-28" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="flex justify-end border-t border-border px-4 py-3">
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
    </section>
  );
}

/**
 * Les quatre tuiles de `ValidationMetrics`, partagees par les quatre files de
 * validation. Nommee plutot qu'ecrite a chaque appel : elle sert de repli a
 * `<Suspense>` dans les quatre pages **et** dans `validations/loading.tsx`,
 * et deux geometries qui divergent font exactement sauter la mise en page que
 * ce fichier existe pour stabiliser.
 */
export function ValidationMetricsSkeleton() {
  return <TileRowSkeleton count={4} grid="gap-3 md:grid-cols-2 xl:grid-cols-4" bar />;
}

/** Les trois cartes de rappel de `ValidationNotes` (`NoteCards`). */
export function ValidationNotesSkeleton() {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-28 rounded-xl" />
      ))}
    </section>
  );
}

/**
 * L'ecran de liste, forme la plus courante du back-office : tete de page,
 * rangee de tuiles facultative, filtres facultatifs, puis le tableau.
 */
export function ListScreenSkeleton({
  tiles = 0,
  tilesGrid,
  tilesRadius,
  filters = 0,
  rows = 8,
  actions = false,
  identity = true,
  panelHeader = false,
}: {
  tiles?: number;
  tilesGrid?: string;
  tilesRadius?: "rounded-lg" | "rounded-xl";
  /** Nombre de listes deroulantes. `0` = l'ecran n'a pas de barre de filtres. */
  filters?: number;
  rows?: number;
  actions?: boolean;
  identity?: boolean;
  panelHeader?: boolean;
}) {
  return (
    <div className="space-y-4">
      <HeaderSkeleton actions={actions} />
      {tiles ? (
        <TileRowSkeleton count={tiles} grid={tilesGrid} radius={tilesRadius} bar />
      ) : null}
      {filters ? <FilterSkeleton selects={filters} /> : null}
      <TableSkeleton rows={rows} identity={identity} header={panelHeader} />
    </div>
  );
}

/**
 * Le dossier d'un compte, d'un evenement ou d'un signalement : tete de page,
 * puis la colonne de detail et son rail lateral — la disposition
 * `xl:grid-cols-[minmax(0,1fr)_<rail>]` que partagent ces ecrans.
 */
export function DetailScreenSkeleton({ tiles = 0 }: { tiles?: number }) {
  return (
    <div className="space-y-4">
      <HeaderSkeleton actions />
      {tiles ? (
        <TileRowSkeleton count={tiles} grid="grid-cols-2 gap-3 lg:grid-cols-4" bar />
      ) : null}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <FormPanelSkeleton fields={6} />
          <TableSkeleton rows={4} pagination={false} identity={false} header />
        </div>
        <div className="space-y-4">
          <FormPanelSkeleton fields={2} />
          <FormPanelSkeleton fields={2} />
        </div>
      </div>
    </div>
  );
}
