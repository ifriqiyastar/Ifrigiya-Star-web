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
  EyeIcon,
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
import { formatAmount, formatDuration, formatNumber } from "@/lib/format";
import { ROLE, entry, label } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage({ searchParams }: PageProps<"/[locale]/admin">) {
  await requirePermission("dashboard.read");
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
  const activeUsers = users.reduce((acc, row) => acc + Number(row.actifs), 0);
  const newUsers30d = users.reduce((acc, row) => acc + Number(row.nouveaux_30j), 0);

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

  const roleRows: BreakdownRow[] = users
    .map((row) => ({
      label: entry(ROLE, row.role).label,
      value: Number(row.total),
      tone: entry(ROLE, row.role).tone,
      note: ROLE_NOTE[row.role],
    }))
    .sort((a, b) => b.value - a.value);


  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Accueil", href: "/admin" }, { label: "Tableau de bord" }]}
        title="Vue d'ensemble analytique"
        description="Activite et indicateurs de performance d'Ifriqiya Star. Les agregats sont recalcules a chaque ouverture de l'ecran ; chaque tuile renvoie a la liste qui la produit."
        actions={
          <>
            <DashboardPeriod value={period} />
            <Link
              href="/admin/utilisateurs"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-muted px-3 text-sm font-semibold hover:bg-accent"
            >
              <SlidersHorizontalIcon className="size-4" />
              Filtrer
            </Link>
            {/* « Exporter » pointe sur l'export qui existe : le journal des
                paiements en CSV. Pas d'export du tableau de bord lui-meme —
                il n'y a pas de fichier derriere. */}
            <Link
              href="/admin/finances/export"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-bold text-brand-foreground transition-[filter] hover:brightness-110"
            >
              <DownloadIcon className="size-4" />
              Exporter
            </Link>
          </>
        }
      />

      {data.error ? (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs leading-relaxed text-destructive">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Les agregats du tableau de bord n&apos;ont pas pu etre lus : {data.error}
          </span>
        </p>
      ) : null}

      {/* Huit indicateurs, dans l'ordre de la maquette. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Comptes au total"
          value={formatNumber(totalUsers)}
          icon={UsersIcon}
          delta={newUsers30d ? `+${formatNumber(newUsers30d)} ce mois` : undefined}
          hint={`${formatNumber(activeUsers)} profils actifs`}
          footNote={totalUsers ? `${Math.round((activeUsers / totalUsers) * 100)} % act.` : undefined}
          href="/admin/utilisateurs"
        />
        <StatCard
          label="Joueurs valides"
          value={formatNumber(validatedPlayers)}
          icon={BadgeCheckIcon}
          delta={validatedPlayers ? "Certifies" : undefined}
          deltaTone="info"
          hint={`${formatNumber(data.visiblePlayers)} indexes dans la recherche`}
          href="/admin/utilisateurs?role=player&statut=valide"
        />
        <StatCard
          label="Abonnements actifs"
          value={formatNumber(activeSubscriptions)}
          icon={CreditCardIcon}
          accent="secondary"
          delta={activeSubscriptions ? undefined : "Aucun actif"}
          deltaTone="neutral"
          hint={`${formatNumber(successfulTransactions)} transactions enregistrees`}
          footHref="/admin/finances?vue=offres"
          footLabel="Tarifs"
        />
        <StatCard
          label="Revenus encaisses"
          value={formatAmount(totalRevenue).replace(/\s*TND$/, "")}
          unit="TND"
          icon={WalletIcon}
          accent="tertiary"
          delta="Statut « reussi »"
          deltaTone="neutral"
          hint="Somme des paiements encaisses"
          footNote={`${period} derniers jours`}
          href="/admin/finances"
        />

        <StatCard
          label={`Connexions (${period} j)`}
          value={formatNumber(data.activePeriod)}
          icon={EyeIcon}
          accent="neutral"
          hint={`${formatNumber(data.active7d)} sur 7 j · ${formatNumber(data.active30d)} sur 30 j`}
          footNote="Comptes connectes"
        />
        <StatCard
          label="Scout Days"
          value={formatNumber(scoutDays?.total_evenements ?? 0)}
          icon={CalendarDaysIcon}
          delta={
            scoutDays?.total_inscriptions
              ? `${formatNumber(scoutDays.total_inscriptions)} inscrits`
              : undefined
          }
          hint={`${formatNumber(scoutDays?.publies ?? 0)} evenements publies`}
          href="/admin/scout-days"
        />
        <StatCard
          label="En attente valid."
          value={formatNumber(pendingPlayers + data.docsPending)}
          icon={ClockIcon}
          accent="tertiary"
          glow
          delta={pendingPlayers + data.docsPending > 0 ? "Priorite" : undefined}
          deltaTone="warning"
          hint={`${formatNumber(pendingPlayers)} joueurs · ${formatNumber(data.docsPending)} justificatifs`}
          footHref="/admin/validations"
          footLabel="Traiter"
        />
        <StatCard
          label="Signalements"
          value={formatNumber(data.pendingReports)}
          icon={FlagIcon}
          accent="error"
          glow
          delta={data.pendingReports ? "Arbitrage" : undefined}
          deltaTone="danger"
          hint="Contenus a instruire"
          footHref="/admin/moderation"
          footLabel="Ouvrir"
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
                Revenus &amp; flux financiers
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Paiements encaisses, decomposes en abonnements et inscriptions Scout Day.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 self-start rounded-lg bg-accent p-0.5 sm:self-auto">
              {FLUX_TABS.map((tab) => (
                <Link
                  key={tab.value}
                  href={`/admin?periode=${period}${tab.value === "tous" ? "" : `&flux=${tab.value}`}`}
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
              label="Revenu brut"
              value={formatAmount(chartTotal)}
              hint={`${period} derniers jours`}
            />
            <MiniMetric
              label="Panier moyen"
              value={
                successfulTransactions ? formatAmount(totalRevenue / successfulTransactions) : "—"
              }
              hint={`${formatNumber(successfulTransactions)} transaction(s) reussie(s)`}
            />
            <MiniMetric
              label="Taux de reussite"
              value={
                data.paymentsTotal
                  ? `${Math.round((data.paymentsSucceeded / data.paymentsTotal) * 100)} %`
                  : "—"
              }
              hint={`${formatNumber(data.paymentsSucceeded)} / ${formatNumber(data.paymentsTotal)} paiements`}
              tone="brand"
            />
          </div>

          <div className="mt-3 flex-1 overflow-hidden rounded-lg bg-background">
            <RevenueChart rows={chartRows} />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              Les montants sont ceux enregistres dans la table des paiements : aucun encaissement
              n&apos;est calcule ici.
            </span>
            <Link
              href="/admin/finances"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
            >
              Consulter le journal des paiements
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </Panel>

        <Panel className="flex flex-col justify-between p-4 lg:col-span-4">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                <PieChartIcon className="size-4 text-info" />
                Comptes par type
              </h2>
              <span className="micro-label rounded bg-accent px-1.5 py-0.5 text-muted-foreground">
                {formatNumber(totalUsers)} total
              </span>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Repartition des comptes par type sur la plateforme.
            </p>

            {roleRows.length ? (
              <BreakdownMeter rows={roleRows} total={totalUsers} />
            ) : (
              <p className="text-xs text-muted-foreground">Aucun compte.</p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-background/80 p-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <BadgeCheckIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Profils joueurs valides</p>
                  <p className="truncate text-[0.6875rem] text-muted-foreground">
                    {formatNumber(validatedPlayers)} sur {formatNumber(totalPlayers)} profils
                  </p>
                </div>
              </div>
              <span className="font-heading text-lg font-bold text-brand tabular-nums">
                {totalPlayers ? `${Math.round((validatedPlayers / totalPlayers) * 100)} %` : "—"}
              </span>
            </div>
          </div>

          <Link
            href="/admin/utilisateurs"
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-muted text-sm font-semibold hover:bg-accent"
          >
            <UsersIcon className="size-4" />
            Gerer l&apos;annuaire des utilisateurs
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
                Entonnoir d&apos;inscription joueurs
              </h3>
              <Link
                href="/admin/utilisateurs?role=player"
                className="rounded bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Voir details
              </Link>
            </div>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">
              Etat d&apos;avancement des profils joueurs dans le parcours de validation.
            </p>

            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              {FUNNEL_STEPS.map((step, index) => {
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
                        Etape {index + 1}
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
              Delai moyen d&apos;approbation administrative :{" "}
              <strong className="text-foreground">
                {data.approvalDelay === null ? "—" : formatDuration(data.approvalDelay)}
              </strong>
            </span>
            <span className="micro-label text-muted-foreground">
              {data.approvalDelay === null
                ? "Aucun profil valide"
                : "Moyenne sur les 200 derniers profils valides"}
            </span>
          </div>
        </Panel>

        <Panel className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-heading text-base font-bold">
                <AwardIcon className="size-4 text-warning" />
                Abonnements actifs par offre
              </h3>
              <Link
                href="/admin/finances?vue=offres"
                className="rounded bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Gerer les forfaits
              </Link>
            </div>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">
              Seules les souscriptions en cours sont comptabilisees. Les tarifs affiches sont
              ceux du catalogue d&apos;offres.
            </p>

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
                        <p className="truncate text-sm font-bold">{plan.label}</p>
                        <p className="truncate text-[0.6875rem] text-muted-foreground">
                          {label(ROLE, plan.targetRole)}
                          {plan.isActive ? "" : " · offre desactivee"}
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
                            ? " / mois"
                            : ` / ${plan.billingPeriodMonths} mois`}
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
              <p className="text-xs text-muted-foreground">
                La table subscription_plans est vide : aucune offre a afficher.
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
            <span>
              Le catalogue est en lecture seule : un tarif se change par migration, pas depuis le
              back-office.
            </span>
            <Link
              href="/admin/finances?vue=abonnements"
              className="font-semibold text-brand hover:underline"
            >
              Voir les souscriptions
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
                  Prochain evenement : {data.nextEvent.title}
                </span>
                <span className="micro-label rounded bg-brand px-1.5 py-0.5 text-brand-foreground">
                  {daysUntil(data.nextEvent.event_date)}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatNumber(data.nextEventRegistrations)} inscrit(s)
                {data.nextEvent.capacity
                  ? ` sur ${formatNumber(data.nextEvent.capacity)} places`
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
              href={`/admin/scout-days/${data.nextEvent.id}`}
              className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-sm font-bold text-brand-foreground transition-[filter] hover:brightness-110"
            >
              Gerer la session
            </Link>
          </div>
        </Panel>
      ) : null}
    </>
  );
}

/** Onglets du panneau financier : le libelle, et le type de paiement filtre. */
const FLUX_TABS = [
  { value: "tous", label: "Tous flux" },
  { value: "scout_days", label: "Scout Days" },
  { value: "abonnements", label: "Abonnements" },
] as const;

/** Precision affichee derriere chaque role dans la repartition des comptes. */
const ROLE_NOTE: Record<string, string> = {
  player: "Talents",
  professional: "Scouts, clubs",
  admin: "Staff Ifriqiya",
};

/**
 * Nombre de jours jusqu'a une date `YYYY-MM-DD`, en clair. Compare des chaines
 * de date, pas des `Date` locales : `event_date` est un `date` Postgres sans
 * fuseau, et le convertir decalerait l'evenement d'un jour selon le serveur.
 */
function daysUntil(date: string) {
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const days = Math.round((target - start) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} jours`;
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

/**
 * Les quatre etapes du parcours d'inscription joueur. Ce sont les membres reels
 * de `player_profile_status` — pas une modelisation d'entonnoir inventee pour
 * l'ecran : `suspendu` en est exclu parce qu'il n'appartient pas au parcours.
 */
const FUNNEL_STEPS = [
  { status: "incomplet", label: "Dossier incomplet", dot: "bg-muted-foreground/40" },
  { status: "en_attente_validation", label: "Pieces a examiner", dot: "bg-warning" },
  { status: "refuse", label: "Refuse, a corriger", dot: "bg-destructive" },
  { status: "valide", label: "Valides (actifs)", dot: "bg-brand" },
] as const;
