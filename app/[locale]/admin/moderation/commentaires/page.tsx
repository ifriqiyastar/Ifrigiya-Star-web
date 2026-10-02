import type { Metadata } from "next";
import {
  CheckIcon,
  CornerDownRightIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
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
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { approveComment, approvePost, refuseComment, refusePost } from "@/lib/actions/content-validation";
import { setCommentDeleted, setCommentHidden, setPostDeleted, setPostHidden } from "@/lib/actions/moderation";
import { getAdminAccess, requirePermission } from "@/lib/auth";
import { CONTENT_MODERATION_STATUS } from "@/lib/labels";
import { COMMENT_COLUMNS, PAGE_SIZE, POST_COLUMNS, THREAD_COLUMNS, fetchContentReports, fetchPendingContent, hasModerationColumns, likeTerm, selectWithModeration, str } from "@/lib/queries/moderation-content";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import type { ThreadEntry } from "@/components/admin/post-preview-dialog";
import type { CommentRow, PostRow } from "@/lib/queries/moderation-content";
import { getAdminI18n } from "@/lib/i18n/admin";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Commentaires") };
}

export default async function ModerationCommentsPage({
  searchParams,
}: PageProps<"/[locale]/admin/moderation/commentaires">) {
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
        breadcrumb={[{ label: i18n.t("Moderation") }, { label: i18n.t("Commentaires") }]}
        title={i18n.t("Commentaires du fil")}
        description={i18n.t("Un commentaire se juge sur la publication qu'il vise : elle s'ouvre en popup, avec son fil, sans quitter cette liste. Le bandeau sous un commentaire dit ce qui le met en cause.")}
      />

      <ModerationFilters vue="commentaires" params={params} available={available} />

      <CommentsView params={params} canValidate={canValidate} />
    </>
  );
}

async function CommentsView({
  params,
  canValidate,
}: {
  params: Record<string, string | undefined>;
  canValidate: boolean;
}) {
  const i18n = await getAdminI18n();

  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const { rows, count, available } = await selectWithModeration<CommentRow>(
    "post_comments",
    COMMENT_COLUMNS,
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

  const pending = available
    ? await fetchPendingContent<CommentRow>("post_comments", COMMENT_COLUMNS)
    : [];


  /*
   * La publication que chaque commentaire vise — en UNE requete pour toute la
   * page, jamais une par ligne. C'est elle qui donne son sens au commentaire :
   * « bien joue » sous une annonce et « bien joue » sous une insulte ne se
   * moderent pas pareil, et l'ancien lien renvoyait vers l'onglet Publications
   * avec l'identifiant en **recherche plein texte** — un filtre qui porte sur
   * `content` et ne pouvait donc rien trouver.
   */
  const postIds = [...new Set([...rows, ...pending].map((row) => row.post_id))];
  const parents = postIds.length
    ? (
        await selectWithModeration<PostRow>("posts", POST_COLUMNS, (q) =>
          q.in("id", postIds),
        )
      ).rows
    : [];
  const parentById = new Map(parents.map((row) => [row.id, row]));

  // Ce qui met chaque commentaire en cause, pour la page entiere.
  const reports = await fetchContentReports(
    "commentaire",
    rows.map((row) => row.id),
  );

  /*
   * Le fil de discussion de chaque publication concernée — UNE requête pour
   * toute la page, jamais une par ligne.
   *
   * ⚠️ Elle est TOLÉRANTE À L'ÉCHEC : `parent_comment_id` vient de 0093, et sur
   * un projet sans la migration elle rend 42703. Le fil disparaît alors, la
   * page reste entière. Un confort de modération ne doit pas coûter l'écran.
   */
  const threadRows = postIds.length
    ? ((
        await (await createClient())
          .from("post_comments")
          .select(THREAD_COLUMNS)
          .in("post_id", postIds)
          .eq("is_deleted", false)
          .order("created_at", { ascending: true })
          .limit(500)
      ).data ?? [])
    : [];
  const threads = threadRows as unknown as CommentRow[];

  const profiles = await fetchProfilesByIds([
    ...rows.map((row) => row.author_id),
    ...pending.map((row) => row.author_id),
    // L'auteur de la publication n'est pas celui du commentaire.
    ...parents.map((row) => row.author_id),
    ...threads.map((row) => row.author_id),
    // Le decideur n'est qu'un identifiant sur la ligne.
    ...rows.map((row) => row.moderated_by).filter((id): id is string => Boolean(id)),
  ]);

  /** L'auteur et le début du commentaire auquel une réponse répond. */
  const parentCommentExcerpt = (parentId: string) => {
    const parent = threads.find((row) => row.id === parentId);
    if (!parent) return null;
    const author = displayName(profiles.get(parent.author_id), undefined, i18n.locale);
    const text = parent.content.trim();
    return `${author} — ${text.length > 120 ? `${text.slice(0, 120)}…` : text}`;
  };

  /**
   * Le fil d'une publication, **racine puis réponses**, exactement l'ordre que
   * `post_comments_list` rend côté mobile : un seul niveau (0093), donc un
   * simple regroupement suffit — aucune récursion.
   */
  const threadOf = (postId: string): ThreadEntry[] => {
    const rows = threads.filter((row) => row.post_id === postId);
    if (!rows.length) return [];
    const roots = rows.filter((row) => !row.parent_comment_id);
    const repliesOf = (rootId: string) =>
      rows.filter((row) => row.parent_comment_id === rootId);
    const entry = (row: CommentRow, isReply: boolean): ThreadEntry => {
      const author = profiles.get(row.author_id);
      return {
        id: row.id,
        authorId: row.author_id,
        authorName: displayName(author, undefined, i18n.locale),
        content: row.content,
        createdAt: row.created_at,
        isReply,
        moderationStatus: row.moderation_status,
        isHidden: row.is_hidden,
        isDeleted: row.is_deleted,
      };
    };
    return roots.flatMap((root) => [
      entry(root, false),
      ...repliesOf(root.id).map((reply) => entry(reply, true)),
    ]);
  };

  /**
   * Le declencheur « Voir la publication », ou rien.
   *
   * ⚠️ Rien, et pas un bouton inerte, quand la publication est introuvable :
   * supprimee, ou filtree par la RLS. Un bouton qui n'ouvre rien fait douter
   * de tout l'ecran — c'est la regle deja tenue pour les pastilles hors
   * terrain du selecteur de postes cote mobile.
   */
  const parentTrigger = (comment: CommentRow, size: "xs" | "sm" = "xs") => {
    const parent = parentById.get(comment.post_id);
    if (!parent) return null;
    const author = profiles.get(parent.author_id);
    return (
      <PostPreviewDialog
        post={previewOf(
          parent,
          author,
          displayName(author, undefined, i18n.locale),
          mediaUrlOf(parent),
        )}
        canValidate={canValidate && available}
        statusLabel={
          available && parent.moderation_status
            ? {
                label: i18n.labels.label(CONTENT_MODERATION_STATUS, parent.moderation_status),
                tone: i18n.labels.entry(CONTENT_MODERATION_STATUS, parent.moderation_status)
                  .tone as "warning" | "success" | "danger",
              }
            : undefined
        }
        onApprove={approvePost.bind(null, parent.id)}
        onRefuse={refusePost.bind(null, parent.id)}
        onToggleHidden={setPostHidden.bind(null, parent.id, !parent.is_hidden)}
        onToggleDeleted={setPostDeleted.bind(null, parent.id, !parent.is_deleted)}
        thread={threadOf(parent.id)}
        // C'est ce commentaire-là qu'on modère : la popup le surligne dans le
        // fil, sinon le modérateur doit le retrouver à la lecture.
        focusCommentId={comment.id}
        trigger={
          <Button size={size} variant="outline">
            <MessageSquareIcon />
            {comment.parent_comment_id ? i18n.t("Voir le fil") : i18n.t("Voir la publication")}
          </Button>
        }
      />
    );
  };

  return (
    <>
      {pending.length ? (
        <Panel highlighted>
          <PanelHeader
            icon={ShieldCheckIcon}
            title={i18n.t("Commentaires a valider ({0})", { "0": pending.length })}
            description={
              canValidate
                ? i18n.t("Un commentaire n'est visible que de son auteur tant qu'il n'est pas valide, et l'auteur de la publication n'en est prevenu qu'a ce moment-la.")
                : i18n.t("Seul un super administrateur peut valider ou refuser un commentaire.")
            }
          />
          <ul className="divide-y divide-border">
            {pending.map((row) => {
              const author = profiles.get(row.author_id);
              return (
                <li key={row.id} className="space-y-3 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <UserCell
                      name={displayName(author, undefined, i18n.locale)}
                      secondary={i18n.format.formatDateTime(row.created_at)}
                      avatarUrl={author?.avatar_url}
                      href={i18n.path(`/admin/utilisateurs/${row.author_id}`)}
                    />
                    <StatusPill tone="warning">{i18n.t("En attente de validation")}</StatusPill>
                  </div>

                  {/* ⚠️ Le parent AVANT le texte, parce que c'est lui qui donne
                      son sens au commentaire. Un modérateur qui lit « bien
                      joué » sans savoir sous quoi ne peut pas trancher. */}
                  {row.parent_comment_id ? (
                    <p className="ms-0 border-s-2 border-border ps-3 text-xs text-muted-foreground">
                      <span className="font-medium">{i18n.t("En réponse à")}</span>{" "}
                      {parentCommentExcerpt(row.parent_comment_id) ?? i18n.t("(commentaire introuvable)")}
                    </p>
                  ) : null}
                  <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm leading-relaxed whitespace-pre-line">
                    {row.content}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Le commentaire se juge sur la publication qu'il vise :
                        elle s'ouvre en popup, image comprise, sans quitter la
                        file. */}
                    {parentTrigger(row)}
                    {canValidate ? (
                      <>
                        <ActionButton action={approveComment.bind(null, row.id)}>
                          <CheckIcon />
                          {i18n.t("Valider")}
                        </ActionButton>
                        <RefuseContentDialog action={refuseComment.bind(null, row.id)} i18n={i18n} />
                      </>
                    ) : (
                      <StatusPill tone="warning">{i18n.t("Super administrateur requis")}</StatusPill>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

    <Panel>
      <PanelHeader title={i18n.t("Commentaires")} />
      {!rows.length ? (
        <EmptyState icon={MessageSquareIcon} title={i18n.t("Aucun commentaire")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t("Auteur")}</TableHead>
              <TableHead>{i18n.t("Commentaire")}</TableHead>
              <TableHead>{i18n.t("Etat")}</TableHead>
              <TableHead>{i18n.t("Publie le")}</TableHead>
              <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const author = profiles.get(row.author_id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={displayName(author, undefined, i18n.locale)}
                      secondary={author?.email}
                      avatarUrl={author?.avatar_url}
                      href={i18n.path(`/admin/utilisateurs/${row.author_id}`)}
                    />
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    {row.parent_comment_id ? (
                      <span className="mb-1 block text-xs text-muted-foreground">
                        <CornerDownRightIcon className="me-1 inline size-3" />
                        {parentCommentExcerpt(row.parent_comment_id) ??
                          i18n.t("(commentaire introuvable)")}
                      </span>
                    ) : null}
                    {row.content}
                    {/* Le bandeau vient APRES le texte ici, et avant devant
                        une publication. Dans une carte il tient au-dessus sans
                        gener ; dans une cellule de tableau il repousserait le
                        commentaire hors de l'alignement des autres colonnes.
                        Il reste dans tous les cas avant la colonne des
                        gestes. */}
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
                      // Sans cadre ici. La cellule du commentaire tombe a
                      // ~130 px des 768 px — le rail de 16rem devient fixe au
                      // meme point — et un panneau encadre y disputait la
                      // place au texte qu'il annote. L'icone et le libelle
                      // gras suffisent a le reperer dans une ligne de tableau.
                      className="mt-2 border-0 bg-transparent px-0 py-0"
                    />
                  </TableCell>
                  <TableCell>
                    {row.is_deleted ? (
                      <StatusPill tone="danger">{i18n.t("Supprime")}</StatusPill>
                    ) : available && row.moderation_status && row.moderation_status !== "approuve" ? (
                      <StatusPill
                        tone={i18n.labels.entry(CONTENT_MODERATION_STATUS, row.moderation_status).tone}
                      >
                        {i18n.labels.label(CONTENT_MODERATION_STATUS, row.moderation_status)}
                      </StatusPill>
                    ) : row.is_hidden ? (
                      <StatusPill tone="warning">{i18n.t("Masque")}</StatusPill>
                    ) : (
                      <StatusPill tone="success">{i18n.t("En ligne")}</StatusPill>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i18n.format.formatDate(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {/* Le contexte avant la decision : la publication visee
                          s'ouvre en popup depuis la liste comme depuis la
                          file. */}
                      {parentTrigger(row)}
                      {available && canValidate && row.moderation_status !== "approuve" ? (
                        <ActionButton action={approveComment.bind(null, row.id)}>
                          <CheckIcon />
                          {i18n.t("Valider")}
                        </ActionButton>
                      ) : null}
                      <ActionButton action={setCommentHidden.bind(null, row.id, !row.is_hidden)}>
                        {row.is_hidden ? i18n.t("Reafficher") : i18n.t("Masquer")}
                      </ActionButton>
                      <ActionButton
                        variant={row.is_deleted ? "outline" : "destructive"}
                        action={setCommentDeleted.bind(null, row.id, !row.is_deleted)}
                      >
                        {row.is_deleted ? i18n.t("Restaurer") : i18n.t("Supprimer")}
                      </ActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Pagination basePath={i18n.path("/admin/moderation/commentaires")} params={params} page={page} pageSize={PAGE_SIZE} total={count} />
    </Panel>
    </>
  );
}

