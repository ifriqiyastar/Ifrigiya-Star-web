import type { Metadata } from "next";
import { EyeIcon, MessageSquareIcon, ShieldCheckIcon } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import {
  ContentWhy,
  ModerationFilters,
  mediaUrlOf,
  previewOf,
  whyLines,
} from "@/components/admin/moderation/pieces";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { PostPreviewDialog } from "@/components/admin/post-preview-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { buttonVariants } from "@/components/ui/button";
import { approvePost, refusePost } from "@/lib/actions/content-validation";
import { setPostDeleted, setPostHidden } from "@/lib/actions/moderation";
import { getAdminAccess, requirePermission } from "@/lib/auth";
import { CONTENT_MODERATION_STATUS } from "@/lib/labels";
import { PAGE_SIZE, POST_COLUMNS, fetchContentReports, fetchPendingContent, hasModerationColumns, likeTerm, selectWithModeration, str } from "@/lib/queries/moderation-content";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { signStorageUrls } from "@/lib/queries/signed-media";
import { createClient } from "@/lib/supabase/server";
import type { PostRow } from "@/lib/queries/moderation-content";
import { getAdminI18n } from "@/lib/i18n/admin";
import { cn } from "@/lib/utils";

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
  // Scout Days. Le plus recent en tete.
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

  // Les medias de la page sont signes en UNE demande, pour les popups.
  // `post-media` est prive (migration mobile 0051) : sans cela, l'image d'une
  // publication ouverte passe par `/admin/documents`, qui refait un controle
  // d'administration, signe, puis redirige. Une seule demande groupee par
  // rendu, gardee en memoire une heure — et c'est ce cache qui compte ici,
  // `AutoRefresh` rejouant la page toutes les 30 s : sans lui le jeton
  // changerait a chaque rendu et l'image serait retelechargee a chaque fois
  // qu'on rouvre la popup. Ce que la signature groupee ne couvre pas (adresse
  // externe, echec) retombe sur `mediaUrlOf()`, donc une signature ratee coute
  // la rapidite, pas l'image.
  const supabase = await createClient();
  const signed = await signStorageUrls(
    supabase,
    "post-media",
    [...rows, ...pending].map((row) => row.media_url),
  );
  const mediaOf = (row: PostRow) =>
    (row.media_url ? signed.get(row.media_url) : null) ?? mediaUrlOf(row);

  // Les bandeaux de mise en cause sont resolus ici, **avant** le rendu : la
  // ligne les dessine et la popup les recoit, et deux calculs separes
  // finiraient par ne plus dire la meme chose au meme endroit.
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
   * LE BOUTON QUI OUVRE LA PUBLICATION, ET RIEN D'AUTRE SUR LA LIGNE.
   *
   * La ligne a porte successivement cinq boutons de decision, puis une carte
   * d'apercu (vignette + extrait) servant de declencheur, puis un libelle
   * « Lire et decider » sous l'extrait. ⚠️ **Ce libelle se lisait comme une
   * suite du texte** : « scoot day aujourd hui !! » puis, juste dessous et
   * dans la meme colonne, « Lire et decider ». L'apercu lui-meme a ensuite
   * ete juge de trop (demande client) : un bloc de contenu empile sous
   * l'identite rallonge chaque ligne et brouille la lecture d'une liste qui
   * sert d'abord a reperer ce qui est signale. La ligne ne dit donc plus que
   * ce qui la qualifie — qui, quand, dans quel etat, ce qui la met en cause —
   * et **le contenu se lit dans la popup**, ou se prennent aussi les
   * decisions.
   *
   * ⚠️ C'est un `<button>` **du DOM**, pas le composant `Button` :
   * `PostPreviewDialog` le clone pour y poser `data-slot` et Base UI le
   * compose via `render`. Il porte les classes de `buttonVariants` pour avoir
   * l'allure des autres boutons sans en etre un.
   *
   * Il est ecrit une fois pour la file d'attente et pour la liste : deux
   * declencheurs divergeraient, comme les deux constructions de `previewOf`
   * que ce fichier a deja evitees.
   */
  const trigger = (
    <button type="button" className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>
      <EyeIcon />
      {i18n.t("Examiner")}
    </button>
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
                <li key={row.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <UserCell
                      name={name}
                      secondary={i18n.format.formatDateTime(row.created_at)}
                      avatarUrl={author?.avatar_url}
                      href={i18n.path(`/admin/utilisateurs/${row.author_id}`)}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone="warning">{i18n.t("En attente de validation")}</StatusPill>
                      <PostPreviewDialog
                        post={previewOf(row, author, name, mediaOf(row), {
                          createdAtLabel: i18n.format.formatDateTime(row.created_at),
                        })}
                        canValidate={canValidate}
                        onApprove={approvePost.bind(null, row.id)}
                        onRefuse={refusePost.bind(null, row.id)}
                        onToggleHidden={setPostHidden.bind(null, row.id, !row.is_hidden)}
                        onToggleDeleted={setPostDeleted.bind(null, row.id, !row.is_deleted)}
                        statusLabel={{
                          label: i18n.labels.label(CONTENT_MODERATION_STATUS, "en_attente"),
                          tone: "warning",
                        }}
                        trigger={trigger}
                      />
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
        title={i18n.t("Publications du fil d'actualite")}
        description={i18n.t("Tout le fil, du plus recent au plus ancien. La ligne dit qui a publie, quand, dans quel etat et ce qui la met en cause ; « Examiner » ouvre la publication entiere et porte les decisions.")}
      />
      {!rows.length ? (
        <EmptyState icon={MessageSquareIcon} title={i18n.t("Aucune publication")} />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const author = profiles.get(row.author_id);
            const name = displayName(author, undefined, i18n.locale);

            return (
              <li key={row.id} className="px-4 py-3.5 sm:px-5">
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
                    {/* ⚠️ PAS DE PASTILLE « En ligne » (demande client,
                        Oct 2026). Elle etait posee sur presque toutes les
                        lignes — c'est l'etat normal du fil — donc elle ne
                        distinguait rien et banalisait les trois pastilles qui,
                        elles, demandent un geste. L'etat normal est
                        l'**absence** de pastille ; le filtre « En ligne » du
                        bandeau reste le chemin pour ne lister que celles-la. */}
                    {/* ⚠️ LA LIGNE EST UN REGISTRE, PAS UNE SURFACE DE
                        DECISION. Elle portait jusqu'a cinq boutons — dont
                        « Supprimer » — pris sur un extrait de trois lignes,
                        soit une centaine de boutons sur une page de vingt
                        publications. C'est exactement ce qui avait ete corrige
                        sur le tableau des signalements : on ne tranche pas sur
                        un contenu qu'on ne voit pas en entier. Aucun geste
                        n'est perdu — la popup les porte tous, au-dessus de la
                        publication complete, de son media et de ce qui la met
                        en cause. */}
                    <PostPreviewDialog
                      post={previewOf(row, author, name, mediaOf(row), {
                        createdAtLabel: i18n.format.formatDateTime(row.created_at),
                        why: why.get(row.id),
                      })}
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
                      trigger={trigger}
                    />
                  </div>
                </div>

                {/* ⚠️ LA TRACE DE VALIDATION NE REMONTE PAS SUR LA LIGNE.
                    « Validee — 06/10/2026 10:51 par <adresse> » s'affichait
                    sous chaque publication approuvee, c'est-a-dire sous
                    l'immense majorite d'entre elles : un bandeau pose partout
                    ne signale plus rien, et il poussait vers le bas les deux
                    seules lignes qui demandent un regard (un signalement, un
                    refus motive). La trace n'est pas perdue — elle reste dans
                    la popup, qui est l'endroit ou l'on verifie *qui* a
                    tranche et *quand*, et le filtre « Validee » reste le
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
      <Pagination basePath={i18n.path("/admin/moderation/publications")} params={params} page={page} pageSize={PAGE_SIZE} total={count} />
    </Panel>
    </>
  );
}
