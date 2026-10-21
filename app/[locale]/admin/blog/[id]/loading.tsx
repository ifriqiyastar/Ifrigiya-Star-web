import { HeaderSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** L'editeur d'article : un seul grand formulaire, corps riche compris. */
export default function BlogEditorLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton actions />
      <Skeleton className="h-[32rem] rounded-lg" />
    </div>
  );
}
