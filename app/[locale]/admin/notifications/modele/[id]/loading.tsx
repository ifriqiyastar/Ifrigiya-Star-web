import { HeaderSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** L'editeur d'un modele d'e-mail : un formulaire et l'apercu du rendu. Sans
 *  ce fichier il heritait du squelette du catalogue, qui annonce des
 *  vignettes. */
export default function EmailTemplateEditorLoading() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton actions />
      <Skeleton className="h-[32rem] rounded-lg" />
    </div>
  );
}
