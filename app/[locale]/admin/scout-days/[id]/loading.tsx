import { HeaderSkeleton, TileRowSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Un Scout Day ouvert : quatre tuiles, puis le detail et ses inscrits
 *  (`lg:grid-cols-3`). */
export default function ScoutDayDetailLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton actions />
      <TileRowSkeleton count={4} grid="grid-cols-2 gap-3 xl:grid-cols-4" radius="rounded-xl" bar />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
