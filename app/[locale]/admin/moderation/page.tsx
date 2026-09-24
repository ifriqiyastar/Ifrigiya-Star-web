import { getAdminI18n } from "@/lib/i18n/admin";
import Link from "next/link";
import type { Metadata } from "next";
import {
  BanIcon,
  CheckIcon,
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
import { MODERATION_ACTION, REPORTABLE_TYPE, REPORT_STATUS } from "@/lib/labels";
import { fetchBlockSignals, fetchReportTargets } from "@/lib/queries/moderation";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess, requirePermission } from "@/lib/auth";
import { privateStorageUrl, publicStorageUrl } from "@/lib/supabase/config";
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
          <form method="get" className="grid grid-cols-1 items-center gap-2 md:grid-cols-12">
            <input type="hidden" name="vue" value="signalements" />
            <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-1.5 md:col-span-6">
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
      {vue === "publications" ? <PostsView params={params} /> : null}
      {vue === "commentaires" ? <CommentsView params={params} /> : null}
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
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          {isAccount ? (
                            <UserIcon className="size-4" />
                          ) : content?.mediaType === "video" || content?.mediaType === "lien" ? (
                            <VideoIcon className="size-4" />
                          ) : (
                            <MessageSquareIcon className="size-4" />
                          )}
                        </span>
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

async function PostsView({ params }: { params: Record<string, string | undefined> }) {
  const i18n = await getAdminI18n();

  const supabase = await createClient();
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  let query = supabase
    .from("posts")
    .select("id, author_id, content, media_type, media_url, is_hidden, is_deleted, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (params.etat === "masque") query = query.eq("is_hidden", true);
  if (params.etat === "supprime") query = query.eq("is_deleted", true);
  if (params.etat === "en_ligne") query = query.eq("is_hidden", false).eq("is_deleted", false);

  const { data, count } = await query;
  const rows = (data ?? []).filter((row) =>
    params.q ? row.content?.toLowerCase().includes(params.q.toLowerCase()) : true,
  );
  const profiles = await fetchProfilesByIds(rows.map((row) => row.author_id));

  return (
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
            const mediaUrl =
              row.media_url && !row.media_url.startsWith("http")
                ? publicStorageUrl("post-media", row.media_url)
                : row.media_url;

            return (
              <li key={row.id} className="space-y-3 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <UserCell
                    name={displayName(author, undefined, i18n.locale)}
                    secondary={i18n.format.formatDateTime(row.created_at)}
                    avatarUrl={author?.avatar_url}
                    href={i18n.path(`/admin/utilisateurs/${row.author_id}`)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {row.is_hidden ? <StatusPill tone="warning">{i18n.t("Masquee")}</StatusPill> : null}
                    {row.is_deleted ? <StatusPill tone="danger">{i18n.t("Supprimee")}</StatusPill> : null}
                    {!row.is_hidden && !row.is_deleted ? (
                      <StatusPill tone="success">{i18n.t("En ligne")}</StatusPill>
                    ) : null}
                  </div>
                </div>

                <p className="text-sm leading-relaxed whitespace-pre-line">
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
      <Pagination basePath={i18n.path("/admin/moderation")} params={params} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </Panel>
  );
}

/* --------------------------------------------------------------- commentaires */

async function CommentsView({ params }: { params: Record<string, string | undefined> }) {
  const i18n = await getAdminI18n();

  const supabase = await createClient();
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  let query = supabase
    .from("post_comments")
    .select("id, post_id, author_id, content, is_hidden, is_deleted, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (params.etat === "masque") query = query.eq("is_hidden", true);
  if (params.etat === "supprime") query = query.eq("is_deleted", true);
  if (params.etat === "en_ligne") query = query.eq("is_hidden", false).eq("is_deleted", false);

  const { data, count } = await query;
  const rows = (data ?? []).filter((row) =>
    params.q ? row.content?.toLowerCase().includes(params.q.toLowerCase()) : true,
  );
  const profiles = await fetchProfilesByIds(rows.map((row) => row.author_id));

  return (
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
                  <TableCell className="max-w-md whitespace-normal">{row.content}</TableCell>
                  <TableCell>
                    {row.is_deleted ? (
                      <StatusPill tone="danger">{i18n.t("Supprime")}</StatusPill>
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
                    <div className="flex items-center justify-end gap-2">
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
      <Pagination basePath={i18n.path("/admin/moderation")} params={params} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </Panel>
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
                  row.youtube_url ?? publicStorageUrl("player-videos", row.storage_path);
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
    <label className="flex items-center gap-2 rounded-lg bg-background px-3 py-1.5 md:col-span-3">
      <span className="micro-label whitespace-nowrap text-muted-foreground">{name_} :</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="w-full cursor-pointer bg-transparent text-xs font-semibold outline-none"
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
