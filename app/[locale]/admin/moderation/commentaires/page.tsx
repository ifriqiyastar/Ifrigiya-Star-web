import type { Metadata } from "next";
import { EyeIcon, MessageSquareIcon, ShieldCheckIcon } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import { ContentWhy, ModerationFilters, commentPreviewOf, mediaUrlOf, previewOf, whyLines } from "@/components/admin/moderation/pieces";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { PostPreviewDialog } from "@/components/admin/post-preview-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { buttonVariants } from "@/components/ui/button";
import { approveComment, refuseComment } from "@/lib/actions/content-validation";
import { setCommentDeleted, setCommentHidden } from "@/lib/actions/moderation";
import { getAdminAccess, requirePermission } from "@/lib/auth";
import { CONTENT_MODERATION_STATUS } from "@/lib/labels";
import { COMMENT_COLUMNS, PAGE_SIZE, POST_COLUMNS, THREAD_COLUMNS, fetchContentReports, fetchPendingContent, hasModerationColumns, likeTerm, selectWithModeration, str } from "@/lib/queries/moderation-content";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import type { ThreadEntry } from "@/components/admin/post-preview-dialog";
import type { CommentRow, PostRow } from "@/lib/queries/moderation-content";
import { getAdminI18n } from "@/lib/i18n/admin";
import { cn } from "@/lib/utils";

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

  // Ce qui met chaque commentaire en cause, resolu avant le rendu : la ligne
  // le dessine et la popup le recoit, et deux calculs separes finiraient par
  // ne plus dire la meme chose au meme endroit.
  const why = new Map(
    await Promise.all(
      rows.map(
        async (row) =>
          [
            row.id,
            await whyLines({
              report: reports.get(row.id),
              hidden: row.is_hidden,
              moderationStatus: row.moderation_status,
              moderationReason: row.moderation_reason,
              moderatedBy: row.moderated_by
                ? displayName(profiles.get(row.moderated_by), undefined, i18n.locale)
                : null,
              moderatedAt: row.moderated_at,
            }),
          ] as const,
      ),
    ),
  );

  /**
   * LE BOUTON QUI OUVRE LE COMMENTAIRE.
   *
   * ⚠️ C'est un `<button>` **du DOM**, pas le composant `Button` :
   * `PostPreviewDialog` le clone pour y poser `data-slot` et Base UI le
   * compose via `render`. Meme declencheur que sur les publications, pour que
   * le meme geste porte le meme nom d'un ecran a l'autre.
   */
  const trigger = (
    <button type="button" className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>
      <EyeIcon />
      {i18n.t("Examiner")}
    </button>
  );

  /**
   * La popup d'un commentaire : LUI est le sujet, la publication est le
   * contexte.
   *
   * ⚠️⚠️ Jusqu'ici la popup ouverte depuis cet ecran portait les gestes **de
   * la publication** — valider, masquer, supprimer agissaient sur le billet,
   * pas sur le commentaire — et moderer le commentaire se faisait donc sur la
   * ligne, c'est-a-dire sur un texte tronque, sans son fil, exactement ce que
   * la popup existe pour eviter. Les quatre actions liees ci-dessous visent le
   * commentaire.
   *
   * ⚠️ Elle s'ouvre **meme quand la publication est introuvable** (supprimee,
   * ou filtree par la RLS) : auparavant le bouton disparaissait, ce qui
   * rendait le commentaire totalement inmoderable. La popup dit alors que la
   * publication manque — un dossier incomplet n'est pas un dossier absent.
   */
  const commentDialog = (row: CommentRow) => {
    const author = profiles.get(row.author_id);
    const parent = parentById.get(row.post_id);
    const parentAuthor = parent ? profiles.get(parent.author_id) : undefined;
    return (
      <PostPreviewDialog
        comment={commentPreviewOf(
          row,
          author,
          displayName(author, undefined, i18n.locale),
          {
            createdAtLabel: i18n.format.formatDateTime(row.created_at),
            why: why.get(row.id),
            replyTo: row.parent_comment_id
              ? (parentCommentExcerpt(row.parent_comment_id) ??
                i18n.t("(commentaire introuvable)"))
              : null,
          },
        )}
        post={
          parent
            ? previewOf(
                parent,
                parentAuthor,
                displayName(parentAuthor, undefined, i18n.locale),
                mediaUrlOf(parent),
              )
            : undefined
        }
        canValidate={canValidate && available}
        statusLabel={
          available && row.moderation_status
            ? {
                label: i18n.labels.label(CONTENT_MODERATION_STATUS, row.moderation_status),
                tone: i18n.labels.entry(CONTENT_MODERATION_STATUS, row.moderation_status)
                  .tone as "warning" | "success" | "danger",
              }
            : undefined
        }
        onApprove={approveComment.bind(null, row.id)}
        onRefuse={refuseComment.bind(null, row.id)}
        onToggleHidden={setCommentHidden.bind(null, row.id, !row.is_hidden)}
        onToggleDeleted={setCommentDeleted.bind(null, row.id, !row.is_deleted)}
        thread={parent ? threadOf(parent.id) : undefined}
        // C'est ce commentaire-la qu'on modere : la popup le surligne dans le
        // fil, sinon le moderateur doit le retrouver a la lecture.
        focusCommentId={row.id}
        trigger={trigger}
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
                <li key={row.id} className="px-4 py-3 sm:px-5">
                  {/* Meme ligne que sur les publications : qui, quand, dans
                      quel etat, et le bouton qui ouvre le dossier. Le texte du
                      commentaire, la publication qu'il vise et le fil entier
                      sont dans la popup — un commentaire se juge sur son
                      contexte, et une file qui deroule chaque texte s'allonge a
                      proportion de ce qui attend. */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <UserCell
                      name={displayName(author, undefined, i18n.locale)}
                      secondary={i18n.format.formatDateTime(row.created_at)}
                      avatarUrl={author?.avatar_url}
                      href={i18n.path(`/admin/utilisateurs/${row.author_id}`)}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone="warning">{i18n.t("En attente de validation")}</StatusPill>
                      {canValidate ? null : (
                        <StatusPill tone="neutral">
                          {i18n.t("Super administrateur requis")}
                        </StatusPill>
                      )}
                      {commentDialog(row)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

    <Panel>
      <PanelHeader
        icon={MessageSquareIcon}
        title={i18n.t("Commentaires")}
        description={i18n.t("Tout le fil, du plus recent au plus ancien. La ligne dit qui a commente, quand, dans quel etat et ce qui le met en cause ; « Examiner » ouvre le commentaire avec la publication qu'il vise, le fil complet et les decisions.")}
      />
      {!rows.length ? (
        <EmptyState icon={MessageSquareIcon} title={i18n.t("Aucun commentaire")} />
      ) : (
        /* ⚠️ UNE LISTE, PLUS UN TABLEAU — meme forme que les publications.
           Le tableau portait cinq colonnes dont le commentaire entier et
           quatre boutons de decision par ligne ; sa cellule de texte tombait a
           ~130 px a 768 px (le rail de 16rem devient fixe au meme point), ce
           qui ecrasait a la fois le texte et le bandeau de mise en cause. La
           ligne ne porte plus que ce qui qualifie le commentaire, et la popup
           porte le contenu, le contexte et les gestes. */
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const author = profiles.get(row.author_id);
            return (
              <li key={row.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <UserCell
                    name={displayName(author, undefined, i18n.locale)}
                    secondary={i18n.format.formatDateTime(row.created_at)}
                    avatarUrl={author?.avatar_url}
                    href={i18n.path(`/admin/utilisateurs/${row.author_id}`)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
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
                    ) : null}
                    {/* ⚠️ Pas de pastille « En ligne » : meme regle que sur les
                        publications — l'etat normal du fil est l'absence de
                        pastille, et le filtre « En ligne » reste le chemin
                        pour ne lister que ce qui est visible. */}
                    {commentDialog(row)}
                  </div>
                </div>

                {/* ⚠️ Comme sur les publications, la trace de validation ne
                    remonte pas ici : approuve est l'etat normal du fil, et un
                    bandeau pose sous chaque ligne ne signale plus rien. Elle
                    reste dans la popup, et le filtre « Validee » reste le
                    chemin pour retrouver ce qui a ete approuve. */}
                <ContentWhy
                  lines={(why.get(row.id) ?? []).filter((line) => line.kind !== "validation")}
                  hidden={row.is_hidden}
                  className="mt-2.5"
                />
              </li>
            );
          })}
        </ul>
      )}
      <Pagination basePath={i18n.path("/admin/moderation/commentaires")} params={params} page={page} pageSize={PAGE_SIZE} total={count} />
    </Panel>
    </>
  );
}

