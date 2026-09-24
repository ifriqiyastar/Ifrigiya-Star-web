import { getAdminI18n } from "@/lib/i18n/admin";
import Link from "next/link";
import type { Metadata } from "next";
import {
  BanIcon,
  CheckIcon,
  CornerDownRightIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FileTextIcon,
  GavelIcon,
  FlagIcon,
  SearchIcon,
  ImageIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  ShieldCheckIcon,
  Trash2Icon,
  Undo2Icon,
  UserIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterBar } from "@/components/admin/filter-bar";
import { NoteCards } from "@/components/admin/note-cards";
import { HeaderMeta, PageHeader } from "@/components/admin/page-header";
import { Panel, PanelHeader } from "@/components/admin/panel";
import {
  PostPreviewDialog,
  type PreviewPost,
  type ThreadEntry,
} from "@/components/admin/post-preview-dialog";
import { Pagination } from "@/components/admin/pagination";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { RemovalProposalDialog } from "@/components/admin/removal-proposal-dialog";
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
  approveComment,
  approvePost,
  refuseComment,
  refusePost,
} from "@/lib/actions/content-validation";
import {
  confirmRemoval,
  deletePlayerPhoto,
  deletePlayerVideo,
  dismissReport,
  proposeRemoval,
  refuseRemoval,
  setCommentDeleted,
  setCommentHidden,
  setPostDeleted,
  setPostHidden,
} from "@/lib/actions/moderation";

import {
  ACCOUNT_TARGETS,
  QUARANTINABLE,
  removalConfirmation,
  removalOptions,
} from "@/lib/moderation-targets";
import {
  CONTENT_MODERATION_STATUS,
  MODERATION_ACTION,
  REPORTABLE_TYPE,
  REPORT_STATUS,
} from "@/lib/labels";
import { fetchBlockSignals, fetchReportTargets } from "@/lib/queries/moderation";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess, requirePermission } from "@/lib/auth";
import { privateStorageUrl, storageUrl } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Moderation") };
}

const VUES = ["signalements", "publications", "commentaires", "medias"] as const;
type Vue = (typeof VUES)[number];
const PAGE_SIZE = 20;

export default async function ModerationPage({ searchParams }: PageProps<"/[locale]/admin/moderation">) {
  const i18n = await getAdminI18n();

  const admin = await requirePermission("moderation.manage");
  // Valider un retrait est reserve au super administrateur (migration 0041) :
  // on cache le geste plutot que de laisser un moderateur decouvrir la regle
  // par un refus Postgres.
  const { permissions } = await getAdminAccess(admin.userId);
  const canValidate = permissions.includes("moderation.validate");
  // §9 / migration 0089 : valider une publication ou un commentaire est un
  // geste distinct de la validation d'un retrait, et il a sa propre
  // permission (`content.validate`, super administrateur uniquement).
  const canValidateContent = permissions.includes("content.validate");
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
    page: str(resolved.page),
    page_videos: str(resolved.page_videos),
    page_photos: str(resolved.page_photos),
  };

  const supabase = await createClient();
  const [pendingReports, toValidate, hiddenPosts, hiddenComments] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "en_attente"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "a_valider"),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("is_hidden", true),
    supabase
      .from("post_comments")
      .select("id", { count: "exact", head: true })
      .eq("is_hidden", true),
  ]);

  const openReports = (pendingReports.count ?? 0) + (toValidate.count ?? 0);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: i18n.t("Moderation") }, { label: i18n.t("Signalements et audit") }]}
        title={i18n.t("Moderation & securite des contenus")}
        meta={
          openReports > 0 ? (
            <HeaderMeta tone="danger" dot>
              {openReports}  {i18n.t("signalement")}{openReports > 1 ? "s" : ""}  {i18n.t("a instruire")}</HeaderMeta>
          ) : (
            <HeaderMeta>{i18n.t("File vide")}</HeaderMeta>
          )
        }
        description={i18n.t("Signalements, publications contestees, commentaires et medias joueurs. Masquer retire le contenu du flux public sans l'effacer : l'administration continue de le voir, ce qui est necessaire pour instruire.")}
      />

      {/* Centre de filtrage : onglets et filtres dans un meme bloc, comme la
          maquette. Les filtres sont un formulaire GET — l'etat vit dans l'URL,
          la page reste un Server Component. */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedNav
            basePath={i18n.path("/admin/moderation")}
            active={vue}
            params={params}
            className="rounded-lg bg-background p-1"
            segments={[
              {
                value: "signalements",
                label: i18n.t("Signalements"),
                count: openReports,
                icon: FlagIcon,
              },
              {
                value: "publications",
                label: i18n.t("Publications"),
                count: hiddenPosts.count ?? 0,
                icon: FileTextIcon,
              },
              {
                value: "commentaires",
                label: i18n.t("Commentaires"),
                count: hiddenComments.count ?? 0,
                icon: MessageSquareIcon,
              },
              { value: "medias", label: i18n.t("Medias joueurs"), icon: VideoIcon },
            ]}
          />
          {/* Un seul utilitaire : l'export du registre. Pas de « parametres
              d'alerte automatique » — rien ne surveille les signalements en
              dehors de cet ecran. */}
          <Link
            href={i18n.path(`/admin/moderation/export${
              params.statut || params.cible
                ? `?${new URLSearchParams(
                    Object.entries({ statut: params.statut, cible: params.cible }).filter(
                      (entry): entry is [string, string] => Boolean(entry[1]),
                    ),
                  )}`
                : ""
            }`)}
            title={i18n.t("Exporter le registre des signalements")}
            aria-label={i18n.t("Exporter le registre des signalements")}
            className="inline-flex size-8 items-center justify-center rounded-lg bg-accent text-muted-foreground hover:text-foreground"
          >
            <DownloadIcon className="size-4" />
          </Link>
        </div>

        {vue === "signalements" ? (
          /* ⚠️ LA GRILLE NE PASSE PLUS EN COLONNES A `md`, ET C'EST MESURE.
              `md` (768px) est **aussi** le point ou le rail de 16rem devient
              `fixed` : le contenu tombe de 608 a 480 px au moment precis ou la
              mise en page se decoupe en 12 colonnes. Les media queries lisent
              le **viewport**, pas le conteneur, donc `md:col-span-3` valait
              ~110 px — et le `<select>` qu'il porte tombait a **21 px**,
              mesure au navigateur. Deux colonnes jusqu'a `xl`, quatre ensuite.
              (`grid-cols-*` de Tailwind vaut `minmax(0,1fr)` : les pistes
              retrecissent sous leur contenu au lieu de deborder, donc le
              symptome est un controle ecrase et non une barre de defilement —
              c'est pourquoi il ne se voit pas en cherchant un debordement.) */
          <form
            method="get"
            className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2 xl:grid-cols-4"
          >
            <input type="hidden" name="vue" value="signalements" />
            <div className="flex min-w-0 items-center gap-2 rounded-lg bg-background px-3 py-1.5 sm:col-span-2">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder={i18n.t("Rechercher par motif…")}
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
              <kbd className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                {i18n.t("Entree")}</kbd>
            </div>
            <ModerationFilter
              name="statut"
              label={i18n.t("Statut")}
              value={params.statut}
              all={i18n.t("Tous les statuts")}
              options={i18n.labels.options(REPORT_STATUS)}
            />
            <ModerationFilter
              name="cible"
              label={i18n.t("Cible")}
              value={params.cible}
              all={i18n.t("Toutes cibles")}
              options={i18n.labels.options(REPORTABLE_TYPE)}
            />
          </form>
        ) : null}
      </section>

      {vue === "signalements" ? (
        <ReportsView params={params} canValidate={canValidate} />
      ) : null}
      {vue === "publications" ? <PostsView params={params} canValidate={canValidateContent} /> : null}
      {vue === "commentaires" ? <CommentsView params={params} canValidate={canValidateContent} /> : null}
      {vue === "medias" ? <MediaView params={params} /> : null}

      <NoteCards
        notes={[
          {
            icon: GavelIcon,
            title: i18n.t("Procedure de retrait immediat"),
            body: i18n.t("Quand un moderateur propose un retrait motive, la cible est mise en quarantaine dans la foulee la ou un indicateur reversible existe — elle quitte le flux public sans etre effacee. Seul un super administrateur confirme le retrait definitif ou rehabilite l'element. La regle est appliquee par la base de donnees, pas par cet ecran."),
          },
          {
            icon: ShieldCheckIcon,
            title: i18n.t("Ou vit la trace des decisions"),
            body: i18n.t("Le journal d'administration a ete retire a la demande du client : la trace n'est donc pas ailleurs, elle est sur le signalement lui-meme — qui a propose le retrait, quand, avec quel motif, qui a tranche et quand. C'est ce que reprend l'export du registre. Aucun gel automatique n'est declenche par un nombre de signalements : rien ne surveille la file en dehors de cet ecran."),
          },
          {
            icon: MessagesSquareIcon,
            title: i18n.t("Le fil de conversation reste ferme"),
            body: i18n.t("Un signalement depose depuis une messagerie indique sa provenance et le motif ecrit par le signaleur, jamais les messages echanges. La base l'autoriserait ; la regle du client est qu'on instruit sur le motif. Pour la meme raison, l'export du registre ne contient aucun contenu signale."),
          },
          {
            icon: BanIcon,
            title: i18n.t("Ce que suspendre un compte fait vraiment"),
            body: i18n.t("La suspension passe le profil metier a « suspendu » : au prochain demarrage, l'application lit ce statut et deconnecte l'utilisateur. La session deja ouverte, elle, continue — rien ne revoque les sessions actives, et ni la fiche de scouting ni les inscriptions Scout Day ne sont retirees automatiquement."),
          },
        ]}
      />
    </>
  );
}

/* -------------------------------------------------------------- signalements */

async function ReportsView({
  params,
  canValidate,
}: {
  params: Record<string, string | undefined>;
  canValidate: boolean;
}) {
  const i18n = await getAdminI18n();

  const supabase = await createClient();
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  let query = supabase
    .from("reports")
    .select(
      "id, reporter_id, target_type, target_id, reason, status, moderation_action, handled_by, handled_at, created_at, proposed_by, proposed_at, proposed_action, proposal_reason, decision_reason, quarantined, context_conversation_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (params.statut) query = query.eq("status", params.statut);
  if (params.cible) query = query.eq("target_type", params.cible);

  const { data, error, count } = await query;
  // Le dernier signalement arrive en tete, sans regroupement par statut : la
  // file se lit dans l'ordre ou elle se remplit. Les retraits a valider se
  // retrouvent par le filtre « Statut » et par le compteur de la navigation.
  const rows = data ?? [];
  const reportCounts = rows.reduce((counts, row) => {
    const targetKey = `${row.target_type}:${row.target_id}`;
    counts.set(targetKey, (counts.get(targetKey) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  // Le contenu vise, pas seulement son identifiant : un moderateur ne peut
  // pas instruire « Contenu 79540083-… ». On resout chaque cible dans sa
  // table, en une requete par type present dans la page.
  const targets = await fetchReportTargets(rows, i18n);

  // Combien de personnes ont bloque le compte vise : le seul indicateur de
  // recidive quand le signalement ne porte sur aucun contenu.
  const blocks = await fetchBlockSignals(
    rows
      .filter((row) => ACCOUNT_TARGETS.includes(row.target_type))
      .map((row) => row.target_id),
  );

  const profiles = await fetchProfilesByIds([
    ...rows.map((row) => row.reporter_id),
    ...rows.map((row) => row.target_id),
    ...rows.map((row) => row.proposed_by).filter(Boolean),
    ...rows.map((row) => row.handled_by).filter(Boolean),
    ...[...targets.values()].map((target) => target.authorId).filter(Boolean),
  ]);

  const visible = rows.filter((row) =>
    params.q ? row.reason?.toLowerCase().includes(params.q.toLowerCase()) : true,
  );

  return (
    <Panel>
      {/* Barre d'outils de la file : ce qu'elle contient, et la lecture des
          trois niveaux de priorite — qui sont **deduits** de donnees reelles,
          pas d'une colonne « severite » que le schema n'a pas. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-accent/50 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="micro-label">{i18n.t("File de traitement operationnelle")}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-[0.6875rem] font-bold text-brand tabular-nums">
            {visible.length}  {i18n.t("element(s) affiche(s)")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[0.6875rem] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive" />
            {i18n.t("Critique — retrait a valider")}</span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warning" />
            {i18n.t("Niveau 2 — signalements multiples")}</span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground" />
            {i18n.t("Niveau 1 — signalement isole")}</span>
        </div>
      </div>
      {error ? (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
          {i18n.t("Lecture impossible :")} {error.message}
        </p>
      ) : null}
      {!rows.length ? (
        <EmptyState
          icon={FlagIcon}
          title={i18n.t("Aucun signalement")}
          description={i18n.t("Rien a instruire avec ces criteres.")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t("Contenu signale")}</TableHead>
              <TableHead>{i18n.t("Auteur & identifiant")}</TableHead>
              <TableHead>{i18n.t("Motif du signalement")}</TableHead>
              <TableHead>{i18n.t("Priorite")}</TableHead>
              <TableHead>{i18n.t("Statut / horodatage")}</TableHead>
              <TableHead className="text-right">{i18n.t("Instruction & decision")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => {
                const reporter = profiles.get(row.reporter_id);
                const accountTarget = profiles.get(row.target_id);
                const content = targets.get(`${row.target_type}:${row.target_id}`);
                const contentAuthor = content?.authorId
                  ? profiles.get(content.authorId)
                  : accountTarget;
                const reportCount = reportCounts.get(`${row.target_type}:${row.target_id}`) ?? 1;
                const isAccount = ACCOUNT_TARGETS.includes(row.target_type);
                const block = blocks.get(row.target_id);
                // Un signalement de compte ne porte aucun contenu : la colonne
                // affichait « Contenu indisponible » pour chacun d'eux, ce qui
                // se lisait comme une erreur. Elle nomme le compte vise.
                const summary = isAccount
                  ? displayName(accountTarget, undefined, i18n.locale)
                  : (content?.excerpt ??
                    (content?.mediaUrl ? i18n.t("Publication en media") : i18n.t("Contenu indisponible")));
                // Pure et bon marche : calculee une fois, elle sert au libelle
                // du bouton et a sa confirmation.
                const removal = removalConfirmation(row.proposed_action, row.target_type, i18n);

                return (
                  <TableRow
                    key={row.id}
                    // Liseré lime sur un retrait en attente de decision : la
                    // pastille de statut porte toujours l'information, la
                    // couleur ne fait que la rendre reperable dans la file.
                    className={row.status === "a_valider" ? "row-flagged" : undefined}
                  >
                    {/* La vignette suffit a reconnaitre le contenu dans une
                        liste ; le detail est a un clic. */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {(isAccount ? accountTarget?.avatar_url : null) ??
                        (content?.mediaType === "photo" ? content.mediaUrl : null) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              (isAccount ? accountTarget?.avatar_url : content?.mediaUrl) ??
                              undefined
                            }
                            alt=""
                            className="size-10 shrink-0 rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                            {isAccount ? (
                              <UserIcon className="size-4" />
                            ) : content?.mediaType === "video" || content?.mediaType === "lien" ? (
                              <VideoIcon className="size-4" />
                            ) : (
                              <MessageSquareIcon className="size-4" />
                            )}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="max-w-64 truncate text-sm">{summary}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">
                              {i18n.labels.label(REPORTABLE_TYPE, row.target_type)}
                            </span>
                            {/* Deux indices qu'on ne peut pas lire dans le
                                motif : d'ou vient le signalement, et si
                                d'autres comptes ont deja coupe le contact. */}
                            {row.context_conversation_id ? (
                              <StatusPill tone="info">
                                <MessagesSquareIcon />
                                {i18n.t("Messagerie")}</StatusPill>
                            ) : null}
                            {block?.received ? (
                              <StatusPill tone="warning">
                                <BanIcon />
                                {block.received}  {i18n.t("blocage")}{block.received > 1 ? "s" : ""}
                              </StatusPill>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {contentAuthor ? (
                        <UserCell
                          name={displayName(contentAuthor, undefined, i18n.locale)}
                          secondary={contentAuthor.email}
                          avatarUrl={contentAuthor.avatar_url}
                          href={i18n.path(`/admin/utilisateurs/${content?.authorId ?? row.target_id}`)}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{i18n.t("Inconnu")}</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <p className="max-w-56 truncate text-sm">{row.reason}</p>
                      <span className="text-xs text-muted-foreground">
                        {i18n.t("par")} {displayName(reporter, undefined, i18n.locale)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusPill tone={i18n.labels.entry(REPORT_STATUS, row.status).tone}>
                          {i18n.labels.label(REPORT_STATUS, row.status)}
                        </StatusPill>
                        <span className="text-xs text-muted-foreground">
                          {i18n.format.timeAgo(row.created_at)}
                        </span>
                        {reportCount > 1 ? (
                          <StatusPill tone="warning">{reportCount}  {i18n.t("signalements")}</StatusPill>
                        ) : null}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {/* Le dossier a sa propre page, et non plus une
                            modale : la conversation qui motive un signalement
                            se lit en entier, et `DetailDialog` rend ses
                            enfants cote serveur — chaque fil aurait ete
                            charge pour les 200 lignes de la file. */}
                        <Link
                          href={i18n.path(`/admin/moderation/signalements/${row.id}`)}
                          className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                        >
                          <EyeIcon />
                          {i18n.t("Ouvrir le dossier")}</Link>

                        {row.status === "en_attente" ? (
                          <>
                            <RemovalProposalDialog
                              action={proposeRemoval.bind(null, row.id)}
                              options={removalOptions(row.target_type).map((value) => ({
                                value,
                                label: i18n.labels.label(MODERATION_ACTION, value),
                              }))}
                              quarantines={QUARANTINABLE.includes(row.target_type)}
                              trigger={
                                <Button variant="destructive" size="xs">
                                  <Trash2Icon />
                                  {i18n.t("Proposer le retrait")}</Button>
                              }
                            />
                            <ActionButton
                              action={dismissReport.bind(null, row.id)}
                              variant="ghost"
                            >
                              <XIcon />
                              {i18n.t("Classer")}</ActionButton>
                          </>
                        ) : null}

                        {row.status === "a_valider" && canValidate ? (
                          <>
                            {/* Le bouton dit ce qu'il fait — « Valider » ne
                                disait pas *quoi* — et la confirmation nomme la
                                consequence avant de l'appliquer. */}
                            <ActionButton
                              action={confirmRemoval.bind(null, row.id)}
                              variant={
                                row.proposed_action === "masque" ? "default" : "destructive"
                              }
                              confirm={removal}
                            >
                              <CheckIcon />
                              {removal.actionLabel}
                            </ActionButton>
                            <ReasonDialog
                              action={refuseRemoval.bind(null, row.id)}
                              trigger={
                                <Button variant="outline" size="xs">
                                  <EyeOffIcon />
                                  {i18n.t("Refuser")}</Button>
                              }
                              title={i18n.t("Refuser le retrait")}
                              description={i18n.t("Le contenu masque revient en ligne et le signalement est clos sans mesure. Le motif reste au journal des decisions.")}
                              label={i18n.t("Motif du refus")}
                              placeholder={i18n.t("Contenu conforme aux CGU, signalement abusif…")}
                              submitLabel={i18n.t("Refuser le retrait")}
                            />
                          </>
                        ) : null}

                        {row.status === "a_valider" && !canValidate ? (
                          <StatusPill tone="warning">{i18n.t("Super administrateur requis")}</StatusPill>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background/60 px-4 py-2 text-[0.6875rem] text-muted-foreground">
        <span>
          {visible.length}  {i18n.t("incident(s) affiche(s) sur")} {count ?? 0}  {i18n.t("repertorie(s)")}</span>
        {/* Vrai : `AutoRefresh`, monte par le layout, rejoue le Server
            Component toutes les trente secondes, sauf quand une decision est en
            cours de saisie. */}
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-brand" />
          {i18n.t("Actualisation automatique")}</span>
      </div>
      <Pagination basePath={i18n.path("/admin/moderation")} params={params} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </Panel>
  );
}


/* --------------------------------------------------------------- publications */


/* ------------------------------------------------- validation des contenus */

const POST_COLUMNS =
  "id, author_id, content, media_type, media_url, is_hidden, is_deleted, created_at";
const COMMENT_COLUMNS = "id, post_id, author_id, content, is_hidden, is_deleted, created_at";
/**
 * ⚠️ Les colonnes de 0093 sont demandées À PART. Les joindre à
 * `COMMENT_COLUMNS` ferait échouer toute la liste en `42703` sur un projet
 * où la migration n'est pas posée — le fil de discussion est un confort, il
 * ne doit pas coûter l'écran de modération.
 */
const THREAD_COLUMNS = `${COMMENT_COLUMNS}, parent_comment_id, moderation_status`;

type PostRow = {
  id: string;
  author_id: string;
  content: string | null;
  media_type: "aucun" | "photo" | "video" | "lien";
  media_url: string | null;
  is_hidden: boolean;
  is_deleted: boolean;
  created_at: string;
  moderation_status?: "en_attente" | "approuve" | "refuse";
  moderation_reason?: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  is_hidden: boolean;
  is_deleted: boolean;
  created_at: string;
  moderation_status?: "en_attente" | "approuve" | "refuse";
  moderation_reason?: string | null;
  /** 0093. Null pour un commentaire racine ; un seul niveau d'imbrication. */
  parent_comment_id?: string | null;
};

/**
 * Le fil d'une publication : la racine, ses réponses, et celle qu'on modère.
 *
 * ⚠️ **Un moderateur ne peut pas juger une reponse seule.** « Bien joue » sous
 * une annonce et « bien joue » sous une insulte ne se moderent pas pareil, et
 * la liste ne montrait que le texte de la reponse. C'est le meme raisonnement
 * qui a fait ouvrir la publication en popup ; il vaut a plus forte raison ici,
 * ou le contexte immediat est le commentaire parent.
 */
export type ThreadComment = {
  id: string;
  authorName: string;
  authorId: string;
  content: string;
  createdAt: string;
  isReply: boolean;
  moderationStatus?: "en_attente" | "approuve" | "refuse";
  isHidden: boolean;
  isDeleted: boolean;
};

/**
 * Lit une table du fil **avec** les colonnes de la migration 0089, et retombe
 * sans elles si la migration n'est pas appliquee.
 *
 * ⚠️ Demander une colonne absente fait echouer **toute** la requete en
 * `42703` : sans ce repli, la liste entiere des publications disparaitrait du
 * back-office le jour ou l'on deploie l'ecran avant la migration. C'est le
 * meme raisonnement qui fait que la page Scout Days ne demande pas les
 * colonnes de 0040 dans sa liste principale.
 *
 * `available` dit a l'appelant s'il peut afficher l'etat de validation — un
 * ecran qui rend une colonne vide et un ecran qui rend « tout est valide » se
 * ressemblent trop.
 */
/**
 * Le strict necessaire du constructeur de requete PostgREST : `build` ne fait
 * que chainer des filtres. Le decrire ainsi evite deux `any` — et surtout
 * evite de devoir nommer le type genere de supabase-js, que ce depot n'a pas.
 */
type FeedQuery<T> = PromiseLike<{
  data: T[] | null;
  count: number | null;
  error: { code?: string } | null;
}> & {
  order(column: string, options?: { ascending?: boolean }): FeedQuery<T>;
  range(from: number, to: number): FeedQuery<T>;
  eq(column: string, value: unknown): FeedQuery<T>;
  in(column: string, values: readonly unknown[]): FeedQuery<T>;
};

async function selectWithModeration<T>(
  table: "posts" | "post_comments",
  columns: string,
  build: (q: FeedQuery<T>) => FeedQuery<T>,
): Promise<{ rows: T[]; count: number; available: boolean }> {
  const supabase = await createClient();
  // Un seul emplacement de conversion, et il est assume : supabase-js infere
  // ses types depuis un schema genere que ce depot ne versionne pas.
  const query = (select: string) =>
    supabase.from(table).select(select, { count: "exact" }) as unknown as FeedQuery<T>;

  const withCols = await build(query(`${columns}, moderation_status, moderation_reason`));
  if (!withCols.error) {
    return { rows: withCols.data ?? [], count: withCols.count ?? 0, available: true };
  }
  if (withCols.error.code !== "42703") {
    return { rows: [], count: 0, available: true };
  }
  const plain = await build(query(columns));
  return { rows: plain.data ?? [], count: plain.count ?? 0, available: false };
}

/** La file d'attente d'une table du fil. Muette si 0089 n'est pas appliquee. */
async function fetchPendingContent<T>(
  table: "posts" | "post_comments",
  columns: string,
): Promise<T[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(table)
    .select(`${columns}, moderation_status`)
    .eq("moderation_status", "en_attente")
    .eq("is_deleted", false)
    // Le plus ancien en tete : c'est celui qui attend depuis le plus
    // longtemps, comme la file des Scout Days.
    .order("created_at", { ascending: true })
    .limit(50);
  return (data ?? []) as T[];
}

/** Le refus, cote interface : meme dialogue pour une publication et un commentaire. */
function RefuseContentDialog({
  action,
  i18n,
}: {
  action: (reason: string) => Promise<import("@/lib/actions/result").ActionResult>;
  i18n: Awaited<ReturnType<typeof getAdminI18n>>;
}) {
  return (
    <ReasonDialog
      action={action}
      trigger={
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
        >
          <XIcon className="size-3.5" />
          {i18n.t("Refuser")}
        </button>
      }
      title={i18n.t("Refuser ce contenu")}
      description={i18n.t("Le contenu reste invisible des autres utilisateurs. Son auteur recoit le motif en notification, tel quel.")}
      label={i18n.t("Motif du refus")}
      placeholder={i18n.t("Propos deplaces, coordonnees personnelles, hors sujet…")}
      submitLabel={i18n.t("Refuser le contenu")}
    />
  );
}

/**
 * Les donnees de la popup, construites au meme endroit pour la file d'attente
 * et pour la liste : deux constructions divergeraient au premier changement.
 */
function previewOf(
  row: PostRow,
  author: { id?: string; email?: string | null; avatar_url?: string | null } | undefined,
  name: string,
  mediaUrl: string | null,
): PreviewPost {
  return {
    id: row.id,
    content: row.content,
    mediaType: row.media_type,
    mediaUrl,
    createdAt: row.created_at,
    isHidden: row.is_hidden,
    isDeleted: row.is_deleted,
    moderationStatus: row.moderation_status,
    moderationReason: row.moderation_reason ?? null,
    author: {
      id: row.author_id,
      name,
      email: author?.email ?? null,
      avatarUrl: author?.avatar_url ?? null,
    },
  };
}

/**
 * L'URL servable du media d'une publication.
 *
 * ⚠️ La colonne porte tantot un chemin, tantot une URL **publique complete**
 * — et `post-media` est prive depuis la migration mobile 0051, donc cette URL
 * publique repond 400. C'est pour ca que ni la vignette de la liste, ni
 * l'image de la popup, ni « Ouvrir le media » ne montraient quoi que ce soit.
 * `storageUrl()` ramene les deux formes au chemin et passe par la route qui
 * signe avec la session administrateur.
 */
const mediaUrlOf = (row: PostRow) => storageUrl("post-media", row.media_url);

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
  const { rows: all, count, available } = await selectWithModeration<PostRow>(
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
      return query;
    },
  );

  // File d'attente : independante des filtres de la liste, comme celle des
  // Scout Days. Le plus ancien en tete.
  const pending = available ? await fetchPendingContent<PostRow>("posts", POST_COLUMNS) : [];

  const rows = all.filter((row) =>
    params.q ? row.content?.toLowerCase().includes(params.q.toLowerCase()) : true,
  );
  const profiles = await fetchProfilesByIds([
    ...rows.map((row) => row.author_id),
    ...pending.map((row) => row.author_id),
  ]);

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
        description={i18n.t("Le fil est un module secondaire du CDC : la moderation y est reactive plutot que systematique.")}
      />
      <FilterBar
        basePath={i18n.path("/admin/moderation")}
        params={params}
        searchPlaceholder={i18n.t("Rechercher dans le texte…")}
        filters={[
          {
            name: "etat",
            label: i18n.t("Etat"),
            options: [
              { value: "en_ligne", label: i18n.t("En ligne") },
              ...(available
                ? [
                    { value: "attente", label: i18n.t("En attente de validation") },
                    { value: "refuse_validation", label: i18n.t("Refusee") },
                  ]
                : []),
              { value: "masque", label: i18n.t("Masquee") },
              { value: "supprime", label: i18n.t("Supprimee") },
            ],
          },
        ]}
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
      <Pagination basePath={i18n.path("/admin/moderation")} params={params} page={page} pageSize={PAGE_SIZE} total={count} />
    </Panel>
    </>
  );
}

/* --------------------------------------------------------------- commentaires */

async function CommentsView({
  params,
  canValidate,
}: {
  params: Record<string, string | undefined>;
  canValidate: boolean;
}) {
  const i18n = await getAdminI18n();

  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const { rows: all, count, available } = await selectWithModeration<CommentRow>(
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
      return query;
    },
  );

  const pending = available
    ? await fetchPendingContent<CommentRow>("post_comments", COMMENT_COLUMNS)
    : [];

  const rows = all.filter((row) =>
    params.q ? row.content?.toLowerCase().includes(params.q.toLowerCase()) : true,
  );

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
      <FilterBar
        basePath={i18n.path("/admin/moderation")}
        params={params}
        searchPlaceholder={i18n.t("Rechercher dans les commentaires…")}
        filters={[
          {
            name: "etat",
            label: i18n.t("Etat"),
            options: [
              { value: "en_ligne", label: i18n.t("En ligne") },
              ...(available
                ? [
                    { value: "attente", label: i18n.t("En attente de validation") },
                    { value: "refuse_validation", label: i18n.t("Refuse") },
                  ]
                : []),
              { value: "masque", label: i18n.t("Masque") },
              { value: "supprime", label: i18n.t("Supprime") },
            ],
          },
        ]}
      />
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
      <Pagination basePath={i18n.path("/admin/moderation")} params={params} page={page} pageSize={PAGE_SIZE} total={count} />
    </Panel>
    </>
  );
}

/* --------------------------------------------------------------------- medias */

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
        <Pagination basePath={i18n.path("/admin/moderation")} params={params} page={videoPage} pageParam="page_videos" pageSize={PAGE_SIZE} total={videos.count ?? 0} />
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
        <Pagination basePath={i18n.path("/admin/moderation")} params={params} page={photoPage} pageParam="page_photos" pageSize={PAGE_SIZE} total={photos.count ?? 0} />
      </Panel>
    </>
  );
}

/** Liste de filtre de la maquette : intitule colle au `<select>` natif. */
function ModerationFilter({
  name,
  label: name_,
  value,
  all,
  options: choices,
}: {
  name: string;
  label: string;
  value?: string;
  all: string;
  options: { value: string; label: string }[];
}) {
  return (
    // `min-w-0` des deux cotes : sans lui, le libelle `whitespace-nowrap` et la
    // largeur intrinseque du `<select>` (celle de sa plus longue option) se
    // disputent une piste qui, elle, accepte de retrecir — et c'est le
    // `<select>` qui perd.
    <label className="flex min-w-0 items-center gap-2 rounded-lg bg-background px-3 py-1.5">
      <span className="micro-label shrink-0 whitespace-nowrap text-muted-foreground">
        {name_} :
      </span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="w-full min-w-0 cursor-pointer bg-transparent text-xs font-semibold outline-none"
      >
        <option value="">{all}</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
