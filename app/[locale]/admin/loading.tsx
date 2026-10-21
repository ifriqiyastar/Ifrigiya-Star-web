import { HeaderSkeleton, TileRowSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Squelette du **tableau de bord** (`/admin`), et de lui seul.
 *
 * Il servait auparavant a tous les ecrans du back-office : un titre, quatre
 * tuiles, un grand bloc. Les ecrans sans rangee de tuiles — files de
 * moderation, dossiers, reglages — annoncaient donc quatre tuiles qui
 * disparaissaient a l'arrivee de la donnee, en decalant la page entiere.
 * Chaque section porte maintenant son propre `loading.tsx`, et celui-ci
 * reprend exactement l'anatomie du tableau de bord : six tuiles sur quatre
 * colonnes, puis la rangee 8 + 4 du graphe et de son resume, puis les deux
 * panneaux de pied.
 *
 * Il reste aussi le repli des rares routes qui n'en ont pas — elles ne
 * redirigent (`/admin/validations`, `/admin/moderation`, `/admin/finances`)
 * et n'affichent jamais rien.
 */
export default function AdminDashboardLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton actions />

      {/* Six tuiles, `grid-cols-2 gap-3 lg:grid-cols-4` : la grille de la
          page, sans quoi la mise en page saute au moment du remplacement. */}
      <TileRowSkeleton count={6} radius="rounded-xl" bar />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Skeleton className="h-80 rounded-lg lg:col-span-8" />
        <Skeleton className="h-80 rounded-lg lg:col-span-4" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    </div>
  );
}
