import {
  FilterSkeleton,
  HeaderSkeleton,
  TableSkeleton,
  TileRowSkeleton,
} from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Les quatre files de validation (joueurs, professionnels, justificatifs,
 * identite) : elles partagent `ValidationMetrics`, `ValidationFilter` et
 * `ValidationNotes`, donc un seul squelette les sert toutes.
 *
 * La barre de filtres de ces ecrans est en `rounded-xl p-2.5`, pas en
 * `rounded-lg p-3` comme ailleurs — d'ou le `className`.
 */
export default function ValidationsLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton />
      <TileRowSkeleton count={4} grid="gap-3 md:grid-cols-2 xl:grid-cols-4" bar />
      <FilterSkeleton selects={2} className="rounded-xl p-2.5" />
      <TableSkeleton rows={8} />
      {/* `ValidationNotes` : trois cartes de rappel, `xl:grid-cols-3`. */}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </section>
    </div>
  );
}
