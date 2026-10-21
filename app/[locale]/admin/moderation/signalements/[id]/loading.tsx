import { Skeleton } from "@/components/ui/skeleton";

/** Un signalement ouvert : le contenu vise a gauche, la decision a droite
 *  (`lg:grid-cols-3`). Cette page n'a pas de `PageHeader`. */
export default function ReportDetailLoading() {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
