import { ListScreenSkeleton } from "@/components/admin/skeletons";

/** Les articles : quatre tuiles `md:grid-cols-4`, filtres, puis la liste. */
export default function BlogLoading() {
  return (
    <ListScreenSkeleton
      actions
      tiles={4}
      tilesGrid="grid-cols-2 gap-3 md:grid-cols-4"
      filters={3}
      rows={8}
      identity={false}
    />
  );
}
