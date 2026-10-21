import { ListScreenSkeleton } from "@/components/admin/skeletons";

/** Les encaissements et les abonnements : meme anatomie — filtres puis une
 *  page d'ecritures, sans avatar. */
export default function FinancesLoading() {
  return <ListScreenSkeleton actions filters={3} rows={8} identity={false} panelHeader />;
}
