import { Skeleton } from "@/components/ui/skeleton";

/**
 * Etat de chargement des pages admin. Toutes sont rendues a la demande (elles
 * lisent des cookies de session), donc ce squelette est ce que voit
 * l'utilisateur pendant la requete Supabase.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-3 w-full max-w-2xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
