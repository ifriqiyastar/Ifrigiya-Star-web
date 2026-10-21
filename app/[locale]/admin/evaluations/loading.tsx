import { HeaderSkeleton, TileRowSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Les evaluations : quatre tuiles, puis la liste et le formulaire de saisie
 *  sur sa colonne de 19 rem. */
export default function EvaluationsLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton />
      <TileRowSkeleton count={4} grid="grid-cols-2 gap-3 xl:grid-cols-4" radius="rounded-xl" bar />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  );
}
