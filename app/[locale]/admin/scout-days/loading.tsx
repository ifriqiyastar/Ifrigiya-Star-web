import { ListScreenSkeleton } from "@/components/admin/skeletons";

/** Les Scout Days : cinq tuiles `xl:grid-cols-5`, filtres, puis la liste des
 *  evenements — les lignes ne portent pas d'avatar. */
export default function ScoutDaysLoading() {
  return (
    <ListScreenSkeleton
      actions
      tiles={5}
      tilesGrid="grid-cols-2 gap-3 xl:grid-cols-5"
      tilesRadius="rounded-xl"
      filters={3}
      rows={8}
      identity={false}
      panelHeader
    />
  );
}
