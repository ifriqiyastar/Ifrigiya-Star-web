import { getAdminI18n } from "@/lib/i18n/admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  BanIcon,
  CheckIcon,
  ClockIcon,
  EyeOffIcon,
  FlagIcon,
  MessagesSquareIcon,
  ScaleIcon,
  ShieldCheckIcon,
  Trash2Icon,
  TriangleAlertIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { Panel } from "@/components/admin/panel";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { RemovalProposalDialog } from "@/components/admin/removal-proposal-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { Button } from "@/components/ui/button";
import {
  confirmRemoval,
  dismissReport,
  proposeRemoval,
  refuseRemoval,
  suspendUser,
} from "@/lib/actions/moderation";
import { getAdminAccess, requirePermission } from "@/lib/auth";

import {
  ACCOUNT_TARGETS,
  QUARANTINABLE,
  removalConfirmation,
  removalOptions,
} from "@/lib/moderation-targets";
import { MODERATION_ACTION, REPORTABLE_TYPE, REPORT_STATUS } from "@/lib/labels";
import {
  fetchBlockSignals,
  fetchReportTargets,
  type BlockSignal,
  type ReportTarget,
} from "@/lib/queries/moderation";
import {
  displayName,
  fetchProfilesByIds,
  type ProfileSummary,
} from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Dossier de signalement") };
}

/**
 * Le dossier complet d'un signalement — lire, puis decider, au meme endroit.
 *
 * POURQUOI UNE PAGE ET NON PLUS UNE MODALE. La fiche vivait dans un
 * `DetailDialog`, qui rend ses enfants **cote serveur** : la conversation de
 * chaque signalement aurait ete chargee pour les 200 lignes de la file, et il
 * a fallu plafonner. Une page par dossier retire le plafond — un seul fil a
 * lire, donc l'**historique entier** est atteignable, tranche par tranche —,
 * donne une URL qu'on se transmet, et laisse la place aux gestes de decision
 * a cote de la preuve plutot qu'au bout d'une ligne de tableau.
 *
 * Les memes gestes restent disponibles depuis la file pour les cas evidents ;
 * ils appellent les memes Server Actions, qui refont l'autorisation.
 */
export default async function ReportDossierPage({
  params,
}: PageProps<"/[locale]/admin/moderation/signalements/[id]">) {
  const i18n = await getAdminI18n();

  const admin = await requirePermission("moderation.manage");
  // Valider un retrait est reserve au super administrateur (migration 0041).
  const { permissions } = await getAdminAccess(admin.userId);
  const canValidate = permissions.includes("moderation.validate");

  const { id } = await params;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("reports")
    .select(
      "id, reporter_id, target_type, target_id, reason, status, moderation_action, handled_by, handled_at, created_at, proposed_by, proposed_at, proposed_action, proposal_reason, decision_reason, quarantined, context_conversation_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (!row) notFound();

  const targets = await fetchReportTargets([row], i18n);
  const content = targets.get(`${row.target_type}:${row.target_id}`);

  const isAccount = ACCOUNT_TARGETS.includes(row.target_type);
  const blocks = isAccount ? await fetchBlockSignals([row.target_id]) : undefined;
  const block = blocks?.get(row.target_id);

  // Le nombre de signalements ouverts sur la meme cible : une recidive change
  // la lecture d'un motif isole.
  const { count: reportCount } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("target_type", row.target_type)
    .eq("target_id", row.target_id);

  // Antecedents : signalements deja instruits **avec une mesure** sur la meme
  // cible. Un compte deja sanctionne ne se lit pas comme un premier ecart.
  const { count: sanctionCount } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("target_type", row.target_type)
    .eq("target_id", row.target_id)
    .eq("status", "traite")
    .neq("moderation_action", "aucune");

  const profiles = await fetchProfilesByIds([
    row.reporter_id,
    row.target_id,
    row.proposed_by,
    row.handled_by,
    content?.authorId,
  ].filter((value): value is string => Boolean(value)));

  const reporter = profiles.get(row.reporter_id);
  const accountTarget = profiles.get(row.target_id);
  const contentAuthor = content?.authorId ? profiles.get(content.authorId) : accountTarget;
  const removal = removalConfirmation(row.proposed_action, row.target_type, i18n);

  const targetName = isAccount
    ? displayName(accountTarget, undefined, i18n.locale)
    : i18n.t("Signalement — {0}", { "0": i18n.labels.label(REPORTABLE_TYPE, row.target_type) });

  /** Gestes disponibles selon l'etat du dossier, poses a droite de l'entete. */
  const actions = (
    <div className="flex flex-wrap items-center gap-2">
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
              <Button variant="destructive" size="sm">
                <Trash2Icon />
                {i18n.t("Proposer le retrait")}</Button>
            }
          />
          <ActionButton action={dismissReport.bind(null, row.id)} variant="outline">
            <XIcon />
            {i18n.t("Classer sans suite")}</ActionButton>
        </>
      ) : null}

      {row.status === "a_valider" && canValidate ? (
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
              <Button variant="outline" size="sm">
                <EyeOffIcon />
                {i18n.t("Refuser le retrait")}</Button>
            }
            title={i18n.t("Refuser le retrait")}
            description={i18n.t("Le contenu masque revient en ligne et le signalement est clos sans mesure. Le motif reste au dossier.")}
            label={i18n.t("Motif du refus")}
            placeholder={i18n.t("Contenu conforme aux CGU, signalement abusif…")}
            submitLabel={i18n.t("Refuser le retrait")}
          />
        </>
      ) : null}

      {row.status === "a_valider" && !canValidate ? (
        <StatusPill tone="warning">{i18n.t("Super administrateur requis pour trancher")}</StatusPill>
      ) : null}

      {/* Suspendre le compte vise : disponible tant qu'il s'agit d'un compte,
          y compris apres la cloture — un dossier clos n'interdit pas d'agir
          si un autre element arrive. */}
      {isAccount && accountTarget && accountTarget.id !== admin.userId ? (
        <ReasonDialog
          action={suspendUser.bind(null, row.target_id)}
          trigger={
            <Button variant="destructive" size="sm">
              <BanIcon />
              {i18n.t("Suspendre le compte")}</Button>
          }
          title={i18n.t("Suspendre ce compte")}
          description={i18n.t("Le profil passe en « suspendu » : au prochain demarrage, l'application deconnecte l'utilisateur. La session deja ouverte continue — c'est reversible depuis sa fiche.")}
          placeholder={i18n.t("Usurpation d'identite confirmee, recidive…")}
          submitLabel={i18n.t("Suspendre le compte")}
        />
      ) : null}
    </div>
  );

  return (
    <>
      {/* Fil d'ariane : d'ou l'on vient, et la reference du dossier. */}
      <nav className="flex flex-wrap items-center gap-2">
        <Link
          href={i18n.path("/admin/moderation?vue=signalements")}
          className="micro-label inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-brand"
        >
          <ArrowLeftIcon className="size-3.5" />
          {i18n.t("Tous les signalements")}</Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="micro-label text-brand">{i18n.t("Moderation")}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-mono text-[0.6875rem] text-muted-foreground">
          {i18n.t("Dossier #")}{row.id.slice(0, 8)}
        </span>
      </nav>

      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading truncate text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl">
              {targetName}
            </h1>
            <StatusPill tone="neutral">{i18n.labels.label(REPORTABLE_TYPE, row.target_type)}</StatusPill>
            <StatusPill tone={i18n.labels.entry(REPORT_STATUS, row.status).tone} dot>
              {i18n.labels.label(REPORT_STATUS, row.status)}
            </StatusPill>
            {row.context_conversation_id ? (
              <StatusPill tone="info">
                <MessagesSquareIcon />
                {i18n.t("Depuis la messagerie")}</StatusPill>
            ) : null}
            {reportCount && reportCount > 1 ? (
              <StatusPill tone="warning">{reportCount}  {i18n.t("signalements lies")}</StatusPill>
            ) : null}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5" />
            {i18n.t("Signale")} {i18n.format.timeAgo(row.created_at)}  {i18n.t("par")}{" "}
            <span className="font-medium text-foreground">{displayName(reporter, undefined, i18n.locale)}</span>
          </p>
        </div>
        {actions}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <DecisionCard
            status={row.status}
            action={row.moderation_action}
            handledAt={row.handled_at}
            decider={row.handled_by ? profiles.get(row.handled_by) : undefined}
            proposedAt={row.proposed_at}
            quarantined={row.quarantined}
          />

          <ReportDetail
            row={row}
            content={content}
            contentAuthor={contentAuthor}
            reporter={reporter}
            proposer={row.proposed_by ? profiles.get(row.proposed_by) : undefined}
            decider={row.handled_by ? profiles.get(row.handled_by) : undefined}
          />
        </div>

        <div className="flex flex-col gap-4">
          {isAccount ? (
            <BlocksCard
              block={block}
              blockedByReporter={Boolean(block?.blockedBy.includes(row.reporter_id))}
              sanctions={sanctionCount ?? 0}
            />
          ) : null}
          {row.context_conversation_id ? <ProvenanceCard /> : null}
        </div>
      </div>
    </>
  );
}

/**
 * Le corps du dossier, dans l'ordre ou un moderateur instruit : **la piece**
 * (le contenu vise, media en grand), **les blocages** deja poses par les
 * utilisateurs, la **provenance** du signalement, puis **le deroule** — une
 * frise plutot que quatre encadres empiles, parce que c'est exactement ce que
 * la donnee est : une machine a etats datee et signee (signale -> retrait
 * propose -> decision).
 *
 * Les gestes de decision restent au-dessus, dans le bandeau d'actions : on
 * decide apres avoir lu, et le bandeau reste atteignable sans redescendre.
 */
async function ReportDetail({
  row,
  content,
  contentAuthor,
  reporter,
  proposer,
  decider,
}: {
  row: {
    reason: string;
    status: string;
    target_type: string;
    target_id: string;
    reporter_id: string;
    moderation_action: string;
    proposed_action: string | null;
    proposal_reason: string | null;
    proposed_at: string | null;
    decision_reason: string | null;
    quarantined: boolean | null;
    handled_at: string | null;
    created_at: string;
    context_conversation_id: string | null;
  };
  content?: ReportTarget;
  contentAuthor?: ProfileSummary;
  reporter?: ProfileSummary;
  proposer?: ProfileSummary;
  decider?: ProfileSummary;
}) {
  const i18n = await getAdminI18n();

  const removed = row.status === "traite" && row.moderation_action !== "aucune";
  const isAccount = ACCOUNT_TARGETS.includes(row.target_type);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="micro-label flex items-center gap-2 text-muted-foreground">
          <span aria-hidden className="size-2 rounded-full bg-brand" />
          {i18n.t("Entite visee par le signalement")}</h2>
        <span className="font-mono text-[0.6875rem] text-muted-foreground">
          {i18n.t("Reference")} {row.target_id.slice(0, 8)}
        </span>
      </div>

      {isAccount ? (
        <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          {i18n.t("Le signalement vise le compte lui-meme, pas une publication precise : la mesure disponible porte donc sur le compte.")}</p>
      ) : null}

      {/* --- La piece a conviction. Le media domine, le reste l'entoure. --- */}
      <section className="overflow-hidden rounded-xl border border-border bg-background">
        {content?.mediaUrl && content.mediaType === "photo" ? (
          <Link
            href={content.mediaUrl}
            target="_blank"
            title={i18n.t("Ouvrir l'image en taille reelle")}
            className="block bg-secondary/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.mediaUrl}
              alt={i18n.t("Media de la publication signalee")}
              className="mx-auto max-h-96 w-full object-contain"
            />
          </Link>
        ) : null}

        {content?.mediaUrl && content.mediaType === "video" ? (
          <video
            src={content.mediaUrl}
            controls
            preload="metadata"
            className="max-h-96 w-full bg-black"
          />
        ) : null}

        <div className="space-y-3 p-4">
          {content?.excerpt ? (
            <p className="text-sm leading-relaxed whitespace-pre-line">{content.excerpt}</p>
          ) : null}

          {!content ? (
            <p className="text-sm text-muted-foreground">
              {i18n.t("Ce contenu n'existe plus, ou son type (")}{i18n.labels.label(REPORTABLE_TYPE, row.target_type)}{i18n.t(") n'est pas consultable ici. Identifiant :")} <code className="text-[0.6875rem]">{row.target_id}</code>
            </p>
          ) : null}

          {content && !content.excerpt && !content.mediaUrl ? (
            <p className="text-sm text-muted-foreground italic">{content.placeholder}</p>
          ) : null}

          {content?.mediaUrl && content.mediaType === "lien" ? (
            <Link
              href={content.mediaUrl}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
            >
              <VideoIcon className="size-3.5" />
              {i18n.t("Ouvrir la video")}</Link>
          ) : null}

          {/* Bandeau d'auteur : qui a publie, quand, et dans quel etat le
              contenu se trouve deja. */}
          {content ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3">
              {contentAuthor ? (
                <UserCell
                  name={displayName(contentAuthor, undefined, i18n.locale)}
                  secondary={contentAuthor.email}
                  avatarUrl={contentAuthor.avatar_url}
                  href={i18n.path(`/admin/utilisateurs/${content.authorId ?? row.target_id}`)}
                />
              ) : (
                <span className="text-xs text-muted-foreground">{i18n.t("Auteur introuvable")}</span>
              )}
              <span className="flex-1" />
              {content.createdAt ? (
                <span className="text-xs text-muted-foreground">
                  {i18n.format.formatDateTime(content.createdAt)}
                </span>
              ) : null}
              {content.state.map((flag) => (
                <StatusPill key={flag} tone="danger">
                  {flag}
                </StatusPill>
              ))}
              {content.href ? (
                <Link
                  href={content.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                >
                  {i18n.t("Fiche")}<ArrowUpRightIcon className="size-3" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* --- Le deroule, en frise. --- */}
      <section className="space-y-1">
        <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {i18n.t("Deroule")}</p>

        <ol className="relative space-y-5 pt-2">
          <Step
            icon={FlagIcon}
            title={i18n.t("Signalement")}
            at={row.created_at}
            actor={reporter}
            actorPrefix="par"
            quote={row.reason}
          />

          {row.proposed_at ? (
            <Step
              icon={Trash2Icon}
              title={i18n.t("Retrait propose — {0}", { "0": i18n.labels.label(MODERATION_ACTION, row.proposed_action) })}
              at={row.proposed_at}
              actor={proposer}
              actorPrefix="par"
              quote={row.proposal_reason}
              note={
                row.quarantined
                  ? i18n.t("Le contenu a ete masque des la proposition.")
                  : i18n.t("Cette cible ne peut pas etre masquee : elle est restee en ligne.")
              }
            />
          ) : null}

          {row.handled_at ? (
            <Step
              icon={removed ? CheckIcon : XIcon}
              tone={removed ? "brand" : "muted"}
              title={
                removed
                  ? i18n.t("Retrait valide — {0}", { "0": i18n.labels.label(MODERATION_ACTION, row.moderation_action) })
                  : row.proposed_at
                    ? i18n.t("Retrait refuse — contenu remis en ligne")
                    : i18n.t("Signalement classe sans suite")
              }
              at={row.handled_at}
              actor={decider}
              actorPrefix="par"
              quote={row.decision_reason}
              last
            />
          ) : null}

          {!row.handled_at ? (
            <Step
              icon={ClockIcon}
              tone="pending"
              title={
                row.status === "a_valider"
                  ? i18n.t("En attente du super administrateur")
                  : i18n.t("En attente d'instruction")
              }
              last
            />
          ) : null}
        </ol>
      </section>
    </div>
  );
}

/**
 * Une etape de la frise : pastille, titre date, auteur, citation.
 *
 * `last` coupe le trait de liaison. Seules les deux dernieres etapes possibles
 * le portent — la decision et l'attente — parce qu'une des deux est *toujours*
 * rendue : tant que `handled_at` est nul, l'etape « en attente » suit, donc ni
 * le signalement ni la proposition ne peuvent clore la frise.
 */
async function Step({
  icon: Icon,
  title,
  at,
  actor,
  actorPrefix,
  quote,
  note,
  tone = "brand",
  last,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  at?: string | null;
  actor?: ProfileSummary;
  actorPrefix?: string;
  quote?: string | null;
  note?: string;
  tone?: "brand" | "muted" | "pending";
  last?: boolean;
}) {
  const i18n = await getAdminI18n();

  return (
    <li className="relative flex gap-3">
      {/* Le trait qui relie les etapes s'arrete a la derniere. */}
      {!last ? (
        <span aria-hidden className="absolute top-8 bottom-[-1.25rem] left-4 w-px bg-border" />
      ) : null}

      <span
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
          tone === "brand" && "bg-brand/15 text-brand",
          tone === "muted" && "bg-secondary text-muted-foreground",
          tone === "pending" && "border border-dashed border-border bg-background text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-1.5 pb-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-sm font-medium">{title}</p>
          {at ? <span className="text-xs text-muted-foreground">{i18n.format.formatDateTime(at)}</span> : null}
        </div>

        {actor ? (
          <p className="text-xs text-muted-foreground">
            {actorPrefix} {displayName(actor, undefined, i18n.locale)}
          </p>
        ) : null}

        {quote ? (
          <blockquote className="border-l-2 border-border pl-3 text-sm leading-relaxed whitespace-pre-line">
            {quote}
          </blockquote>
        ) : null}

        {note ? <p className="text-xs text-muted-foreground italic">{note}</p> : null}
      </div>
    </li>
  );
}

/**
 * L'arbitrage, en tete du dossier : ou en est la decision, quelle mesure a
 * ete appliquee, et qui l'a signee. Le texte suit l'etat reel du signalement —
 * il n'y a pas de « dossier clos » tant que rien n'a ete tranche.
 */
async function DecisionCard({
  status,
  action,
  handledAt,
  decider,
  proposedAt,
  quarantined,
}: {
  status: string;
  action: string;
  handledAt: string | null;
  decider?: ProfileSummary;
  proposedAt: string | null;
  quarantined: boolean | null;
}) {
  const i18n = await getAdminI18n();

  const closed = status === "traite" || status === "rejete";
  const sanctioned = status === "traite" && action !== "aucune";

  return (
    <Panel className="relative overflow-hidden p-4 sm:p-5">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-brand/5 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="micro-label block text-brand">{i18n.t("Arbitrage & resolution")}</span>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 font-heading text-lg font-bold">
            {closed ? i18n.t("Decision finale") : i18n.t("Instruction en cours")}
            <StatusPill tone={closed ? (sanctioned ? "danger" : "success") : "warning"}>
              {closed ? i18n.t("Dossier clos") : status === "a_valider" ? i18n.t("Retrait a valider") : i18n.t("A instruire")}
            </StatusPill>
          </h2>
        </div>
        {handledAt ? (
          <span className="rounded-lg border border-border bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
            {i18n.t("Traite le")} {i18n.format.formatDateTime(handledAt)}
          </span>
        ) : proposedAt ? (
          <span className="rounded-lg border border-border bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
            {i18n.t("Retrait propose le")} {i18n.format.formatDateTime(proposedAt)}
          </span>
        ) : null}
      </div>

      <p className="relative mt-3 text-sm leading-relaxed text-muted-foreground">
        {status === "en_attente"
          ? i18n.t("Un retrait se propose avec un motif : la cible est masquee dans la foulee quand elle s'y prete, et un super administrateur confirme ou remet en ligne.")
          : status === "a_valider"
            ? i18n.t("Un retrait a ete propose{0}. La confirmation applique la mesure ; le refus remet en ligne et clot le signalement.", { "0": quarantined ? i18n.t(" et la cible est deja masquee") : "" })
            : i18n.t("Ce signalement est clos. Le deroule ci-dessous garde qui a decide quoi, et pourquoi.")}
      </p>

      <div className="relative mt-4 flex flex-col justify-between gap-3 rounded-lg border border-border bg-muted p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
            {sanctioned ? (
              <ShieldCheckIcon className="size-5 text-destructive" />
            ) : (
              <ScaleIcon className="size-5" />
            )}
          </span>
          <div>
            <p className="text-xs text-muted-foreground">{i18n.t("Mesure appliquee")}</p>
            <p className="text-sm font-semibold">
              {closed
                ? i18n.labels.label(MODERATION_ACTION, action)
                : i18n.t("Aucune mesure : le dossier n'est pas tranche")}
            </p>
          </div>
        </div>
        {decider ? (
          <div className="sm:text-right">
            <p className="text-xs text-muted-foreground">{i18n.t("Decision signee par")}</p>
            <p className="text-xs font-medium text-brand">{displayName(decider, undefined, i18n.locale)}</p>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/**
 * Les signaux de contact, a droite du dossier : blocages poses par les
 * utilisateurs et antecedents de sanction sur la meme cible. Deux compteurs,
 * aucune note de risque — la synthese est le travail du moderateur.
 */
async function BlocksCard({
  block,
  blockedByReporter,
  sanctions,
}: {
  block?: BlockSignal;
  blockedByReporter: boolean;
  sanctions: number;
}) {
  const i18n = await getAdminI18n();

  return (
    <Panel className="p-4 sm:p-5">
      <h2 className="micro-label text-muted-foreground">{i18n.t("Blocages & antecedents")}</h2>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-muted p-3 text-center">
          <span className="font-heading block text-2xl font-extrabold tabular-nums">
            {block?.received ?? 0}
          </span>
          <span className="text-[0.6875rem] text-muted-foreground">
            {i18n.t("compte(s) l'ont bloque")}</span>
        </div>
        <div className="rounded-lg border border-border bg-muted p-3 text-center">
          <span className="font-heading block text-2xl font-extrabold tabular-nums">
            {block?.issued ?? 0}
          </span>
          <span className="text-[0.6875rem] text-muted-foreground">{i18n.t("compte(s) qu'il a bloques")}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-muted p-3">
        <span className="text-xs text-muted-foreground">{i18n.t("Antecedents de sanction")}</span>
        <StatusPill tone={sanctions ? "danger" : "success"}>
          {sanctions}  {i18n.t("sanction")}{sanctions > 1 ? "s" : ""}
        </StatusPill>
      </div>

      {blockedByReporter ? (
        <p className="mt-2 rounded-lg border border-info/25 bg-info/10 p-3 text-xs text-info">
          {i18n.t("Le signaleur avait deja bloque ce compte avant de le signaler.")}</p>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">{i18n.t("Note de lecture.")}</span>  {i18n.t("Le blocage appartient a l'utilisateur : l'administration le lit, ne le pose ni ne le leve. Plusieurs blocages recus disent qu'on a coupe le contact avant d'en arriver au signalement — c'est un indice de recidive, pas une preuve.")}</p>
    </Panel>
  );
}

/** Provenance du signalement — d'ou il vient, jamais ce qu'il contient. */
async function ProvenanceCard() {
  const i18n = await getAdminI18n();

  return (
    <Panel className="p-4 sm:p-5">
      <h2 className="micro-label text-muted-foreground">{i18n.t("Provenance & confidentialite")}</h2>
      <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-info/10 text-info">
            <MessagesSquareIcon className="size-4" />
          </span>
          <div>
            <p className="text-xs font-bold">{i18n.t("Messagerie privee")}</p>
            <p className="text-[0.6875rem] text-muted-foreground">{i18n.t("Depose depuis une conversation")}</p>
          </div>
        </div>
        <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          {i18n.t("Le back-office n'affiche pas les messages de cette conversation : le dossier se juge sur le motif ecrit par le signaleur, et la mesure disponible porte sur le compte.")}</p>
      </div>
    </Panel>
  );
}
