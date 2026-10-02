import type { Metadata } from "next";
import Link from "next/link";
import {
  BanIcon,
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  GavelIcon,
  FlagIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  ShieldCheckIcon,
  Undo2Icon,
  UserIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { ModerationFilters } from "@/components/admin/moderation/pieces";
import { NoteCards } from "@/components/admin/note-cards";
import { HeaderMeta, PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { confirmRemoval, dismissReport, refuseRemoval } from "@/lib/actions/moderation";
import { getAdminAccess, requirePermission } from "@/lib/auth";
import { MODERATION_ACTION, REPORTABLE_TYPE, REPORT_STATUS } from "@/lib/labels";
import { ACCOUNT_TARGETS, removalConfirmation } from "@/lib/moderation-targets";
import { fetchBlockSignals, fetchReportTargets } from "@/lib/queries/moderation";
import { PAGE_SIZE, QUEUE_SIZE, REPORT_COLUMNS, fetchReportCounts, likeTerm, str } from "@/lib/queries/moderation-content";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getAdminI18n } from "@/lib/i18n/admin";

/**
 * §12.2 — LES SIGNALEMENTS.
 *
 * Quatre ecrans vivaient derriere `?vue=` dans une page unique de 1 800
 * lignes : un onglet qui change ne changeait pas d'adresse, l'etat de tri et
 * de filtre de l'un fuyait vers l'autre, et les quatre jeux de donnees etaient
 * decrits dans le meme fichier. Ils sont maintenant quatre routes, et le rail
 * porte le groupe depliable qui les relie.
 */
export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Signalements") };
}

export default async function ModerationReportsPage({
  searchParams,
}: PageProps<"/[locale]/admin/moderation/signalements">) {
  const i18n = await getAdminI18n();
  const admin = await requirePermission("moderation.manage");
  // Valider un retrait est reserve au super administrateur (migration 0041) :
  // on cache le geste plutot que de laisser un moderateur decouvrir la regle
  // par un refus Postgres.
  const { permissions } = await getAdminAccess(admin.userId);
  const canValidate = permissions.includes("moderation.validate");

  const resolved = await searchParams;
  const params = {
    q: str(resolved.q),
    statut: str(resolved.statut),
    cible: str(resolved.cible),
    page: str(resolved.page),
  };

  const supabase = await createClient();
  const [pending, toValidate] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "en_attente"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "a_valider"),
  ]);
  const openReports = (pending.count ?? 0) + (toValidate.count ?? 0);

  const exportQuery =
    params.statut || params.cible
      ? `?${new URLSearchParams(
          Object.entries({ statut: params.statut, cible: params.cible }).filter(
            (entry): entry is [string, string] => Boolean(entry[1]),
          ),
        )}`
      : "";

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: i18n.t("Moderation") }, { label: i18n.t("Signalements") }]}
        title={i18n.t("Signalements & securite des contenus")}
        meta={
          openReports > 0 ? (
            <HeaderMeta tone="danger" dot>
              {openReports}  {i18n.t("signalement")}{openReports > 1 ? "s" : ""}  {i18n.t("a instruire")}</HeaderMeta>
          ) : (
            <HeaderMeta>{i18n.t("File vide")}</HeaderMeta>
          )
        }
        description={i18n.t("Ce que les membres signalent, et la decision qui est prise dessus. Masquer retire le contenu du flux public sans l'effacer : l'administration continue de le voir, ce qui est necessaire pour instruire.")}
        actions={
          <Link
            href={i18n.path(`/admin/moderation/export${exportQuery}`)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <DownloadIcon />
            {i18n.t("Exporter le registre")}</Link>
        }
      />

      <ModerationFilters vue="signalements" params={params} available />

      <ReportsView params={params} canValidate={canValidate} />

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
    .select(REPORT_COLUMNS, { count: "exact" })
    // Le dernier signalement arrive en tete : la liste se lit dans l'ordre ou
    // elle se remplit. Ce qui est *bloque* ne se cherche plus dedans — la file
    // au-dessus le sort de la liste, comme dans les deux onglets voisins.
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (params.statut) query = query.eq("status", params.statut);
  if (params.cible) query = query.eq("target_type", params.cible);
  // ⚠️ LA RECHERCHE EST FAITE PAR POSTGRES, PAS APRES COUP. Elle etait
  // appliquee en JavaScript sur les vingt lignes **deja paginees** : un motif
  // present au 200e signalement ne ressortait jamais, `count` — donc le
  // paginateur et le pied du tableau — ignorait le filtre et annoncait « 3
  // affiches sur 214 » alors que 194 n'avaient pas ete regardes, et le
  // tableau pouvait se rendre sans une seule ligne parce que l'etat vide
  // testait la page, pas le resultat. Sur une file de moderation, une
  // recherche qui repond « rien » a tort est pire que pas de recherche.
  if (params.q) query = query.ilike("reason", likeTerm(params.q));

  const { data, error, count } = await query;
  const rows = data ?? [];

  // La file de ce qui est bloque : un retrait propose attend un super
  // administrateur, et le contenu vise est deja en quarantaine. Elle est
  // independante des filtres de la liste et se lit du plus ancien au plus
  // recent — meme convention que les files Publications et Commentaires.
  const { data: blockedData } = await supabase
    .from("reports")
    .select(REPORT_COLUMNS)
    .eq("status", "a_valider")
    .order("created_at", { ascending: true })
    .limit(QUEUE_SIZE);
  const blocked = blockedData ?? [];

  // Identites, cibles et signaux resolus pour la file ET pour la liste en un
  // seul passage : deux resolutions separees doubleraient les requetes et
  // finiraient par diverger.
  const everyRow = [...blocked, ...rows];

  // Le contenu vise, pas seulement son identifiant : un moderateur ne peut
  // pas instruire « Contenu 79540083-… ». On resout chaque cible dans sa
  // table, en une requete par type present.
  const targets = await fetchReportTargets(everyRow, i18n);

  const reportCounts = await fetchReportCounts(everyRow);

  // Combien de personnes ont bloque le compte vise : le seul indicateur de
  // recidive quand le signalement ne porte sur aucun contenu.
  const blocks = await fetchBlockSignals(
    everyRow
      .filter((row) => ACCOUNT_TARGETS.includes(row.target_type))
      .map((row) => row.target_id),
  );

  const profiles = await fetchProfilesByIds([
    ...everyRow.map((row) => row.reporter_id),
    ...everyRow.map((row) => row.target_id),
    ...everyRow.map((row) => row.proposed_by).filter(Boolean),
    ...everyRow.map((row) => row.handled_by).filter(Boolean),
    ...[...targets.values()].map((target) => target.authorId).filter(Boolean),
  ]);

  return (
    <>
      {/* LA FILE PASSE AVANT LA LISTE. C'est le seul endroit de cet onglet
          ou quelque chose est arrete en attendant une decision : le contenu
          est deja en quarantaine et un super administrateur doit trancher.
          Les onglets Publications et Commentaires ouvrent tous deux sur leur
          file ; Signalements n'en avait pas, et un retrait a valider se
          reperait a un lisere lime quelque part dans deux cents lignes triees
          par date d'arrivee. */}
      {blocked.length ? (
        <Panel highlighted>
          <PanelHeader
            icon={GavelIcon}
            title={i18n.t("Retraits a valider ({0})", { "0": blocked.length })}
            description={
              canValidate
                ? i18n.t("Un moderateur a propose un retrait motive et la cible est deja hors du flux public. Confirmer applique le retrait ; refuser la remet en ligne et clot le signalement. Le plus ancien passe en premier.")
                : i18n.t("Un moderateur a propose un retrait motive et la cible est deja hors du flux public. Seul un super administrateur peut confirmer ou refuser.")
            }
          />
          <ul className="divide-y divide-border">
            {blocked.map((row) => {
              const proposer = profiles.get(row.proposed_by);
              const accountTarget = profiles.get(row.target_id);
              const content = targets.get(`${row.target_type}:${row.target_id}`);
              const isAccount = ACCOUNT_TARGETS.includes(row.target_type);
              const summary = isAccount
                ? displayName(accountTarget, undefined, i18n.locale)
                : (content?.excerpt ??
                  (content?.mediaUrl ? i18n.t("Publication en media") : i18n.t("Contenu indisponible")));
              const removal = removalConfirmation(row.proposed_action, row.target_type, i18n);

              return (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <UserCell
                    name={displayName(proposer, undefined, i18n.locale)}
                    secondary={i18n.format.timeAgo(row.proposed_at ?? row.created_at)}
                    avatarUrl={proposer?.avatar_url}
                    href={row.proposed_by ? i18n.path(`/admin/utilisateurs/${row.proposed_by}`) : undefined}
                  />
                  {/* Ce sur quoi porte le retrait, et le motif ecrit par le
                      moderateur : la file dit de quoi il s'agit, le dossier
                      porte les pieces. */}
                  <div className="min-w-40 flex-1">
                    <p className="truncate text-sm">{summary}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {i18n.labels.label(MODERATION_ACTION, row.proposed_action)}
                      {row.proposal_reason ? `  ${row.proposal_reason}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.quarantined ? (
                      <StatusPill tone="warning">
                        <EyeOffIcon />
                        {i18n.t("En quarantaine")}</StatusPill>
                    ) : null}
                    <Link
                      href={i18n.path(`/admin/moderation/signalements/${row.id}`)}
                      className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                    >
                      <EyeIcon />
                      {i18n.t("Ouvrir le dossier")}</Link>
                    {canValidate ? (
                      <>
                        <ActionButton
                          action={confirmRemoval.bind(null, row.id)}
                          variant={row.proposed_action === "masque" ? "default" : "destructive"}
                          confirm={removal}
                        >
                          <CheckIcon />
                          {removal.actionLabel}
                        </ActionButton>
                        <ReasonDialog
                          action={refuseRemoval.bind(null, row.id)}
                          trigger={
                            <Button variant="outline" size="xs">
                              <Undo2Icon />
                              {i18n.t("Refuser")}</Button>
                          }
                          title={i18n.t("Refuser le retrait")}
                          description={i18n.t("Le contenu masque revient en ligne et le signalement est clos sans mesure. Le motif reste au journal des decisions.")}
                          label={i18n.t("Motif du refus")}
                          placeholder={i18n.t("Contenu conforme aux CGU, signalement abusif…")}
                          submitLabel={i18n.t("Refuser le retrait")}
                        />
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
      {/* Barre d'outils de la file : ce qu'elle contient, et la lecture des
          trois niveaux de priorite — qui sont **deduits** de donnees reelles,
          pas d'une colonne « severite » que le schema n'a pas. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-accent/50 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="micro-label">{i18n.t("File de traitement operationnelle")}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-[0.6875rem] font-bold text-brand tabular-nums">
            {rows.length}  {i18n.t("element(s) affiche(s)")}</span>
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
            {rows.map((row) => {
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
                      {/* LA LIGNE N'EST PLUS UNE SURFACE DE DECISION, ET C'EST
                          DELIBERE. Elle portait jusqu'a trois boutons, dont
                          « Proposer le retrait » — un geste irreversible pour
                          l'auteur, qui exige un motif ecrit, et qu'on prenait
                          depuis un extrait tronque a cinquante-six caracteres.
                          C'est exactement l'argument qui a fait ouvrir une
                          publication en popup et suivre un commentaire de son
                          fil : on ne juge pas un contenu hors de son contexte.
                          Le dossier porte les memes gestes avec les pieces
                          sous les yeux ; ce qui est bloque se traite dans la
                          file au-dessus. Reste ici le chemin vers le dossier,
                          et le seul geste qui ne demande pas de motif. */}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {/* Le dossier a sa propre page, et non plus une
                            modale : la conversation qui motive un signalement
                            se lit en entier, et `DetailDialog` rend ses
                            enfants cote serveur — chaque fil aurait ete
                            charge pour les 200 lignes de la file. */}
                        <Link
                          href={i18n.path(`/admin/moderation/signalements/${row.id}`)}
                          className={cn(buttonVariants({ variant: "default", size: "xs" }))}
                        >
                          <EyeIcon />
                          {i18n.t("Ouvrir le dossier")}</Link>

                        {row.status === "en_attente" ? (
                          <ActionButton action={dismissReport.bind(null, row.id)} variant="ghost">
                            <XIcon />
                            {i18n.t("Classer")}</ActionButton>
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
          {rows.length}  {i18n.t("incident(s) affiche(s) sur")} {count ?? 0}  {i18n.t("repertorie(s)")}</span>
        {/* Vrai : `AutoRefresh`, monte par le layout, rejoue le Server
            Component toutes les trente secondes, sauf quand une decision est en
            cours de saisie. */}
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-brand" />
          {i18n.t("Actualisation automatique")}</span>
      </div>
      <Pagination basePath={i18n.path("/admin/moderation/signalements")} params={params} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </Panel>
    </>
  );
}


