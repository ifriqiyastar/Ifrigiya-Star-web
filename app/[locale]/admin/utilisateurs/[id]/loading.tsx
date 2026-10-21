import { HeaderSkeleton, TileRowSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Le dossier d'un compte : les onglets (`SegmentedNav`), la rangee de cinq
 *  tuiles, puis la colonne de detail et son rail — `lg:grid-cols-12`. */
export default function UserDetailLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton actions />
      <Skeleton className="h-9 w-full max-w-lg rounded-lg" />
      <TileRowSkeleton count={5} grid="grid-cols-2 gap-3 xl:grid-cols-5" radius="rounded-xl" bar />
      <div className="grid items-start gap-3 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <div className="space-y-3 lg:col-span-4">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
