import { FilterSkeleton, HeaderSkeleton, TableSkeleton } from "@/components/admin/skeletons";

/** Les quatre vues de moderation (signalements, publications, commentaires,
 *  medias) : pas de tuiles, une barre de filtres, un panneau titre. */
export default function ModerationLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton />
      <FilterSkeleton selects={3} />
      <TableSkeleton rows={8} header />
    </div>
  );
}
