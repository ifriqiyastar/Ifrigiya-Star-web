import { HeaderSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Les reglages de la plateforme : `lg:grid-cols-12`, le formulaire a gauche
 *  et son explication a droite. */
export default function SettingsLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-96 rounded-lg lg:col-span-7" />
        <Skeleton className="h-64 rounded-lg lg:col-span-5" />
      </div>
    </div>
  );
}
