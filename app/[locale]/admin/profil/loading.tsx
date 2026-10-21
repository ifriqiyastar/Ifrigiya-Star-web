import { HeaderSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Le compte de l'administrateur connecte : deux colonnes de panneaux
 *  (identite et mot de passe d'un cote, session et langue de l'autre). */
export default function ProfileLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
