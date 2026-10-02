import type { Metadata } from "next";
import Link from "next/link";
import {
  BellRingIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CopyIcon,
  DownloadIcon,
  Globe2Icon,
  HistoryIcon,
  MailIcon,
  MegaphoneIcon,
  RotateCcwIcon,
  SendIcon,
  SmartphoneIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterBar } from "@/components/admin/filter-bar";
import { MetricStrip } from "@/components/admin/metric-strip";
import { NoteCards } from "@/components/admin/note-cards";
import { NotificationComposer } from "@/components/admin/notification-composer";
import { HeaderMeta, PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { StatusPill } from "@/components/admin/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  previewCampaignEmail,
  retryNotification,
  searchAccounts,
  sendNotification,
  sendTestNotification,
} from "@/lib/actions/notifications";
import { isSuperAdmin, requirePermission } from "@/lib/auth";
import { getAdminI18n } from "@/lib/i18n/admin";
import { fetchProfilesByIds } from "@/lib/queries/profiles";
import {
  CAMPAIGNS_PAGE_SIZE,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TARGETS,
  fetchBroadcastAudience,
  fetchCampaignJournal,
  fetchCampaignMetrics,
  fetchChannelStates,
  fetchPushReach,
} from "@/lib/queries/notifications";
import { fetchEmailTemplates } from "@/lib/queries/email-template";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Notifications") };
}

export default async function NotificationsPage({
  searchParams,
}: PageProps<"/[locale]/admin/notifications">) {
  const i18n = await getAdminI18n();

  await requirePermission("notifications.manage");
  const resolved = await searchParams;
  const page = Math.max(
    1,
    Number(typeof resolved.page === "string" ? resolved.page : 1) || 1,
  );
  const statut = str(resolved.statut);
  const cible = str(resolved.cible);
  const q = str(resolved.q);

  // Le choix des canaux est un geste de super administrateur, comme la
  // validation d'un Scout Day ou d'une publication : un envoi ordinaire part
  // sur les canaux par defaut, sans decision a prendre.
  const canChooseChannels = await isSuperAdmin();

  const [journal, metrics, audience, channelStates, pushReach, catalogue] = await Promise.all([
    fetchCampaignJournal({ page, statut, cible, q }),
    fetchCampaignMetrics(),
    fetchBroadcastAudience(),
    fetchChannelStates(canChooseChannels),
    fetchPushReach(),
    fetchEmailTemplates(),
  ]);

  const channelReason = (reason: string) =>
    reason === "migration"
      ? i18n.t("Migration non appliquée")
      : reason === "permission"
        ? i18n.t("Super administrateur")
        : i18n.t("Aucun fournisseur d'envoi configuré");

  const scoutDayOptions = audience.scoutDays.map((event) => ({
    id: event.id as string,
    label: `${event.title} — ${i18n.format.formatDate(event.event_date)}`,
    count: audience.registrationsByEvent.get(event.id as string) ?? 0,
  }));
  /**
   * ⚠️ Les identites du journal sont resolues pour **les campagnes de la
   * page**, jamais par un chargement global. L'ecran lisait deux mille
   * comptes pour en nommer quelques-uns ; ici la requete porte sur les seules
   * cibles nominatives affichees, et sur rien d'autre.
   */
  const targetedAccounts = await fetchProfilesByIds(
    journal.rows
      .filter((row) => row.target_type === "user" && row.target_value)
      .map((row) => row.target_value as string),
  );
  const userById = new Map(
    [...targetedAccounts].map(([id, profile]) => [
      id,
      `${profile.full_name ?? profile.email ?? i18n.t("Compte")} — ${profile.role}`,
    ]),
  );
  const scoutDayById = new Map(scoutDayOptions.map((option) => [option.id, option.label]));

  const targetLabel = (type: string, value: string | null) => {
    if (type === "all") return i18n.t("Toute la plateforme");
    if (type === "role") {
      return value === "player" ? i18n.t("Tous les joueurs") : i18n.t("Tous les professionnels");
    }
    if (type === "user") return userById.get(value ?? "") ?? i18n.t("Utilisateur supprimé");
    if (type === "scout_day") return scoutDayById.get(value ?? "") ?? i18n.t("Scout Day supprimé");
    return value ?? type;
  };

  const statusLabel = {
    sent: i18n.t("Envoyée"),
    failed: i18n.t("Échec"),
    processing: i18n.t("En cours"),
    queued: i18n.t("En attente"),
  } as const;
  const targetTypeLabel = {
    all: i18n.t("Toute la plateforme"),
    role: i18n.t("Segment par rôle"),
    user: i18n.t("Envoi individuel"),
    scout_day: i18n.t("Participants Scout Day"),
  } as const;

  const exportQuery = new URLSearchParams(
    Object.entries({ statut, cible, q }).filter(([, value]) => value) as [string, string][],
  ).toString();

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: i18n.t("Communication") }, { label: i18n.t("Notifications push") }]}
        title={i18n.t("Diffusion & notifications push")}
        meta={
          <HeaderMeta tone="brand" dot>
            {i18n.t(
              metrics.total === 1 ? "{0} campagne enregistree" : "{0} campagnes enregistrees",
              { "0": i18n.format.formatNumber(metrics.total) },
            )}
          </HeaderMeta>
        }
        description={i18n.t("Envois individuels ou segmentés : notification dans l'application et push mobile. Chaque diffusion indique combien de destinataires ont réellement été servis.")}
      />

      {/* Le composeur d'abord : c'est le geste pour lequel on ouvre l'ecran.
          Sept chiffres le repoussaient auparavant sous la ligne de flottaison,
          alors que les mesures decrivent le journal, pas la redaction. */}
      <NotificationComposer
        action={sendNotification}
        testAction={sendTestNotification}
        audiences={audience.audiences}
        searchAccounts={searchAccounts}
        scoutDays={scoutDayOptions}
        reach={{ devices: pushReach, activeAccounts: audience.activeAccounts }}
        channels={{
          // La raison est nommee separement pour chaque canal : ce sont des
          // gestes differents — appliquer un fichier SQL, renseigner une cle,
          // ou demander un role.
          push: {
            selectable: channelStates.push.selectable,
            reason: channelReason(channelStates.push.reason),
          },
          email: {
            selectable: channelStates.email.selectable,
            reason: channelReason(channelStates.email.reason),
          },
        }}
        templates={catalogue.templates.map((template) => ({
          id: template.id,
          name: template.name,
          isDefault: template.is_default,
        }))}
        templatesHref={i18n.path("/admin/notifications/modele")}
        previewAction={previewCampaignEmail}
        defaults={{ title: str(resolved.titre), body: str(resolved.message) }}
      />

      {/* Quatre mesures sur la meme fenetre de 30 jours, posees juste au-dessus
          du journal qu'elles resument. Aucune ne se calcule sur la page
          affichee : « destinataires servis sur les campagnes affichees »
          changeait de valeur a chaque page tournee. */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricStrip
          icon={MegaphoneIcon}
          label={i18n.t("Campagnes (30 j)")}
          value={i18n.format.formatNumber(metrics.campaigns30d)}
          hint={i18n.t("{0} depuis l'origine", { "0": i18n.format.formatNumber(metrics.total) })}
        />
        <MetricStrip
          icon={UsersIcon}
          label={i18n.t("Destinataires (30 j)")}
          value={i18n.format.formatNumber(metrics.recipients30d)}
          hint={i18n.t("Notifications réellement écrites")}
          tone="info"
        />
        <MetricStrip
          icon={CheckCircle2Icon}
          label={i18n.t("Réussite (30 j)")}
          value={
            metrics.successRate === null ? "—" : `${Math.round(metrics.successRate * 100)} %`
          }
          hint={
            metrics.successRate === null
              ? i18n.t("Aucune diffusion sur la période")
              : i18n.t("{0} envoyées · {1} en échec", {
                  "0": metrics.sent30d,
                  "1": metrics.failed30d,
                })
          }
          tone={metrics.successRate === null ? "default" : "brand"}
        />
        <MetricStrip
          icon={TriangleAlertIcon}
          label={i18n.t("Échecs à relancer")}
          value={i18n.format.formatNumber(metrics.failedTotal)}
          hint={
            metrics.failedTotal
              ? i18n.t("Voir ces campagnes")
              : i18n.t("Aucune relance en attente")
          }
          tone={metrics.failedTotal ? "danger" : "default"}
          href={
            metrics.failedTotal
              ? i18n.path("/admin/notifications?statut=failed")
              : undefined
          }
        />
      </section>

      <Panel>
        <PanelHeader
          icon={HistoryIcon}
          title={i18n.t("Journal de livraison")}
          description={i18n.t("Traçabilité des campagnes, de leur audience, de leur expéditeur et du résultat de diffusion.")}
          action={
            <Link
              href={i18n.path(`/admin/notifications/export${exportQuery ? `?${exportQuery}` : ""}`)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-xs font-semibold hover:bg-accent/70"
            >
              <DownloadIcon className="size-3.5" />
              {i18n.t("Exporter CSV")}
            </Link>
          }
        />

        {/* La recherche part dans la requete, pas dans une passe sur la page :
            sinon `count` — qui alimente la pagination et le pied — ignorerait
            le filtre, et un terme present a la 200e campagne serait
            introuvable. */}
        <FilterBar
          basePath={i18n.path("/admin/notifications")}
          params={{ statut, cible, q }}
          searchPlaceholder={i18n.t("Rechercher un titre ou un message…")}
          filters={[
            {
              name: "statut",
              label: i18n.t("Statut"),
              options: CAMPAIGN_STATUSES.map((value) => ({
                value,
                label: statusLabel[value],
              })),
            },
            {
              name: "cible",
              label: i18n.t("Cible"),
              options: CAMPAIGN_TARGETS.map((value) => ({
                value,
                label: targetTypeLabel[value],
              })),
            },
          ]}
        />

        {journal.error ? (
          <p className="p-5 text-sm text-destructive">
            {i18n.t("Appliquez la migration administrateur pour activer ce module :")}{" "}
            {journal.error.message}
          </p>
        ) : !journal.rows.length ? (
          <EmptyState
            icon={BellRingIcon}
            title={statut || cible || q ? i18n.t("Aucune campagne ne correspond") : i18n.t("Aucune campagne")}
            description={
              statut || cible || q
                ? i18n.t("Élargissez la recherche ou retirez les filtres pour revoir tout le journal.")
                : i18n.t("Votre première diffusion apparaîtra ici avec son audience et son statut.")
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18n.t("Campagne & message")}</TableHead>
                <TableHead>{i18n.t("Audience")}</TableHead>
                <TableHead>{i18n.t("Statut")}</TableHead>
                <TableHead>{i18n.t("Destinataires")}</TableHead>
                <TableHead>{i18n.t("Expédition")}</TableHead>
                <TableHead className="text-right">{i18n.t("Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {journal.rows.map((campaign) => {
                const author = campaign.created_by
                  ? journal.authors.get(campaign.created_by)
                  : undefined;
                return (
                  <TableRow
                    key={campaign.id}
                    // La ligne en echec porte le liseré des files : c'est la
                    // seule du journal qui attende encore un geste.
                    className={cn(campaign.status === "failed" && "row-flagged")}
                  >
                    <TableCell>
                      <div className="max-w-96">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {campaign.title}
                        </p>
                        <p className="mt-1 line-clamp-2 whitespace-normal text-[0.6875rem] leading-relaxed text-muted-foreground">
                          {campaign.body}
                        </p>
                        {/* Les canaux tenaient une colonne entiere pour une
                            valeur identique sur toutes les lignes ; ils vivent
                            sous le message, ou ils qualifient l'envoi. */}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(campaign.channels ?? []).map((channel) => (
                            <ChannelPill key={channel} channel={channel} />
                          ))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AudienceCell
                        type={campaign.target_type}
                        label={targetLabel(campaign.target_type, campaign.target_value)}
                      />
                    </TableCell>
                    <TableCell>
                      <CampaignStatus status={campaign.status} />
                      {campaign.error_message ? (
                        <p className="mt-1 max-w-44 whitespace-normal text-[0.625rem] leading-relaxed text-destructive">
                          {campaign.error_message}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-baseline gap-1">
                        <span className="font-heading text-lg font-extrabold text-brand tabular-nums">
                          {i18n.format.formatNumber(campaign.recipient_count ?? 0)}
                        </span>
                        <span className="text-[0.625rem] text-muted-foreground">
                          {i18n.t("servis")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-foreground">
                        {i18n.format.formatDateTime(campaign.created_at)}
                      </p>
                      {/* Depuis le retrait du journal d'administration, cette
                          ligne est la seule trace de qui a diffuse. */}
                      <p className="mt-0.5 max-w-40 truncate text-[0.625rem] text-muted-foreground">
                        {author?.full_name || author?.email || i18n.t("Auteur inconnu")}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Dupliquer prefixe le composeur par l'URL : pas d'etat
                            partage a inventer, et le lien est partageable. */}
                        <Link
                          href={i18n.path(`/admin/notifications?titre=${encodeURIComponent(campaign.title)}&message=${encodeURIComponent(campaign.body ?? "")}`)}
                          title={i18n.t("Reprendre ce message dans le composeur")}
                          className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <CopyIcon className="size-3.5" />
                          <span className="hidden lg:inline">{i18n.t("Dupliquer")}</span>
                        </Link>
                        {campaign.status !== "sent" ? (
                          <ActionButton
                            action={retryNotification.bind(null, campaign.id)}
                            variant="outline"
                            // Une relance rediffuse a toute la cible : elle se
                            // confirme, comme l'envoi initial.
                            confirm={{
                              title: i18n.t("Relancer cette campagne ?"),
                              description: i18n.t("Le message repart vers « {0} ». Une notification partie ne peut pas etre rappelee.", {
                                "0": targetLabel(campaign.target_type, campaign.target_value),
                              }),
                              actionLabel: i18n.t("Réessayer"),
                            }}
                          >
                            <RotateCcwIcon />
                            {i18n.t("Réessayer")}
                          </ActionButton>
                        ) : (
                          <span className="micro-label text-muted-foreground">
                            {i18n.t("Terminé")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Pagination
          basePath={i18n.path("/admin/notifications")}
          params={{ statut, cible, q, page: String(page) }}
          page={page}
          pageSize={CAMPAIGNS_PAGE_SIZE}
          total={journal.total}
        />
      </Panel>

      <NoteCards
        notes={[
          {
            icon: SendIcon,
            title: i18n.t("Diffusion synchrone"),
            body: i18n.t("Il n'y a pas de file d'attente : l'envoi écrit une notification par destinataire au moment de la validation, et c'est cette écriture qui déclenche le push. Le journal indique le nombre réel de destinataires servis."),
          },
          {
            icon: SmartphoneIcon,
            title: i18n.t("Couverture mobile conditionnelle"),
            body: i18n.t("Tous les destinataires reçoivent la notification dans l'application. Le push dépend de la présence d'un jeton valide sur leur appareil."),
          },
          {
            icon: MailIcon,
            title: channelStates.email.selectable
              ? i18n.t("Canal email")
              : i18n.t("Canal email désactivé"),
            body: channelStates.email.selectable
              ? i18n.t("L'e-mail part dans la langue du destinataire, une seule adresse par message, et porte un lien de désabonnement signé. Les comptes désabonnés sont exclus de la diffusion ; l'administration le constate, elle ne le décide pas.")
              : i18n.t("Le canal email est montré désactivé tant qu'aucun envoi n'est branché derrière : il dit ce qui manque au lieu de promettre une livraison que personne ne recevrait."),
          },
        ]}
      />
    </>
  );
}

function AudienceCell({ type, label }: { type: string; label: string }) {
  const Icon =
    type === "all"
      ? Globe2Icon
      : type === "role"
        ? UsersIcon
        : type === "user"
          ? UserRoundIcon
          : CalendarDaysIcon;

  return (
    <div className="flex max-w-52 items-center gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <p className="truncate text-xs">{label}</p>
    </div>
  );
}

async function ChannelPill({ channel }: { channel: string }) {
  const i18n = await getAdminI18n();

  const tone =
    channel === "push"
      ? "bg-brand/12 text-brand"
      : channel === "email"
        ? "bg-warning/15 text-warning"
        : "bg-info/12 text-info";

  return (
    <span className={cn("micro-label rounded px-1.5 py-1", tone)}>
      {channel === "in_app"
        ? "In-App"
        : channel === "push"
          ? i18n.t("Push")
          : channel === "email"
            ? i18n.t("Email")
            : channel}
    </span>
  );
}

async function CampaignStatus({ status }: { status: string }) {
  const i18n = await getAdminI18n();

  const details = {
    sent: { label: i18n.t("Envoyée"), tone: "success" as const },
    failed: { label: i18n.t("Échec"), tone: "danger" as const },
    processing: { label: i18n.t("En cours"), tone: "info" as const },
    queued: { label: i18n.t("En attente"), tone: "warning" as const },
  };
  const entry = details[status as keyof typeof details] ?? {
    label: status,
    tone: "neutral" as const,
  };

  return (
    <StatusPill tone={entry.tone} dot>
      {entry.label}
    </StatusPill>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
