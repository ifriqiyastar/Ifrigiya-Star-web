import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  ImageIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  Trash2Icon,
  Undo2Icon,
  VideoIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { ContentWhy, ModerationFilters, RefuseContentDialog, mediaUrlOf, previewOf } from "@/components/admin/moderation/pieces";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { PostPreviewDialog } from "@/components/admin/post-preview-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { Button, buttonVariants } from "@/components/ui/button";
import { approvePost, refusePost } from "@/lib/actions/content-validation";
import { setPostDeleted, setPostHidden } from "@/lib/actions/moderation";
import { getAdminAccess, requirePermission } from "@/lib/auth";
import { CONTENT_MODERATION_STATUS } from "@/lib/labels";
import { PAGE_SIZE, POST_COLUMNS, fetchContentReports, fetchPendingContent, hasModerationColumns, likeTerm, selectWithModeration, str } from "@/lib/queries/moderation-content";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { cn } from "@/lib/utils";
import type { PostRow } from "@/lib/queries/moderation-content";
import { getAdminI18n } from "@/lib/i18n/admin";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Publications") };
}

export default async function ModerationPostsPage({
  searchParams,
}: PageProps<"/[locale]/admin/moderation/publications">) {
  const i18n = await getAdminI18n();
  const admin = await requirePermission("moderation.manage");
  // §9 / migration 0089 : valider une publication ou un commentaire est un
  // geste distinct de la validation d'un retrait, et il a sa propre
  // permission (`content.validate`, super administrateur uniquement).
  const { permissions } = await getAdminAccess(admin.userId);
  const canValidate = permissions.includes("content.validate");

  const resolved = await searchParams;
  const params = {
    q: str(resolved.q),
    etat: str(resolved.etat),
    page: str(resolved.page),
  };
  const available = await hasModerationColumns();

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: i18n.t("Moderation") }, { label: i18n.t("Publications") }]}
        title={i18n.t("Publications du fil d'actualite")}
        description={i18n.t("La liste montre tout le fil, du plus recent au plus ancien : la moderation y est reactive, pas systematique. Le bandeau sous une publication dit ce qui la met en cause — un signalement, un refus motive — et son absence veut dire que rien ne la vise.")}
      />

      <ModerationFilters vue="publications" params={params} available={available} />

      <PostsView params={params} canValidate={canValidate} />
    </>
  );
}

async function PostsView({
  params,
  canValidate,
}: {
  params: Record<string, string | undefined>;
  canValidate: boolean;
}) {
  const i18n = await getAdminI18n();

  const page = Math.max(1, Number(params.page ?? 1) || 1);

  // Le tri reste du plus recent au plus ancien — c'est l'ordre du fil cote
  // application, et le back-office n'a aucune raison d'en montrer un autre.
  const { rows, count, available } = await selectWithModeration<PostRow>(
    "posts",
    POST_COLUMNS,
    (q) => {
      let query = q
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (params.etat === "masque") query = query.eq("is_hidden", true);
      if (params.etat === "supprime") query = query.eq("is_deleted", true);
      if (params.etat === "en_ligne") query = query.eq("is_hidden", false).eq("is_deleted", false);
      if (params.etat === "attente") query = query.eq("moderation_status", "en_attente");
      if (params.etat === "refuse_validation") query = query.eq("moderation_status", "refuse");
      // « Validee » = une decision prise, pas un etat par defaut : on exige la
      // trace, sinon tout le contenu anterieur a 0089 — approuve d'office par
      // la migration — remonterait comme s'il avait ete examine.
      if (params.etat === "validee") {
        query = query.eq("moderation_status", "approuve").not("moderated_at", "is", null);
      }
      // Meme correction que sur les signalements : la recherche est un filtre
      // de la requete, pas un tri du resultat. Filtree apres `.range()`, elle
      // ne voyait que les vingt lignes de la page — et `count`, qui porte la
      // pagination et le pied de liste, ne la voyait pas du tout.
      if (params.q) query = query.ilike("content", likeTerm(params.q));
      return query;
    },
  );

  // File d'attente : independante des filtres de la liste, comme celle des
  // Scout Days. Le plus ancien en tete.
  const pending = available ? await fetchPendingContent<PostRow>("posts", POST_COLUMNS) : [];

  const profiles = await fetchProfilesByIds([
    ...rows.map((row) => row.author_id),
    ...pending.map((row) => row.author_id),
    // Le decideur n'est qu'un identifiant sur la ligne : il est resolu avec
    // les auteurs, dans la meme lecture.
    ...rows.map((row) => row.moderated_by).filter((id): id is string => Boolean(id)),
  ]);
  // Ce qui met chaque publication en cause, pour la page entiere.
  const reports = await fetchContentReports(
    "publication",
    rows.map((row) => row.id),
  );

  return (
    <>
      {/* §9 / migration 0089 — la file d'attente. Elle passe AVANT la liste :
          c'est le seul endroit de cet ecran ou quelque chose est bloque en
          attendant une decision. */}
      {pending.length ? (
        <Panel highlighted>
          <PanelHeader
            icon={ShieldCheckIcon}
            title={i18n.t("Publications a valider ({0})", { "0": pending.length })}
            description={
              canValidate
                ? i18n.t("Une publication deposee par un utilisateur arrive ici automatiquement et n'est visible que de son auteur, grisee. Valider la publie dans le fil ; refuser la laisse invisible et envoie le motif a son auteur, tel quel.")
                : i18n.t("Une publication deposee par un utilisateur arrive ici automatiquement. Seul un super administrateur peut la valider ou la refuser.")
            }
          />
          <ul className="divide-y divide-border">
            {pending.map((row) => {
              const author = profiles.get(row.author_id);
              const name = displayName(author, undefined, i18n.locale);
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <UserCell
                    name={name}
                    secondary={i18n.format.formatDateTime(row.created_at)}
                    avatarUrl={author?.avatar_url}
                    href={i18n.path(`/admin/utilisateurs/${row.author_id}`)}
                  />
                  {/* L'extrait suffit dans la file : c'est la popup qui montre
                      la publication en entier, et c'est elle qui porte les
                      gestes. Une file qui deroule chaque texte integral
                      s'allonge a proportion de ce qui attend. */}
                  <p className="min-w-40 flex-1 truncate text-sm text-muted-foreground">
                    {row.content?.trim() || i18n.t("(sans texte)")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="warning">{i18n.t("En attente de validation")}</StatusPill>
                    <PostPreviewDialog
                      post={previewOf(row, author, name, mediaUrlOf(row))}
                      canValidate={canValidate}
                      onApprove={approvePost.bind(null, row.id)}
                      onRefuse={refusePost.bind(null, row.id)}
                      onToggleHidden={setPostHidden.bind(null, row.id, !row.is_hidden)}
                      onToggleDeleted={setPostDeleted.bind(null, row.id, !row.is_deleted)}
                      statusLabel={{
                        label: i18n.labels.label(CONTENT_MODERATION_STATUS, "en_attente"),
                        tone: "warning",
                      }}
                      trigger={
                        <Button size="xs" variant="outline">
                          <EyeIcon />
                          {i18n.t("Examiner")}
                        </Button>
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

    <Panel>
      <PanelHeader
        title={i18n.t("Publications du fil d'actualite")}
        description={i18n.t("La liste montre tout le fil, du plus recent au plus ancien : la moderation y est reactive, pas systematique. Le bandeau sous une publication dit ce qui la met en cause — un signalement, un refus motive — et son absence veut dire que rien ne la vise.")}
      />
      {!rows.length ? (
        <EmptyState icon={MessageSquareIcon} title={i18n.t("Aucune publication")} />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const author = profiles.get(row.author_id);
            const name = displayName(author, undefined, i18n.locale);
            const mediaUrl = mediaUrlOf(row);

            return (
              <li key={row.id} className="space-y-3 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <UserCell
                    name={name}
                    secondary={i18n.format.formatDateTime(row.created_at)}
                    avatarUrl={author?.avatar_url}
                    href={i18n.path(`/admin/utilisateurs/${row.author_id}`)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {/* L'etat de validation passe AVANT le masquage : une
                        publication en attente n'a jamais ete « en ligne », et
                        l'annoncer ainsi serait faux. */}
                    {available && row.moderation_status && row.moderation_status !== "approuve" ? (
                      <StatusPill
                        tone={i18n.labels.entry(CONTENT_MODERATION_STATUS, row.moderation_status).tone}
                      >
                        {i18n.labels.label(CONTENT_MODERATION_STATUS, row.moderation_status)}
                      </StatusPill>
                    ) : null}
                    {row.is_hidden ? <StatusPill tone="warning">{i18n.t("Masquee")}</StatusPill> : null}
                    {row.is_deleted ? <StatusPill tone="danger">{i18n.t("Supprimee")}</StatusPill> : null}
                    {!row.is_hidden &&
                    !row.is_deleted &&
                    (!available || row.moderation_status === "approuve") ? (
                      <StatusPill tone="success">{i18n.t("En ligne")}</StatusPill>
                    ) : null}
                  </div>
                </div>

                <ContentWhy
                  report={reports.get(row.id)}
                  hidden={row.is_hidden}
                  moderationStatus={row.moderation_status}
                  moderationReason={row.moderation_reason}
                  moderatedBy={
                    row.moderated_by
                      ? displayName(profiles.get(row.moderated_by), undefined, i18n.locale)
                      : null
                  }
                  moderatedAt={row.moderated_at}
                />

                <p className="line-clamp-3 text-sm leading-relaxed whitespace-pre-line">
                  {row.content ?? i18n.t("(sans texte)")}
                </p>

                {mediaUrl && row.media_type !== "aucun" ? (
                  <Link
                    href={mediaUrl}
                    target="_blank"
                    className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                  >
                    {row.media_type === "video" ? <VideoIcon /> : <ImageIcon />}
                    {i18n.t("Ouvrir le media")}</Link>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {/* La popup porte tous les gestes ; les boutons ci-dessous
                      restent pour agir sans l'ouvrir, sur une ligne qu'on
                      reconnait deja. */}
                  <PostPreviewDialog
                    post={previewOf(row, author, name, mediaUrl)}
                    canValidate={canValidate && available}
                    onApprove={approvePost.bind(null, row.id)}
                    onRefuse={refusePost.bind(null, row.id)}
                    onToggleHidden={setPostHidden.bind(null, row.id, !row.is_hidden)}
                    onToggleDeleted={setPostDeleted.bind(null, row.id, !row.is_deleted)}
                    statusLabel={
                      available && row.moderation_status
                        ? {
                            label: i18n.labels.label(
                              CONTENT_MODERATION_STATUS,
                              row.moderation_status,
                            ),
                            tone: i18n.labels.entry(
                              CONTENT_MODERATION_STATUS,
                              row.moderation_status,
                            ).tone as "warning" | "success" | "danger",
                          }
                        : undefined
                    }
                    trigger={
                      <Button size="xs" variant="outline">
                        <EyeIcon />
                        {i18n.t("Examiner")}
                      </Button>
                    }
                  />
                  {/* Depuis la liste on peut aussi revenir sur un refus : un
                      contenu refuse par erreur n'a pas d'autre chemin de
                      repechage, son auteur ne pouvant que le supprimer. */}
                  {available && canValidate && row.moderation_status !== "approuve" ? (
                    <ActionButton action={approvePost.bind(null, row.id)}>
                      <CheckIcon />
                      {i18n.t("Valider")}
                    </ActionButton>
                  ) : null}
                  {available && canValidate && row.moderation_status === "approuve" ? (
                    <RefuseContentDialog action={refusePost.bind(null, row.id)} i18n={i18n} />
                  ) : null}
                  <ActionButton action={setPostHidden.bind(null, row.id, !row.is_hidden)}>
                    {row.is_hidden ? <EyeIcon /> : <EyeOffIcon />}
                    {row.is_hidden ? i18n.t("Reafficher") : i18n.t("Masquer")}
                  </ActionButton>
                  <ActionButton
                    variant={row.is_deleted ? "outline" : "destructive"}
                    action={setPostDeleted.bind(null, row.id, !row.is_deleted)}
                  >
                    {row.is_deleted ? <Undo2Icon /> : <Trash2Icon />}
                    {row.is_deleted ? i18n.t("Restaurer") : i18n.t("Supprimer")}
                  </ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination basePath={i18n.path("/admin/moderation/publications")} params={params} page={page} pageSize={PAGE_SIZE} total={count} />
    </Panel>
    </>
  );
}

