import type { Metadata } from "next";
import Link from "next/link";
import {
  ImageIcon,
  VideoIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deletePlayerPhoto, deletePlayerVideo } from "@/lib/actions/moderation";
import { requirePermission } from "@/lib/auth";
import { PAGE_SIZE, str } from "@/lib/queries/moderation-content";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { privateStorageUrl, storageUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAdminI18n } from "@/lib/i18n/admin";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Medias joueurs") };
}

export default async function ModerationMediaPage({
  searchParams,
}: PageProps<"/[locale]/admin/moderation/medias">) {
  const i18n = await getAdminI18n();
  await requirePermission("moderation.manage");

  const resolved = await searchParams;
  const params = {
    page_videos: str(resolved.page_videos),
    page_photos: str(resolved.page_photos),
  };

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: i18n.t("Moderation") }, { label: i18n.t("Medias joueurs") }]}
        title={i18n.t("Medias joueurs")}
        description={i18n.t("Videos et photos deposees par les joueurs. Contrairement aux publications et aux commentaires, il n'y a pas d'indicateur reversible ici : supprimer retire la ligne et le fichier du stockage ensemble, definitivement.")}
      />

      <MediaView params={params} />
    </>
  );
}

async function MediaView({ params }: { params: Record<string, string | undefined> }) {
  const i18n = await getAdminI18n();

  const supabase = await createClient();
  const videoPage = Math.max(1, Number(params.page_videos ?? 1) || 1);
  const photoPage = Math.max(1, Number(params.page_photos ?? 1) || 1);

  const [videos, photos] = await Promise.all([
    supabase
      .from("player_videos")
      .select("id, player_id, title, youtube_url, storage_path, thumbnail_url, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((videoPage - 1) * PAGE_SIZE, videoPage * PAGE_SIZE - 1),
    supabase
      .from("player_photos")
      .select("id, player_id, storage_path, caption, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((photoPage - 1) * PAGE_SIZE, photoPage * PAGE_SIZE - 1),
  ]);

  const videoRows = videos.data ?? [];
  const photoRows = photos.data ?? [];
  const profiles = await fetchProfilesByIds([
    ...videoRows.map((row) => row.player_id),
    ...photoRows.map((row) => row.player_id),
  ]);

  return (
    <>
      <Panel>
        <PanelHeader
          title={i18n.t("Dernieres videos publiees")}
          description={i18n.t("Suppression definitive : la ligne et le fichier du bucket sont retires ensemble.")}
        />
        {!videoRows.length ? (
          <EmptyState icon={VideoIcon} title={i18n.t("Aucune video")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18n.t("Joueur")}</TableHead>
                <TableHead>{i18n.t("Titre")}</TableHead>
                <TableHead>{i18n.t("Source")}</TableHead>
                <TableHead>{i18n.t("Ajoutee le")}</TableHead>
                <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videoRows.map((row) => {
                const player = profiles.get(row.player_id);
                const url =
                  // `storageUrl` rend une adresse externe telle quelle : un lien
                  // YouTube n'a rien a signer.
                  row.youtube_url ?? storageUrl("player-videos", row.storage_path);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <UserCell
                        name={displayName(player, undefined, i18n.locale)}
                        secondary={player?.email}
                        avatarUrl={player?.avatar_url}
                        href={i18n.path(`/admin/utilisateurs/${row.player_id}`)}
                      />
                    </TableCell>
                    <TableCell className="max-w-56 truncate">
                      {url ? (
                        <Link href={url} target="_blank" className="hover:text-brand">
                          {row.title ?? i18n.t("Sans titre")}
                        </Link>
                      ) : (
                        (row.title ?? i18n.t("Sans titre"))
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={row.youtube_url ? "info" : "neutral"}>
                        {row.youtube_url ? "YouTube" : i18n.t("Importee")}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i18n.format.formatDate(row.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionButton
                        variant="destructive"
                        action={deletePlayerVideo.bind(null, row.id)}
                        confirm={{
                          title: i18n.t("Supprimer cette video"),
                          description:
                            i18n.t("La video et son fichier de stockage seront definitivement supprimes."),
                          actionLabel: i18n.t("Supprimer"),
                        }}
                      >
                        {i18n.t("Supprimer")}</ActionButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <Pagination basePath={i18n.path("/admin/moderation/medias")} params={params} page={videoPage} pageParam="page_videos" pageSize={PAGE_SIZE} total={videos.count ?? 0} />
      </Panel>

      <Panel>
        <PanelHeader title={i18n.t("Dernieres photos publiees")} />
        {!photoRows.length ? (
          <EmptyState icon={ImageIcon} title={i18n.t("Aucune photo")} />
        ) : (
          <ul className="grid gap-3 px-4 py-5 sm:grid-cols-3 sm:px-5 lg:grid-cols-4 xl:grid-cols-6">
            {photoRows.map((row) => {
              const player = profiles.get(row.player_id);
              const url = privateStorageUrl("player-photos", row.storage_path);
              return (
                <li
                  key={row.id}
                  className="space-y-2 rounded-xl border border-border bg-background p-2"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={row.caption ?? i18n.t("Photo de joueur")}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                  ) : null}
                  <Link
                    href={i18n.path(`/admin/utilisateurs/${row.player_id}`)}
                    className="block truncate text-[0.6875rem] text-muted-foreground hover:text-foreground"
                  >
                    {displayName(player, undefined, i18n.locale)}
                  </Link>
                  <ActionButton
                    variant="destructive"
                    className="w-full"
                    action={deletePlayerPhoto.bind(null, row.id)}
                    confirm={{
                      title: i18n.t("Supprimer cette photo"),
                      description: i18n.t("La photo et son fichier de stockage seront supprimes."),
                      actionLabel: i18n.t("Supprimer"),
                    }}
                  >
                    {i18n.t("Supprimer")}</ActionButton>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination basePath={i18n.path("/admin/moderation/medias")} params={params} page={photoPage} pageParam="page_photos" pageSize={PAGE_SIZE} total={photos.count ?? 0} />
      </Panel>
    </>
  );
}

