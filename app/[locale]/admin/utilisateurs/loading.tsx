import { ListScreenSkeleton } from "@/components/admin/skeletons";

/** L'annuaire : quatre tuiles `md:grid-cols-4`, la barre de filtres a quatre
 *  listes, puis la page de comptes — chaque ligne portant une identite. */
export default function UsersLoading() {
  return (
    <ListScreenSkeleton
      actions
      tiles={4}
      tilesGrid="grid-cols-2 gap-3 md:grid-cols-4"
      filters={4}
      rows={8}
    />
  );
}
