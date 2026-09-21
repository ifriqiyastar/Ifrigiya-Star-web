import { getAdminI18n } from "@/lib/i18n/admin";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRightIcon,
  AwardIcon,
  BadgeCheckIcon,
  BellRingIcon,
  CalendarDaysIcon,
  CircleAlertIcon,
  ClockIcon,
  DownloadIcon,
  CreditCardIcon,
  FilterIcon,
  FlagIcon,
  ShieldCheckIcon,
  UsersIcon,
  WalletIcon,
  PieChartIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
} from "lucide-react";

import { BreakdownMeter, type BreakdownRow } from "@/components/admin/breakdown-meter";
import { DashboardPeriod } from "@/components/admin/dashboard-period";
import { PageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { RevenueChart, type RevenueRow } from "@/components/admin/revenue-chart";
import { StatCard } from "@/components/admin/stat-card";
import { getDashboard } from "@/lib/queries/dashboard";
import { requirePermission } from "@/lib/auth";
import { makeFormat } from "@/lib/format";
import { fill, getAdminDict, getAdminLocale } from "@/lib/i18n/admin";
import type { AdminDictionary } from "@/lib/i18n/admin-shared";
import { localePath } from "@/lib/i18n/config";
import { PLAN_CODE, ROLE, makeLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAdminDict();
  return { title: dict.dashboard.metaTitle };
}

export default async function DashboardPage({ searchParams }: PageProps<"/[locale]/admin">) {
  const i18n = await getAdminI18n();

  await requirePermission("dashboard.read");
  const [locale, dict] = await Promise.all([getAdminLocale(), getAdminDict()]);
  const d = dict.dashboard;
  const { formatAmount, formatDuration, formatNumber } = makeFormat(locale);
  const { entry, label } = makeLabels(locale);
  const href = (path: string) => localePath(locale, path);
  const resolved = await searchParams;
  const requestedPeriod = Number(typeof resolved.periode === "string" ? resolved.periode : 30);
  const period = [7, 30, 90, 365].includes(requestedPeriod) ? requestedPeriod : 30;
  // Segment « Tous flux / Scout Days / Abonnements » du panneau financier : un
  // filtre reel sur le type de paiement, pas un onglet decoratif.
  const requestedFlux = typeof resolved.flux === "string" ? resolved.flux : "tous";
  const flux = (["tous", "abonnements", "scout_days"] as const).includes(
    requestedFlux as "tous" | "abonnements" | "scout_days",
  )
    ? (requestedFlux as "tous" | "abonnements" | "scout_days")
    : "tous";
  const data = await getDashboard(period);
  const payload = data.payload;

  const users = payload?.users ?? [];
  const totalUsers = users.reduce((acc, row) => acc + Number(row.total), 0);

  const players = payload?.players ?? [];
  const validatedPlayers = Number(
    players.find((row) => row.status === "valide")?.total ?? 0,
  );
  const pendingPlayers = Number(
    players.find((row) => row.status === "en_attente_validation")?.total ?? 0,
  );
  const totalPlayers = players.reduce((acc, row) => acc + Number(row.total), 0);

  const subscriptions = payload?.subscriptions ?? [];
  const activeSubscriptions = subscriptions
    .filter((row) => row.status === "active")
    .reduce((acc, row) => acc + Number(row.total), 0);

  const scoutDays = payload?.scout_days;

  // Revenus : la vue SQL renvoie une ligne par (mois, type de paiement) ;
  // on les replie en une ligne par mois pour les barres empilees.
  const revenueByMonth = new Map<string, RevenueRow>();
  let totalRevenue = 0;
  for (const row of payload?.revenue ?? []) {
    if (row.mois) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - period);
      if (new Date(row.mois) < cutoff) continue;
    }
    const key = row.mois ?? "inconnu";
    const current =
      revenueByMonth.get(key) ?? { mois: row.mois, abonnement: 0, scout_day: 0 };
    const amount = Number(row.revenu_encaisse ?? 0);
    if (row.payment_type === "abonnement") current.abonnement += amount;
    else current.scout_day += amount;
    revenueByMonth.set(key, current);
    totalRevenue += amount;
  }
  const revenueRows = [...revenueByMonth.values()]
    .sort((a, b) => (a.mois ?? "").localeCompare(b.mois ?? ""))
    .slice(-12);

  // Le filtre de flux ne masque pas des barres : il retire la serie ecartee du
  // total comme du graphique, pour que le chiffre affiche corresponde a ce
  // qu'on voit.
  const chartRows: RevenueRow[] = revenueRows.map((row) => ({
    mois: row.mois,
    abonnement: flux === "scout_days" ? 0 : row.abonnement,
    scout_day: flux === "abonnements" ? 0 : row.scout_day,
  }));
  const chartTotal = chartRows.reduce((acc, row) => acc + row.abonnement + row.scout_day, 0);

  const successfulTransactions = (payload?.revenue ?? []).reduce(
    (acc, row) => acc + Number(row.nb_transactions_reussies ?? 0),
    0,
  );

  /** Onglets du panneau financier : libelle, et type de paiement filtre. */
  const fluxTabs = [
    { value: "tous", label: d.fluxAll },
    { value: "scout_days", label: d.fluxScoutDays },
    { value: "abonnements", label: d.fluxSubscriptions },
  ] as const;

  /**
   * Les quatre etapes du parcours d'inscription joueur. Ce sont les membres
   * reels de `player_profile_status` — pas une modelisation d'entonnoir
   * inventee pour l'ecran : `suspendu` en est exclu parce qu'il n'appartient
   * pas au parcours.
   */
  const funnelSteps = [
    { status: "incomplet", label: d.funnelIncomplete, dot: "bg-muted-foreground/40" },
    { status: "en_attente_validation", label: d.funnelPending, dot: "bg-warning" },
    { status: "refuse", label: d.funnelRejected, dot: "bg-destructive" },
    { status: "valide", label: d.funnelApproved, dot: "bg-brand" },
  ] as const;

  /** Precision affichee derriere chaque role dans la repartition des comptes. */
  const roleNotes: Record<string, string> = {
    player: d.roleNotePlayer,
    professional: d.roleNoteProfessional,
    admin: d.roleNoteAdmin,
  };

  const roleRows: BreakdownRow[] = users
    .map((row) => ({
      label: entry(ROLE, row.role).label,
      value: Number(row.total),
      tone: entry(ROLE, row.role).tone,
      note: roleNotes[row.role],
    }))
    .sort((a, b) => b.value - a.value);


  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: d.home, href: href("/admin") },
          { label: d.current },
        ]}
        title={d.title}
        description={d.description}
        actions={
          <>
            <DashboardPeriod value={period} />
            <Link
              href={href("/admin/utilisateurs")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-muted px-3 text-sm font-semibold hover:bg-accent"
            >
              <SlidersHorizontalIcon className="size-4" />
              {d.filter}
            </Link>
            {/* « Exporter » pointe sur l'export qui existe : le journal des
                paiements en CSV. Pas d'export du tableau de bord lui-meme —
                il n'y a pas de fichier derriere. */}
            <Link
              href={href("/admin/finances/export")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-bold text-brand-foreground transition-[filter] hover:brightness-110"
            >
              <DownloadIcon className="size-4" />
              {d.export}
            </Link>
          </>
        }
      />

      {data.error ? (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs leading-relaxed text-destructive">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>{fill(d.aggregateError, { error: data.error })}</span>
        </p>
      ) : null}

      {/* Six indicateurs, dans l'ordre de la maquette. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={d.validatedPlayers}
          value={formatNumber(validatedPlayers)}
          icon={BadgeCheckIcon}
          delta={validatedPlayers ? d.certified : undefined}
          deltaTone="info"
          hint={fill(d.indexed, { count: formatNumber(data.visiblePlayers) })}
          href={href("/admin/utilisateurs?role=player&statut=valide")}
        />
        <StatCard
          label={d.activeSubscriptions}
          value={formatNumber(activeSubscriptions)}
          icon={CreditCardIcon}
          accent="secondary"
          delta={activeSubscriptions ? undefined : d.noneActive}
          deltaTone="neutral"
          hint={fill(d.transactions, { count: formatNumber(successfulTransactions) })}
          footHref={href("/admin/finances?vue=offres")}
          footLabel={d.pricing}
        />
        <StatCard
          label={d.revenue}
          value={formatNumber(Math.round(totalRevenue))}
          unit="TND"
          icon={WalletIcon}
          accent="tertiary"
          delta={d.statusSucceeded}
          deltaTone="neutral"
          hint={d.revenueHint}
          footNote={fill(d.lastDays, { days: period })}
          href={href("/admin/finances")}
        />

        <StatCard
          label={d.scoutDays}
          value={formatNumber(scoutDays?.total_evenements ?? 0)}
          icon={CalendarDaysIcon}
          delta={
            scoutDays?.total_inscriptions
              ? fill(d.registeredCount, {
                  count: formatNumber(scoutDays.total_inscriptions),
                })
              : undefined
          }
          hint={fill(d.publishedCount, { count: formatNumber(scoutDays?.publies ?? 0) })}
          href={href("/admin/scout-days")}
        />
        <StatCard
          label={d.pendingValidation}
          value={formatNumber(pendingPlayers + data.docsPending)}
          icon={ClockIcon}
          accent="tertiary"
          glow
          delta={pendingPlayers + data.docsPending > 0 ? d.priority : undefined}
          deltaTone="warning"
          hint={fill(d.pendingHint, {
            players: formatNumber(pendingPlayers),
            docs: formatNumber(data.docsPending),
          })}
          footHref={href("/admin/validations")}
          footLabel={d.handle}
        />
        <StatCard
          label={d.reports}
          value={formatNumber(data.pendingReports)}
          icon={FlagIcon}
          accent="error"
          glow
          delta={data.pendingReports ? d.arbitration : undefined}
          deltaTone="danger"
          hint={d.reportsHint}
          footHref={href("/admin/moderation")}
          footLabel={d.openReports}
        />
      </section>

      {/* Bloc analytique principal : flux financiers a gauche, repartition des
          comptes a droite. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Panel className="flex flex-col p-4 lg:col-span-8">
          <div className="flex flex-col justify-between gap-3 pb-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                <TrendingUpIcon className="size-4 text-brand" />
                {d.fluxTitle}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{d.fluxDesc}</p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 self-start rounded-lg bg-accent p-0.5 sm:self-auto">
              {fluxTabs.map((tab) => (
                <Link
                  key={tab.value}
                  href={href(
                    i18n.path(`/admin?periode=${period}${tab.value === "tous" ? "" : `&flux=${tab.value}`}`),
                  )}
                  className={cn(
                    "micro-label rounded px-2 py-1 transition-colors",
                    flux === tab.value
                      ? "bg-muted font-bold text-brand"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Trois mesures avant la courbe. Elles suivent le filtre de flux :
              le « revenu brut » affiche est celui des barres visibles. */}
          <div className="grid grid-cols-1 gap-3 rounded-lg bg-background/60 p-3 sm:grid-cols-3">
            <MiniMetric
              label={d.grossRevenue}
              value={formatAmount(chartTotal)}
              hint={fill(d.lastDays, { days: period })}
            />
            <MiniMetric
              label={d.averageBasket}
              value={
                successfulTransactions ? formatAmount(totalRevenue / successfulTransactions) : "—"
              }
              hint={fill(d.basketHint, { count: formatNumber(successfulTransactions) })}
            />
            <MiniMetric
              label={d.successRate}
              value={
                data.paymentsTotal
                  ? `${Math.round((data.paymentsSucceeded / data.paymentsTotal) * 100)} %`
                  : "—"
              }
              hint={fill(d.successHint, {
                ok: formatNumber(data.paymentsSucceeded),
                total: formatNumber(data.paymentsTotal),
              })}
              tone="brand"
            />
          </div>

          <div className="mt-3 flex-1 overflow-hidden rounded-lg bg-background">
            <RevenueChart rows={chartRows} />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">{d.fluxFootnote}</span>
            <Link
              href={href("/admin/finances")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
            >
              {d.paymentJournal}
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </Panel>

        <Panel className="flex flex-col justify-between p-4 lg:col-span-4">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                <PieChartIcon className="size-4 text-info" />
                {d.accountsTitle}
              </h2>
              <span className="micro-label rounded bg-accent px-1.5 py-0.5 text-muted-foreground">
                {fill(d.accountsTotal, { count: formatNumber(totalUsers) })}
              </span>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">{d.accountsDesc}</p>

            {roleRows.length ? (
              <BreakdownMeter rows={roleRows} total={totalUsers} />
            ) : (
              <p className="text-xs text-muted-foreground">{d.accountsEmpty}</p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-background/80 p-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <BadgeCheckIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{d.validatedProfiles}</p>
                  <p className="truncate text-[0.6875rem] text-muted-foreground">
                    {fill(d.validatedProfilesHint, {
                      done: formatNumber(validatedPlayers),
                      total: formatNumber(totalPlayers),
                    })}
                  </p>
                </div>
              </div>
              <span className="font-heading text-lg font-bold text-brand tabular-nums">
                {totalPlayers ? `${Math.round((validatedPlayers / totalPlayers) * 100)} %` : "—"}
              </span>
            </div>
          </div>

          <Link
            href={href("/admin/utilisateurs")}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-muted text-sm font-semibold hover:bg-accent"
          >
            <UsersIcon className="size-4" />
            {d.manageDirectory}
          </Link>
        </Panel>
      </div>

      {/* Entonnoir d'inscription et catalogue d'offres. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-heading text-base font-bold">
                <FilterIcon className="size-4 text-brand" />
                {d.funnelTitle}
              </h3>
              <Link
                href={href("/admin/utilisateurs?role=player")}
                className="rounded bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {d.funnelDetails}
              </Link>
            </div>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">{d.funnelDesc}</p>

            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              {funnelSteps.map((step, index) => {
                const value = Number(
                  players.find((row) => row.status === step.status)?.total ?? 0,
                );
                return (
                  <div key={step.status} className="rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "micro-label",
                          step.status === "valide" ? "text-brand" : "text-muted-foreground",
                        )}
                      >
                        {fill(d.funnelStep, { index: index + 1 })}
                      </span>
                      <span className={cn("size-2 rounded-full", step.dot)} />
                    </div>
                    <p
                      className={cn(
                        "mt-1.5 font-heading text-lg leading-none font-bold tabular-nums",
                        step.status === "valide" ? "text-brand" : "text-foreground",
                      )}
                    >
                      {formatNumber(value)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{step.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/80 p-3">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheckIcon className="size-4 text-brand" />
              {d.approvalDelay}{" "}
              <strong className="text-foreground">
                {data.approvalDelay === null ? "—" : formatDuration(data.approvalDelay)}
              </strong>
            </span>
            <span className="micro-label text-muted-foreground">
              {data.approvalDelay === null ? d.approvalNone : d.approvalNote}
            </span>
          </div>
        </Panel>

        <Panel className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-heading text-base font-bold">
                <AwardIcon className="size-4 text-warning" />
                {d.plansTitle}
              </h3>
              <Link
                href={href("/admin/finances?vue=offres")}
                className="rounded bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {d.plansManage}
              </Link>
            </div>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">{d.plansDesc}</p>

            {data.plans.length ? (
              <ul className="flex flex-col gap-2">
                {data.plans.map((plan) => (
                  <li
                    key={plan.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-brand">
                        <AwardIcon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{locale === "en" && plan.code in PLAN_CODE ? label(PLAN_CODE, plan.code) : plan.label}</p>
                        <p className="truncate text-[0.6875rem] text-muted-foreground">
                          {label(ROLE, plan.targetRole)}
                          {plan.isActive ? "" : d.planDisabled}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className="font-heading text-lg leading-none font-bold tabular-nums">
                          {formatNumber(plan.activeCount)}
                        </span>
                        <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
                          {formatAmount(plan.priceAmount, plan.priceCurrency)}
                          {plan.billingPeriodMonths === 1
                            ? d.perMonth
                            : fill(d.perMonths, { count: plan.billingPeriodMonths })}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          plan.activeCount > 0 ? "bg-brand" : "bg-accent",
                        )}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{d.plansEmpty}</p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
            <span>{d.plansReadOnly}</span>
            <Link
              href={href("/admin/finances?vue=abonnements")}
              className="font-semibold text-brand hover:underline"
            >
              {d.plansSubscriptions}
            </Link>
          </div>
        </Panel>
      </div>

      {/* Bandeau du prochain evenement publie. */}
      {data.nextEvent ? (
        <Panel className="flex flex-col items-center justify-between gap-3 p-3 md:flex-row">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <BellRingIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-bold">
                  {fill(d.nextEvent, { title: data.nextEvent.title })}
                </span>
                <span className="micro-label rounded bg-brand px-1.5 py-0.5 text-brand-foreground">
                  {daysUntil(data.nextEvent.event_date, d)}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fill(d.eventRegistrations, {
                  count: formatNumber(data.nextEventRegistrations),
                })}
                {data.nextEvent.capacity
                  ? fill(d.eventCapacity, { count: formatNumber(data.nextEvent.capacity) })
                  : ""}
                {data.nextEvent.location ? ` · ${data.nextEvent.location}` : ""}
                {data.nextEvent.start_time
                  ? ` · ${String(data.nextEvent.start_time).slice(0, 5)}`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex w-full shrink-0 items-center justify-end gap-2 md:w-auto">
            <Link
              href={href(`/admin/scout-days/${data.nextEvent.id}`)}
              className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-sm font-bold text-brand-foreground transition-[filter] hover:brightness-110"
            >
              {d.manageSession}
            </Link>
          </div>
        </Panel>
      ) : null}
    </>
  );
}

/**
 * Nombre de jours jusqu'a une date `YYYY-MM-DD`, en clair. Compare des chaines
 * de date, pas des `Date` locales : `event_date` est un `date` Postgres sans
 * fuseau, et le convertir decalerait l'evenement d'un jour selon le serveur.
 */
function daysUntil(date: string, d: AdminDictionary["dashboard"]) {
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const days = Math.round((target - start) / 86_400_000);
  if (days <= 0) return d.today;
  if (days === 1) return d.tomorrow;
  return fill(d.inDays, { days });
}

/** Une mesure compacte dans l'en-tete d'un panneau (maquette « flux financiers »). */
function MiniMetric({
  label: name,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "brand";
}) {
  return (
    <div className="min-w-0">
      <p className="micro-label text-muted-foreground">{name}</p>
      <p
        className={cn(
          "mt-1 font-heading text-base leading-tight font-bold tabular-nums",
          tone === "brand" ? "text-brand" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground">{hint}</p>
    </div>
  );
}


