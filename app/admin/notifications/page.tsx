import Link from "next/link";
import type { Metadata } from "next";
import {
  CopyIcon,
  DownloadIcon,
  FilterIcon,
  BellRingIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  Globe2Icon,
  HistoryIcon,
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
import { NoteCards } from "@/components/admin/note-cards";
import { NotificationComposer } from "@/components/admin/notification-composer";
import { HeaderMeta, PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { StatCard } from "@/components/admin/stat-card";
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
  retryNotification,
  sendNotification,
  sendTestNotification,
} from "@/lib/actions/notifications";
import { requirePermission } from "@/lib/auth";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 20;

export default async function NotificationsPage({
  searchParams,
}: PageProps<"/admin/notifications">) {
  await requirePermission("notifications.manage");
  const resolved = await searchParams;
  const page = Math.max(
    1,
    Number(typeof resolved.page === "string" ? resolved.page : 1) || 1,
  );
  const statut =
    typeof resolved.statut === "string" && resolved.statut ? resolved.statut : undefined;
  const supabase = await createClient();

  const since30d = new Date();
  since30d.setDate(since30d.getDate() - 30);

  const [
    campaignResult,
    profileResult,
    scoutDayResult,
    sentResult,
    failedResult,
    activeAccounts,
    activePlayers,
    activePros,
    tokens,
    registrations,
    recent,
  ] = await Promise.all([
      (statut
        ? supabase
            .from("admin_notification_campaigns")
            .select("*", { count: "exact" })
            .eq("status", statut)
        : supabase.from("admin_notification_campaigns").select("*", { count: "exact" })
      )
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("is_active", true)
        .order("full_name")
        .limit(2000),
      supabase
        .from("scout_days")
        .select("id, title, event_date")
        .order("event_date", { ascending: false })
        .limit(1000),
      supabase
        .from("admin_notification_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent"),
      supabase
        .from("admin_notification_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      // Volumetrie des segments : ce sont les memes conditions que celles de
      // `admin_broadcast_notification` — comptes **actifs** uniquement.
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("role", "player"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("role", "professional"),
      // Portee push reelle : un compte peut avoir plusieurs appareils, on
      // compte les comptes distincts.
      supabase.from("push_tokens").select("profile_id").limit(5000),
      supabase.from("scout_day_registrations").select("scout_day_id, status").limit(5000),
      supabase
        .from("admin_notification_campaigns")
        .select("status, recipient_count, created_at")
        .gte("created_at", since30d.toISOString())
        .limit(1000),
    ]);

  const campaigns = campaignResult.data ?? [];
  const total = campaignResult.count ?? 0;
  const sentCampaigns = sentResult.count ?? 0;
  const failedCampaigns = failedResult.count ?? 0;
  const servedOnPage = campaigns.reduce(
    (sum, campaign) => sum + Number(campaign.recipient_count ?? 0),
    0,
  );

  const reachDevices = new Set((tokens.data ?? []).map((row) => row.profile_id as string)).size;
  const registrationsByEvent = new Map<string, number>();
  for (const row of registrations.data ?? []) {
    if (["annule", "refuse"].includes(row.status as string)) continue;
    const key = row.scout_day_id as string;
    registrationsByEvent.set(key, (registrationsByEvent.get(key) ?? 0) + 1);
  }
  const recentRows = recent.data ?? [];
  const recipients30d = recentRows.reduce(
    (sum, row) => sum + Number(row.recipient_count ?? 0),
    0,
  );
  const sent30d = recentRows.filter((row) => row.status === "sent").length;
  const failed30d = recentRows.filter((row) => row.status === "failed").length;

  const userOptions = (profileResult.data ?? []).map((profile) => ({
    id: profile.id,
    label: `${profile.full_name ?? profile.email ?? "Compte"} — ${profile.role}`,
  }));
  const scoutDayOptions = (scoutDayResult.data ?? []).map((event) => ({
    id: event.id,
    label: `${event.title} — ${formatDate(event.event_date)}`,
    count: registrationsByEvent.get(event.id) ?? 0,
  }));
  const userById = new Map(userOptions.map((option) => [option.id, option.label]));
  const scoutDayById = new Map(
    scoutDayOptions.map((option) => [option.id, option.label]),
  );

  const targetLabel = (type: string, value: string | null) => {
    if (type === "all") return "Toute la plateforme";
    if (type === "role") {
      return value === "player" ? "Tous les joueurs" : "Tous les professionnels";
    }
    if (type === "user") {
      return userById.get(value ?? "") ?? "Utilisateur supprimé";
    }
    if (type === "scout_day") {
      return scoutDayById.get(value ?? "") ?? "Scout Day supprimé";
    }
    return value ?? type;
  };

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Communication" }, { label: "Notifications push" }]}
        title="Diffusion & notifications push"
        meta={
          <HeaderMeta tone="brand" dot>
            {formatNumber(total)} campagne{total > 1 ? "s" : ""} enregistrée{total > 1 ? "s" : ""}
          </HeaderMeta>
        }
        description="Envois individuels ou segmentés : notification dans l'application et push mobile. Chaque diffusion indique combien de destinataires ont réellement été servis."
        actions={
          // Trois mesures, toutes issues des campagnes enregistrées. Pas de
          // taux d'ouverture : rien ne relit les accusés de réception, et
          // aucune passerelle n'est interrogée depuis cet écran.
          <div className="flex items-center divide-x divide-border rounded-lg border border-border bg-card">
            <HeaderStat label="Destinataires (30 j)" value={formatNumber(recipients30d)} />
            <HeaderStat label="Envois réussis (30 j)" value={formatNumber(sent30d)} tone="brand" />
            <HeaderStat
              label="Échecs (30 j)"
              value={formatNumber(failed30d)}
              tone={failed30d ? "danger" : "muted"}
            />
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Campagnes"
          value={formatNumber(total)}
          hint="Historique complet"
          icon={MegaphoneIcon}
        />
        <StatCard
          label="Envois réussis"
          value={formatNumber(sentCampaigns)}
          hint={total ? `${Math.round((sentCampaigns / total) * 100)}% des campagnes` : "Aucun envoi"}
          icon={CheckCircle2Icon}
          progress={total ? sentCampaigns / total : 0}
        />
        <StatCard
          label="Destinataires servis"
          value={formatNumber(servedOnPage)}
          hint="Sur les campagnes affichées"
          icon={UsersIcon}
        />
        <StatCard
          label="Échecs de diffusion"
          value={formatNumber(failedCampaigns)}
          hint={failedCampaigns ? "Une relance est disponible" : "Aucune action requise"}
          icon={TriangleAlertIcon}
          delta={failedCampaigns ? "À traiter" : "Stable"}
          deltaTone={failedCampaigns ? "danger" : "brand"}
        />
      </section>

      <NotificationComposer
        action={sendNotification}
        testAction={sendTestNotification}
        audiences={{
          all: activeAccounts.count ?? 0,
          players: activePlayers.count ?? 0,
          professionals: activePros.count ?? 0,
        }}
        users={userOptions}
        scoutDays={scoutDayOptions}
        reach={{ devices: reachDevices, activeAccounts: activeAccounts.count ?? 0 }}
        defaults={{ title: str(resolved.titre), body: str(resolved.message) }}
      />

      <Panel>
        <PanelHeader
          icon={HistoryIcon}
          title="Journal de livraison"
          description="Traçabilité des campagnes, de leur audience et du résultat de diffusion."
          action={
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtre de statut en GET : il vit dans l'URL, et l'export
                  reprend exactement le meme filtre. */}
              <form method="get" className="flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5">
                <FilterIcon className="size-3.5 text-muted-foreground" />
                <select
                  name="statut"
                  defaultValue={statut ?? ""}
                  className="cursor-pointer bg-transparent text-xs font-semibold outline-none"
                >
                  <option value="">Tous les statuts</option>
                  <option value="sent">Envoyées</option>
                  <option value="failed">En échec</option>
                </select>
                <button type="submit" className="text-[0.6875rem] font-semibold text-brand">
                  OK
                </button>
              </form>
              <Link
                href={`/admin/notifications/export${statut ? `?statut=${statut}` : ""}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-xs font-semibold hover:bg-accent/70"
              >
                <DownloadIcon className="size-3.5" />
                Exporter CSV
              </Link>
            </div>
          }
        />

        {campaignResult.error ? (
          <p className="p-5 text-sm text-destructive">
            Appliquez la migration administrateur pour activer ce module :{" "}
            {campaignResult.error.message}
          </p>
        ) : !campaigns.length ? (
          <EmptyState
            icon={BellRingIcon}
            title="Aucune campagne"
            description="Votre première diffusion apparaîtra ici avec son audience et son statut."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campagne & message</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Canaux</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Destinataires</TableHead>
                <TableHead>Expédition</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <div className="max-w-96">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {campaign.title}
                      </p>
                      <p className="mt-1 line-clamp-2 whitespace-normal text-[0.6875rem] leading-relaxed text-muted-foreground">
                        {campaign.body}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <AudienceCell
                      type={campaign.target_type}
                      label={targetLabel(campaign.target_type, campaign.target_value)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(campaign.channels ?? []).map((channel: string) => (
                        <ChannelPill key={channel} channel={channel} />
                      ))}
                    </div>
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
                        {formatNumber(campaign.recipient_count ?? 0)}
                      </span>
                      <span className="text-[0.625rem] text-muted-foreground">servis</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-foreground">
                      {formatDateTime(campaign.created_at)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Dupliquer prefixe le composeur par l'URL : pas d'etat
                          partage a inventer, et le lien est partageable. */}
                      <Link
                        href={`/admin/notifications?titre=${encodeURIComponent(campaign.title)}&message=${encodeURIComponent(campaign.body ?? "")}`}
                        title="Reprendre ce message dans le composeur"
                        aria-label="Reprendre ce message dans le composeur"
                        className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <CopyIcon className="size-4" />
                      </Link>
                      {campaign.status !== "sent" ? (
                        <ActionButton
                          action={retryNotification.bind(null, campaign.id)}
                          variant="outline"
                        >
                          <RotateCcwIcon />
                          Réessayer
                        </ActionButton>
                      ) : (
                        <span className="micro-label text-muted-foreground">Terminé</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination
          basePath="/admin/notifications"
          params={{ statut, page: String(page) }}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
        />
      </Panel>

      <NoteCards
        notes={[
          {
            icon: SendIcon,
            title: "Diffusion synchrone",
            body: "La campagne est envoyée au moment de la validation. Le journal indique le nombre réel de destinataires servis, sans file d'attente fictive.",
          },
          {
            icon: SmartphoneIcon,
            title: "Couverture mobile conditionnelle",
            body: "Tous les destinataires reçoivent la notification dans l'application. Le push dépend de la présence d'un jeton valide sur leur appareil.",
          },
          {
            icon: BellRingIcon,
            title: "Email volontairement indisponible",
            body: "Aucun fournisseur email n'est configuré. Le canal reste absent de la composition afin de ne jamais promettre une livraison inexistante.",
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

function ChannelPill({ channel }: { channel: string }) {
  const isPush = channel === "push";
  return (
    <span
      className={cn(
        "micro-label rounded px-1.5 py-1",
        isPush ? "bg-brand/12 text-brand" : "bg-info/12 text-info",
      )}
    >
      {channel === "in_app" ? "In-App" : channel === "push" ? "Push" : channel}
    </span>
  );
}

function CampaignStatus({ status }: { status: string }) {
  const details = {
    sent: { label: "Envoyée", tone: "success" as const },
    failed: { label: "Échec", tone: "danger" as const },
    processing: { label: "En cours", tone: "info" as const },
    queued: { label: "En attente", tone: "warning" as const },
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

/** Une mesure du bandeau d'entete : intitule minuscule, valeur en gras. */
function HeaderStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "brand" | "danger" | "muted";
}) {
  return (
    <div className="flex flex-col px-3 py-1.5">
      <span className="micro-label whitespace-nowrap text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-heading mt-0.5 text-base leading-none font-bold tabular-nums",
          tone === "brand"
            ? "text-brand"
            : tone === "danger"
              ? "text-destructive"
              : tone === "muted"
                ? "text-muted-foreground"
                : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
