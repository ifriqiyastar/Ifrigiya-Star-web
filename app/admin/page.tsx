import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarDaysIcon,
  CircleAlertIcon,
  CreditCardIcon,
  EyeIcon,
  FlagIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UsersIcon,
  WalletIcon,
  ArrowUpRightIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import { BreakdownMeter, type BreakdownRow } from "@/components/admin/breakdown-meter";
import { DashboardPeriod } from "@/components/admin/dashboard-period";
import { RevenueChart, type RevenueRow } from "@/components/admin/revenue-chart";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboard } from "@/lib/queries/dashboard";
import { requirePermission } from "@/lib/auth";
import { formatAmount, formatNumber } from "@/lib/format";
import { ACCOUNT_STATUS, PLAN_CODE, ROLE, entry } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  await requirePermission("dashboard.read");
  const resolved = await searchParams;
  const requestedPeriod = Number(typeof resolved.periode === "string" ? resolved.periode : 30);
  const period = [7, 30, 90, 365].includes(requestedPeriod) ? requestedPeriod : 30;
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

  const successfulTransactions = (payload?.revenue ?? []).reduce(
    (acc, row) => acc + Number(row.nb_transactions_reussies ?? 0),
    0,
  );

  const roleRows: BreakdownRow[] = users
    .map((row) => ({
      label: entry(ROLE, row.role).label,
      value: Number(row.total),
      tone: entry(ROLE, row.role).tone,
    }))
    .sort((a, b) => b.value - a.value);

  const playerStatusRows: BreakdownRow[] = players
    .map((row) => ({
      label: entry(ACCOUNT_STATUS, row.status).label,
      value: Number(row.total),
      tone: entry(ACCOUNT_STATUS, row.status).tone,
    }))
    .sort((a, b) => b.value - a.value);

  const planRows: BreakdownRow[] = Object.entries(
    subscriptions.reduce<Record<string, number>>((acc, row) => {
      if (row.status !== "active") return acc;
      acc[row.plan] = (acc[row.plan] ?? 0) + Number(row.total);
      return acc;
    }, {}),
  )
    .map(([plan, value]) => ({
      label: entry(PLAN_CODE, plan).label,
      value,
      tone: entry(PLAN_CODE, plan).tone,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-extrabold tracking-tight lg:text-2xl">Vue d&apos;ensemble</h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Activite en temps reel et indicateurs cles d&apos;Ifriqiya Star.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/utilisateurs" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}><SlidersHorizontalIcon /> Filtrer</Link>
          <DashboardPeriod value={period} />
        </div>
      </section>

      {data.error ? (
        <p className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs leading-relaxed text-destructive">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Les agregats du tableau de bord n&apos;ont pas pu etre lus :{" "}
            {data.error}
          </span>
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric
          label="Comptes au total"
          value={formatNumber(totalUsers)}
          hint={`${formatNumber(activeUsers)} actifs · ${formatNumber(newUsers30d)} nouveaux sur 30 j`}
          icon={UsersIcon}
        />
        <DashboardMetric
          label="Joueurs valides"
          value={formatNumber(validatedPlayers)}
          hint={`${formatNumber(data.visiblePlayers)} profils visibles dans la recherche`}
          icon={UserCheckIcon}
        />
        <DashboardMetric
          label="Abonnements actifs"
          value={formatNumber(activeSubscriptions)}
          hint={`${formatNumber(successfulTransactions)} transactions reussies`}
          icon={CreditCardIcon}
        />
        <DashboardMetric
          label="Revenus encaisses"
          value={formatAmount(totalRevenue)}
          hint="Somme des paiements au statut « reussi »"
          icon={WalletIcon}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric
          label={`Connexions (${period} j)`}
          value={formatNumber(data.activePeriod)}
          hint={`${formatNumber(data.active7d)} sur 7 j · ${formatNumber(data.active30d)} sur 30 j`}
          icon={EyeIcon}
        />
        <DashboardMetric
          label="Scout Days"
          value={formatNumber(scoutDays?.total_evenements ?? 0)}
          hint={`${formatNumber(scoutDays?.publies ?? 0)} publies · ${formatNumber(scoutDays?.total_inscriptions ?? 0)} inscriptions`}
          icon={CalendarDaysIcon}
        />
        <DashboardMetric
          label="En attente de validation"
          value={formatNumber(pendingPlayers + data.docsPending)}
          hint={`${formatNumber(pendingPlayers)} joueurs · ${formatNumber(data.docsPending)} justificatifs`}
          icon={ShieldCheckIcon}
        />
        <DashboardMetric
          label="Signalements a traiter"
          value={formatNumber(data.pendingReports)}
          hint={`${formatNumber(data.pendingPayments)} paiements en attente`}
          icon={FlagIcon}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>Revenus par mois</CardTitle>
            <CardDescription>Paiements encaisses, decomposes en abonnements et inscriptions Scout Day.</CardDescription>
            <CardAction>
              <Link
                href="/admin/finances"
                className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
              >
                Detail
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0"><RevenueChart rows={revenueRows} /></CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b"><CardTitle>Comptes par type</CardTitle><CardDescription>Repartition de profiles.role.</CardDescription></CardHeader>
          <CardContent>
            {roleRows.length ? (
              <BreakdownMeter rows={roleRows} total={totalUsers} />
            ) : (
              <p className="text-xs text-muted-foreground">Aucun compte.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Profils joueurs par statut</CardTitle>
            <CardDescription>Etat du tunnel d&apos;inscription (player_profiles.status).</CardDescription>
            <CardAction>
              <Link
                href="/admin/utilisateurs?role=player"
                className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
              >
                Voir
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {playerStatusRows.length ? (
              <BreakdownMeter rows={playerStatusRows} />
            ) : (
              <p className="text-xs text-muted-foreground">Aucun profil joueur.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Abonnements actifs par offre</CardTitle>
            <CardDescription>Seules les souscriptions au statut « active » sont comptees.</CardDescription>
            <CardAction>
              <Link
                href="/admin/finances"
                className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
              >
                Voir
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {planRows.length ? (
              <BreakdownMeter rows={planRows} total={activeSubscriptions} />
            ) : (
              <p className="text-xs text-muted-foreground">Aucun abonnement actif.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function DashboardMetric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card size="sm" className="dashboard-metric @container/card relative gap-4 overflow-hidden rounded-2xl border border-border bg-card shadow-none ring-0">
      <CardHeader>
        <CardDescription className="flex items-center gap-2 text-xs font-medium text-foreground/75 lg:text-sm"><Icon className="size-4" />{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-tight normal-case tabular-nums lg:text-3xl">
          {value}
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="size-7 justify-center rounded-full border-border bg-background/50 p-0 text-primary">
            <ArrowUpRightIcon className="size-3.5" />
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="relative border-t border-white/5 bg-black/10 py-2 text-[10px] text-muted-foreground lg:text-xs">
        {hint}
      </CardFooter>
    </Card>
  );
}
