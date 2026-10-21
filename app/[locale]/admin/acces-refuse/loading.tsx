import { HeaderSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** L'ecran « droit manquant » : une tete de page et un seul panneau. Sans ce
 *  fichier il heritait du squelette du tableau de bord, et annoncait six
 *  tuiles pour une page qui n'en a aucune. */
export default function AccessDeniedLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
