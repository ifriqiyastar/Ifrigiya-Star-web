import { HeaderSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Le catalogue de modeles d'e-mail : des vignettes, pas un tableau. */
export default function EmailTemplatesLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton actions />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-56 rounded-xl" />
        ))}
      </section>
    </div>
  );
}
