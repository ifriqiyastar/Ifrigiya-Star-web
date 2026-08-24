import Link from "next/link";
import type { Metadata } from "next";
import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  FlagIcon,
  ImageIcon,
  MessageSquareIcon,
  Trash2Icon,
  Undo2Icon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { SegmentedNav } from "@/components/admin/segmented-nav";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deletePlayerPhoto,
  deletePlayerVideo,
  resolveReport,
  setCommentDeleted,
  setCommentHidden,
  setPostDeleted,
  setPostHidden,
  suspendUser,
} from "@/lib/actions/moderation";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";
import {
  MODERATION_ACTION,
  REPORTABLE_TYPE,
  REPORT_STATUS,
  entry,
  label,
  options,
} from "@/lib/labels";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { publicStorageUrl } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Moderation" };

const VUES = ["signalements", "publications", "commentaires", "medias"] as const;
type Vue = (typeof VUES)[number];

export default async function ModerationPage({ searchParams }: PageProps<"/admin/moderation">) {
  await requirePermission("moderation.manage");
  const resolved = await searchParams;
  const requested = typeof resolved.vue === "string" ? resolved.vue : "signalements";
  const vue: Vue = (VUES as readonly string[]).includes(requested)
    ? (requested as Vue)
    : "signalements";

  const params = {
    vue: typeof resolved.vue === "string" ? resolved.vue : undefined,
    q: str(resolved.q),
    statut: str(resolved.statut),
    cible: str(resolved.cible),
    etat: str(resolved.etat),
  };

  const supabase = await createClient();
  const [pendingReports, hiddenPosts, hiddenComments] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "en_attente"),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("is_hidden", true),
    supabase
      .from("post_comments")
      .select("id", { count: "exact", head: true })
      .eq("is_hidden", true),
  ]);

  return (
    <>
      <PageHeader
        kicker="Moderation"
        title="Moderation des contenus"
        description="Signalements, publications, commentaires et medias. Masquer retire le contenu du fil sans l'effacer : l'administration continue de le voir, ce qui est necessaire pour instruire un signalement."
      />

      <SegmentedNav
        basePath="/admin/moderation"
        active={vue}
        params={params}
        segments={[
          { value: "signalements", label: "Signalements", count: pendingReports.count ?? 0 },
          { value: "publications", label: "Publications", count: hiddenPosts.count ?? 0 },
          { value: "commentaires", label: "Commentaires", count: hiddenComments.count ?? 0 },
          { value: "medias", label: "Medias joueurs" },
        ]}
      />

      {vue === "signalements" ? <ReportsView params={params} /> : null}
      {vue === "publications" ? <PostsView params={params} /> : null}
      {vue === "commentaires" ? <CommentsView params={params} /> : null}
      {vue === "medias" ? <MediaView /> : null}
    </>
  );
}

/* -------------------------------------------------------------- signalements */

async function ReportsView({ params }: { params: Record<string, string | undefined> }) {
  const supabase = await createClient();

  let query = supabase
    .from("reports")
    .select(
      "id, reporter_id, target_type, target_id, reason, status, moderation_action, handled_by, handled_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.statut) query = query.eq("status", params.statut);
  if (params.cible) query = query.eq("target_type", params.cible);

  const { data, error } = await query;
  const rows = data ?? [];
  const reportCounts = rows.reduce((counts, row) => {
    const targetKey = `${row.target_type}:${row.target_id}`;
    counts.set(targetKey, (counts.get(targetKey) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const profiles = await fetchProfilesByIds([
    ...rows.map((row) => row.reporter_id),
    ...rows.map((row) => row.target_id),
  ]);

  return (
    <Panel>
      <PanelHeader
        title="Signalements"
        description="Traiter enregistre a la fois le statut et l'action de moderation retenue, pour que la table reste le journal des decisions."
      />
      <FilterBar
        basePath="/admin/moderation"
        params={params}
        searchPlaceholder="Rechercher un motif…"
        filters={[
          { name: "statut", label: "Statut", options: options(REPORT_STATUS) },
          { name: "cible", label: "Cible", options: options(REPORTABLE_TYPE) },
        ]}
      />
      {error ? (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
          Lecture impossible : {error.message}
        </p>
      ) : null}
      {!rows.length ? (
        <EmptyState
          icon={FlagIcon}
          title="Aucun signalement"
          description="Rien a instruire avec ces criteres."
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows
            .filter((row) =>
              params.q ? row.reason?.toLowerCase().includes(params.q.toLowerCase()) : true,
            )
            .map((row) => {
              const reporter = profiles.get(row.reporter_id);
              const target = profiles.get(row.target_id);
              const isUserTarget = Boolean(target);
              const reportCount = reportCounts.get(`${row.target_type}:${row.target_id}`) ?? 1;

              return (
                <li key={row.id} className="space-y-3 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="neutral">{label(REPORTABLE_TYPE, row.target_type)}</StatusPill>
                    <StatusPill tone={entry(REPORT_STATUS, row.status).tone}>
                      {label(REPORT_STATUS, row.status)}
                    </StatusPill>
                    {reportCount > 1 ? (
                      <StatusPill tone="warning">{reportCount} signalements lies</StatusPill>
                    ) : null}
                    {row.moderation_action !== "aucune" ? (
                      <StatusPill tone={entry(MODERATION_ACTION, row.moderation_action).tone}>
                        {label(MODERATION_ACTION, row.moderation_action)}
                      </StatusPill>
                    ) : null}
                    <span className="text-xs text-muted-foreground">{timeAgo(row.created_at)}</span>
                  </div>

                  <p className="text-sm leading-relaxed">{row.reason}</p>

                  <div className="grid gap-3 text-xs sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                        Signale par
                      </p>
                      <UserCell
                        name={displayName(reporter)}
                        secondary={reporter?.email}
                        avatarUrl={reporter?.avatar_url}
                        href={`/admin/utilisateurs/${row.reporter_id}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                        Cible
                      </p>
                      {isUserTarget ? (
                        <UserCell
                          name={displayName(target)}
                          secondary={target?.email}
                          avatarUrl={target?.avatar_url}
                          href={`/admin/utilisateurs/${row.target_id}`}
                        />
                      ) : (
                        <p className="text-muted-foreground">
                          Contenu <code className="text-[0.6875rem]">{row.target_id}</code>
                          <br />
                          Cette cible n&apos;est pas un compte : retrouvez-la dans l&apos;onglet
                          correspondant.
                        </p>
                      )}
                    </div>
                  </div>

                  {row.handled_at ? (
                    <p className="text-xs text-muted-foreground">
                      Traite le {formatDateTime(row.handled_at)}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      action={resolveReport.bind(null, row.id, "traite", "masque")}
                    >
                      <EyeOffIcon />
                      Traite — contenu masque
                    </ActionButton>
                    <ActionButton
                      action={resolveReport.bind(null, row.id, "traite", "supprime")}
                      variant="destructive"
                    >
                      <Trash2Icon />
                      Traite — contenu supprime
                    </ActionButton>
                    {isUserTarget ? (
                      <ReasonDialog
                        action={async (reason) => {
                          const result = await suspendUser(row.target_id, reason);
                          if (!result.ok) return result;
                          return resolveReport(row.id, "traite", "utilisateur_suspendu");
                        }}
                        trigger={
                          <Button variant="destructive" size="xs">
                            Suspendre l&apos;utilisateur
                          </Button>
                        }
                        title="Suspendre l'utilisateur signale"
                        description="Le compte est desactive, son profil metier passe au statut « suspendu » et le signalement est marque comme traite."
                        submitLabel="Suspendre"
                      />
                    ) : null}
                    <ActionButton
                      action={resolveReport.bind(null, row.id, "traite", "aucune")}
                      variant="secondary"
                    >
                      <CheckIcon />
                      Traite — sans action
                    </ActionButton>
                    <ActionButton
                      action={resolveReport.bind(null, row.id, "rejete", "aucune")}
                      variant="ghost"
                    >
                      <XIcon />
                      Rejeter
                    </ActionButton>
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </Panel>
  );
}

/* --------------------------------------------------------------- publications */

async function PostsView({ params }: { params: Record<string, string | undefined> }) {
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select("id, author_id, content, media_type, media_url, is_hidden, is_deleted, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (params.etat === "masque") query = query.eq("is_hidden", true);
  if (params.etat === "supprime") query = query.eq("is_deleted", true);
  if (params.etat === "en_ligne") query = query.eq("is_hidden", false).eq("is_deleted", false);

  const { data } = await query;
  const rows = (data ?? []).filter((row) =>
    params.q ? row.content?.toLowerCase().includes(params.q.toLowerCase()) : true,
  );
  const profiles = await fetchProfilesByIds(rows.map((row) => row.author_id));

  return (
    <Panel>
      <PanelHeader
        title="Publications du fil d'actualite"
        description="Le fil est un module secondaire du CDC : la moderation y est reactive plutot que systematique."
      />
      <FilterBar
        basePath="/admin/moderation"
        params={params}
        searchPlaceholder="Rechercher dans le texte…"
        filters={[
          {
            name: "etat",
            label: "Etat",
            options: [
              { value: "en_ligne", label: "En ligne" },
              { value: "masque", label: "Masquee" },
              { value: "supprime", label: "Supprimee" },
            ],
          },
        ]}
      />
      {!rows.length ? (
        <EmptyState icon={MessageSquareIcon} title="Aucune publication" />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const author = profiles.get(row.author_id);
            const mediaUrl =
              row.media_url && !row.media_url.startsWith("http")
                ? publicStorageUrl("post-media", row.media_url)
                : row.media_url;

            return (
              <li key={row.id} className="space-y-3 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <UserCell
                    name={displayName(author)}
                    secondary={formatDateTime(row.created_at)}
                    avatarUrl={author?.avatar_url}
                    href={`/admin/utilisateurs/${row.author_id}`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {row.is_hidden ? <StatusPill tone="warning">Masquee</StatusPill> : null}
                    {row.is_deleted ? <StatusPill tone="danger">Supprimee</StatusPill> : null}
                    {!row.is_hidden && !row.is_deleted ? (
                      <StatusPill tone="success">En ligne</StatusPill>
                    ) : null}
                  </div>
                </div>

                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {row.content ?? "(sans texte)"}
                </p>

                {mediaUrl && row.media_type !== "aucun" ? (
                  <Link
                    href={mediaUrl}
                    target="_blank"
                    className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                  >
                    {row.media_type === "video" ? <VideoIcon /> : <ImageIcon />}
                    Ouvrir le media
                  </Link>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <ActionButton action={setPostHidden.bind(null, row.id, !row.is_hidden)}>
                    {row.is_hidden ? <EyeIcon /> : <EyeOffIcon />}
                    {row.is_hidden ? "Reafficher" : "Masquer"}
                  </ActionButton>
                  <ActionButton
                    variant={row.is_deleted ? "outline" : "destructive"}
                    action={setPostDeleted.bind(null, row.id, !row.is_deleted)}
                  >
                    {row.is_deleted ? <Undo2Icon /> : <Trash2Icon />}
                    {row.is_deleted ? "Restaurer" : "Supprimer"}
                  </ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* --------------------------------------------------------------- commentaires */

async function CommentsView({ params }: { params: Record<string, string | undefined> }) {
  const supabase = await createClient();

  let query = supabase
    .from("post_comments")
    .select("id, post_id, author_id, content, is_hidden, is_deleted, created_at")
    .order("created_at", { ascending: false })
    .limit(150);

  if (params.etat === "masque") query = query.eq("is_hidden", true);
  if (params.etat === "supprime") query = query.eq("is_deleted", true);
  if (params.etat === "en_ligne") query = query.eq("is_hidden", false).eq("is_deleted", false);

  const { data } = await query;
  const rows = (data ?? []).filter((row) =>
    params.q ? row.content?.toLowerCase().includes(params.q.toLowerCase()) : true,
  );
  const profiles = await fetchProfilesByIds(rows.map((row) => row.author_id));

  return (
    <Panel>
      <PanelHeader title="Commentaires" />
      <FilterBar
        basePath="/admin/moderation"
        params={params}
        searchPlaceholder="Rechercher dans les commentaires…"
        filters={[
          {
            name: "etat",
            label: "Etat",
            options: [
              { value: "en_ligne", label: "En ligne" },
              { value: "masque", label: "Masque" },
              { value: "supprime", label: "Supprime" },
            ],
          },
        ]}
      />
      {!rows.length ? (
        <EmptyState icon={MessageSquareIcon} title="Aucun commentaire" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auteur</TableHead>
              <TableHead>Commentaire</TableHead>
              <TableHead>Etat</TableHead>
              <TableHead>Publie le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const author = profiles.get(row.author_id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={displayName(author)}
                      secondary={author?.email}
                      avatarUrl={author?.avatar_url}
                      href={`/admin/utilisateurs/${row.author_id}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">{row.content}</TableCell>
                  <TableCell>
                    {row.is_deleted ? (
                      <StatusPill tone="danger">Supprime</StatusPill>
                    ) : row.is_hidden ? (
                      <StatusPill tone="warning">Masque</StatusPill>
                    ) : (
                      <StatusPill tone="success">En ligne</StatusPill>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <ActionButton action={setCommentHidden.bind(null, row.id, !row.is_hidden)}>
                        {row.is_hidden ? "Reafficher" : "Masquer"}
                      </ActionButton>
                      <ActionButton
                        variant={row.is_deleted ? "outline" : "destructive"}
                        action={setCommentDeleted.bind(null, row.id, !row.is_deleted)}
                      >
                        {row.is_deleted ? "Restaurer" : "Supprimer"}
                      </ActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

/* --------------------------------------------------------------------- medias */

async function MediaView() {
  const supabase = await createClient();

  const [videos, photos] = await Promise.all([
    supabase
      .from("player_videos")
      .select("id, player_id, title, youtube_url, storage_path, thumbnail_url, created_at")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("player_photos")
      .select("id, player_id, storage_path, caption, created_at")
      .order("created_at", { ascending: false })
      .limit(48),
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
          title="Dernieres videos publiees"
          description="Suppression definitive : la ligne et le fichier du bucket sont retires ensemble."
        />
        {!videoRows.length ? (
          <EmptyState icon={VideoIcon} title="Aucune video" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joueur</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Ajoutee le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videoRows.map((row) => {
                const player = profiles.get(row.player_id);
                const url =
                  row.youtube_url ?? publicStorageUrl("player-videos", row.storage_path);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <UserCell
                        name={displayName(player)}
                        secondary={player?.email}
                        avatarUrl={player?.avatar_url}
                        href={`/admin/utilisateurs/${row.player_id}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-56 truncate">
                      {url ? (
                        <Link href={url} target="_blank" className="hover:text-brand">
                          {row.title ?? "Sans titre"}
                        </Link>
                      ) : (
                        (row.title ?? "Sans titre")
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={row.youtube_url ? "info" : "neutral"}>
                        {row.youtube_url ? "YouTube" : "Importee"}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionButton
                        variant="destructive"
                        action={deletePlayerVideo.bind(null, row.id)}
                        confirm={{
                          title: "Supprimer cette video",
                          description:
                            "La video et son fichier de stockage seront definitivement supprimes.",
                          actionLabel: "Supprimer",
                        }}
                      >
                        Supprimer
                      </ActionButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Dernieres photos publiees" />
        {!photoRows.length ? (
          <EmptyState icon={ImageIcon} title="Aucune photo" />
        ) : (
          <ul className="grid gap-3 px-4 py-5 sm:grid-cols-3 sm:px-5 lg:grid-cols-4 xl:grid-cols-6">
            {photoRows.map((row) => {
              const player = profiles.get(row.player_id);
              const url = publicStorageUrl("player-photos", row.storage_path);
              return (
                <li
                  key={row.id}
                  className="space-y-2 rounded-xl border border-border bg-background p-2"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={row.caption ?? "Photo de joueur"}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                  ) : null}
                  <Link
                    href={`/admin/utilisateurs/${row.player_id}`}
                    className="block truncate text-[0.6875rem] text-muted-foreground hover:text-foreground"
                  >
                    {displayName(player)}
                  </Link>
                  <ActionButton
                    variant="destructive"
                    className="w-full"
                    action={deletePlayerPhoto.bind(null, row.id)}
                    confirm={{
                      title: "Supprimer cette photo",
                      description: "La photo et son fichier de stockage seront supprimes.",
                      actionLabel: "Supprimer",
                    }}
                  >
                    Supprimer
                  </ActionButton>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
