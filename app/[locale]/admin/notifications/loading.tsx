import {
  FilterSkeleton,
  HeaderSkeleton,
  TableSkeleton,
  TileRowSkeleton,
} from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** La composition d'une notification : quatre tuiles de volumetrie, le
 *  compositeur, puis l'historique des campagnes. */
export default function NotificationsLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton actions />
      <TileRowSkeleton count={4} grid="grid-cols-2 gap-3 xl:grid-cols-4" radius="rounded-xl" bar />
      <Skeleton className="h-80 rounded-lg" />
      <FilterSkeleton selects={2} />
      <TableSkeleton rows={6} identity={false} header />
    </div>
  );
}
