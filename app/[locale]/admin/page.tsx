import { getAdminI18n } from "@/lib/i18n/admin";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ActivityIcon,
  ArrowRightIcon,
  AwardIcon,
  BadgeCheckIcon,
  BellRingIcon,
  CalendarDaysIcon,
  CircleAlertIcon,
  ClockIcon,
  CrownIcon,
  DownloadIcon,
  CreditCardIcon,
  FilterIcon,
  FlagIcon,
  GavelIcon,
  HandCoinsIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  SquarePenIcon,
  UsersIcon,
  WalletIcon,
  PieChartIcon,
  TrendingUpIcon,
} from "lucide-react";

import { BreakdownMeter, type BreakdownRow } from "@/components/admin/breakdown-meter";
import { DashboardPeriod } from "@/components/admin/dashboard-period";
import { LinkPendingIcon } from "@/components/admin/link-pending-icon";
import { firstAccessiblePath } from "@/components/admin/nav-items";
import { PageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/admin/panel";
import { RevenueChart, type RevenueRow } from "@/components/admin/revenue-chart";
import { StatCard } from "@/components/admin/stat-card";
import { getDashboard } from "@/lib/queries/dashboard";
import { monthlySeries } from "@/lib/queries/dashboard-revenue";
import { fetchQueueCounts } from "@/lib/queries/admin-queue";
import { getAdminAccess, requireAdmin, type AdminPermission } from "@/lib/auth";
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

  const admin = await requireAdmin();
  const [locale, dict] = await Promise.all([getAdminLocale(), getAdminDict()]);
  const access = await getAdminAccess(admin.userId, dict);
  // Pas de redirection generique vers `/admin/acces-refuse` ici : un compte
  // sans `dashboard.read` (un editeur, par ex.) n'a rien fait de refuse, sa
  // page d'accueil est juste ailleurs — `/admin` reste le lien code en dur
  // apres connexion (`sign-in-form.tsx`).
  if (!access.permissions.includes("dashboard.read")) {
    redirect(localePath(locale, firstAccessiblePath(access.permissions)));
  }
  const d = dict.dashboard;
  const { formatAmount, formatDate, formatDuration, formatNumber } = makeFormat(locale);
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
  // ⚠️ `fetchQueueCounts()` N'EST PAS UN ALLER-RETOUR DE PLUS. La mise en page
  // l'a deja appelee pour la cloche et les pastilles, et elle est memoisee par
  // `cache()` sur la duree du rendu : la tuile « En attente de validation » et
  // la pastille du rail lisent donc le MEME comptage. Elles s'annoncaient
  // differentes — la tuile additionnait les joueurs et les justificatifs, la
  // pastille les quatre files — et deux nombres pour la meme chose, cote a
  // cote, sur le meme ecran.
  const [data, queue] = await Promise.all([getDashboard(period), fetchQueueCounts()]);
  const payload = data.payload;

  const users = payload?.users ?? [];
  const totalUsers = users.reduce((acc, row) => acc + Number(row.total), 0);

  const players = payload?.players ?? [];
  const validatedPlayers = Number(
    players.find((row) => row.status === "valide")?.total ?? 0,
  );
  // `pendingPlayers` a disparu d'ici : la tuile « En attente de validation »
  // ne compte plus les joueurs depuis cet agregat mais les quatre files depuis
  // `fetchQueueCounts()`, pour dire le meme nombre que la pastille du rail.
  // L'entonnoir, lui, lit toujours `players` etape par etape.
  const totalPlayers = players.reduce((acc, row) => acc + Number(row.total), 0);

  const subscriptions = payload?.subscriptions ?? [];
  const activeSubscriptions = subscriptions
    .filter((row) => row.status === "active")
    .reduce((acc, row) => acc + Number(row.total), 0);

  const scoutDays = payload?.scout_days;

  /**
   * ⚠️⚠️ LE FENETRAGE DES REVENUS SE FAIT EN BASE, PLUS ICI.
   *
   * Cet endroit portait le defaut : `public.admin_dashboard_revenue` rend une
   * ligne par MOIS (`date_trunc('month', paid_at)`), et la page ecartait
   * ensuite celle dont le PREMIER JOUR du mois tombait avant
   * `aujourd'hui - periode`. Consulte le 22 d'un mois, « 7 derniers jours »
   * ecartait donc le mois en cours tout entier et affichait zero quel que soit
   * l'encaisse ; « 30 derniers jours » ne montrait que le mois courant ;
   * « 12 derniers mois » en perdait un. Le filtre ignorait la granularite de
   * ce qu'il filtrait.
   *
   * `admin_dashboard_counts()` rend desormais la serie deja fenetree a la
   * journee, au pas qui convient a la duree demandee, et surtout la borne
   * basse REELLE de cette fenetre — c'est elle qu'on affiche, pas la duree
   * cliquee.
   */
  const periodRevenue = data.revenue;
  const series = periodRevenue ? periodRevenue.rows : monthlySeries(payload?.revenue);
  const granularity = periodRevenue?.bucket ?? "mois";

  /**
   * La periode telle qu'elle a ete MESUREE, en clair.
   *
   * Deux libelles et non un : sans la fonction, les comptes actifs sont bien
   * lus sur la duree choisie (`activePeriod`) tandis que les revenus
   * retombent sur les douze mois de la vue mobile. Un seul libelle en
   * couvrirait un des deux de travers.
   */
  const periodSpan = periodRevenue
    ? fill(d.since, { date: formatDate(periodRevenue.from) })
    : fill(d.lastDays, { days: period });
  const revenueSpan = periodRevenue ? periodSpan : d.last12Months;

  // Le filtre de flux ne masque pas des barres : il retire la serie ecartee du
  // total comme du graphique, pour que le chiffre affiche corresponde a ce
  // qu'on voit.
  const chartRows: RevenueRow[] = series.map((row) => ({
    bucket: row.bucket,
    abonnement: flux === "scout_days" ? 0 : row.abonnement,
    scout_day: flux === "abonnements" ? 0 : row.scoutDay,
  }));
  const chartTotal = chartRows.reduce((acc, row) => acc + row.abonnement + row.scout_day, 0);

  /**
   * ⚠️ LE NUMERATEUR ET LE DENOMINATEUR DU PANIER MOYEN SORTENT DE LA MEME
   * FENETRE ET DU MEME FILTRE. Ils n'en sortaient pas : le montant etait
   * filtre sur la periode, le nombre de transactions etait compte sur TOUT
   * l'historique. Le panier moyen etait donc mecaniquement sous-estime, et
   * d'autant plus que la periode etait courte.
   */
  const chartTransactions = series.reduce(
    (acc, row) =>
      acc +
      (flux === "scout_days" ? 0 : row.abonnementTx) +
      (flux === "abonnements" ? 0 : row.scoutDayTx),
    0,
  );

  // Le total de la tuile « Revenus encaisses » ignore le filtre de flux — la
  // tuile n'est pas dans le panneau qui le porte — mais vient bien de la meme
  // serie, donc de la meme fenetre.
  const totalRevenue = series.reduce((acc, row) => acc + row.abonnement + row.scoutDay, 0);
  const totalTransactions = series.reduce(
    (acc, row) => acc + row.abonnementTx + row.scoutDayTx,
    0,
  );

  /**
   * L'evolution par rapport a la fenetre precedente, de duree ecoulee egale.
   *
   * ⚠️ Une variation en pourcentage demande un denominateur non nul. Zero
   * precedent n'est pas « +100 % », c'est l'absence de point de comparaison —
   * et l'ecrire autrement inventerait une performance.
   */
  const previousTotal = periodRevenue?.previousTotal ?? null;
  const revenueDelta =
    previousTotal === null
      ? null
      : previousTotal > 0
        ? Math.round(((totalRevenue - previousTotal) / previousTotal) * 100)
        : totalRevenue > 0
          ? "sans-precedent"
          : null;

  /**
   * Le taux de reussite des encaissements, sur la fenetre quand la base sait
   * la calculer. Sinon il reste celui de tout l'historique — et le libelle le
   * dit, au lieu de laisser un chiffre depuis l'origine sous un intitule de
   * periode.
   */
  const paymentsTotal = periodRevenue?.paymentsTotal ?? data.paymentsTotal;
  const paymentsSucceeded = periodRevenue?.paymentsSucceeded ?? data.paymentsSucceeded;

  /**
   * Les quatre files de validation, comptees une seule fois pour tout l'ecran
   * (voir `fetchQueueCounts()` plus haut). La tuile additionnait les joueurs
   * et les justificatifs, oubliant les professionnels et les verifications
   * d'identite : elle annoncait moins de travail qu'il n'y en avait, et moins
   * que la pastille posee juste a cote.
   */
  const pendingValidations =
    queue.players + queue.professionals + queue.documents + queue.identity;
  const pendingProfiles = queue.players + queue.professionals;
  const pendingDocuments = queue.documents + queue.identity;

  /** L'argent qui attend un geste : a encaisser, ou a confirmer. */
  const awaitingMoney = queue.collect + queue.paymentsPending;
  const canSeeFinance = access.permissions.includes("finance.manage");

  /**
   * Les files qu'un super administrateur est SEUL a pouvoir vider. Elles
   * n'existaient que dans la cloche : l'ecran d'accueil du seul role qui
   * debloque ces quatre gestes n'en disait rien.
   *
   * Chaque ligne porte la permission qui la revele — la meme que celle du
   * `QUEUES` de la cloche, et la meme que celle du Server Action qui tranche.
   * Les lignes a zero restent affichees : « rien n'attend » est une reponse,
   * et seule une ligne presente permet de la lire.
   */
  const superTasks = [
    {
      key: "removals",
      permission: "moderation.validate" as AdminPermission,
      label: d.superRemovals,
      count: queue.removals,
      icon: GavelIcon,
      href: href("/admin/moderation/signalements?statut=a_valider"),
    },
    {
      key: "posts",
      permission: "content.validate" as AdminPermission,
      label: d.superPosts,
      count: queue.posts,
      icon: SquarePenIcon,
      href: href("/admin/moderation/publications?etat=attente"),
    },
    {
      key: "comments",
      permission: "content.validate" as AdminPermission,
      label: d.superComments,
      count: queue.comments,
      icon: MessageSquareIcon,
      href: href("/admin/moderation/commentaires?etat=attente"),
    },
    {
      key: "scoutDays",
      permission: "events.validate" as AdminPermission,
      label: d.superScoutDays,
      count: queue.scoutDays,
      icon: CalendarDaysIcon,
      href: href("/admin/scout-days?statut=en_attente_validation"),
    },
  ].filter((task) => access.permissions.includes(task.permission));

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
            {/* La periode s'applique des la selection : le bouton « Filtrer »
                qui suivait — un lien vers l'annuaire des utilisateurs — a ete
                retire a la demande du client. */}
            <DashboardPeriod value={period} />
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

      {/* Les indicateurs, dans l'ordre de la maquette. Deux par rangee des le
          plus petit ecran : empilees une par une, elles occupaient environ 700
          px — un ecran et demi de telephone a faire defiler avant d'atteindre
          le moindre graphique. `StatCard` a ete rendu lisible a cette largeur
          (intitule sur deux lignes, fleche retiree) plutot que l'inverse.

          Huit desormais, et non six : « Comptes actifs » et « Encaissements en
          attente » s'ajoutent. La premiere etait DEJA CALCULEE — la base la
          rendait, le type la portait, et personne ne l'affichait : tout
          l'ecran disait un stock ou un arriere, rien ne disait si quelqu'un se
          connecte. La seconde est la file que le client a demandee en octobre
          2026 ; elle vivait dans la cloche et dans le rail, jamais sur l'ecran
          d'accueil. */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          hint={fill(d.transactions, { count: formatNumber(totalTransactions) })}
          footHref={href("/admin/finances/abonnements")}
          footLabel={d.plansSubscriptions}
        />
        <StatCard
          label={d.revenue}
          value={formatNumber(Math.round(totalRevenue))}
          unit="TND"
          icon={WalletIcon}
          accent="tertiary"
          // Une evolution plutot qu'un rappel de statut : « Statut reussi »
          // decrivait la requete, pas le resultat. La comparaison porte sur la
          // fenetre precedente de meme duree ecoulee, et disparait quand il n'y
          // a rien a comparer.
          delta={
            revenueDelta === null
              ? d.statusSucceeded
              : revenueDelta === "sans-precedent"
                ? d.noPrevious
                : `${revenueDelta > 0 ? "+" : ""}${formatNumber(revenueDelta)} %`
          }
          deltaTone={
            typeof revenueDelta === "number"
              ? revenueDelta < 0
                ? "danger"
                : "brand"
              : "neutral"
          }
          hint={d.revenueHint}
          footNote={revenueSpan}
          href={href("/admin/finances/paiements")}
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
          value={formatNumber(pendingValidations)}
          icon={ClockIcon}
          accent="tertiary"
          delta={pendingValidations > 0 ? d.priority : undefined}
          deltaTone="warning"
          // ⚠️ LES QUATRE FILES, pas deux. Le detail est regroupe en deux
          // nombres — les dossiers d'un cote, les pieces de l'autre — parce
          // qu'une ligne de pied tronquee cacherait en silence ce qu'elle
          // n'affiche pas, ce que le reste du back-office s'interdit.
          hint={fill(d.pendingHint, {
            profiles: formatNumber(pendingProfiles),
            docs: formatNumber(pendingDocuments),
          })}
          footHref={href("/admin/validations")}
          footLabel={d.handle}
        />
        <StatCard
          label={d.reports}
          value={formatNumber(data.pendingReports)}
          icon={FlagIcon}
          accent="error"
          delta={data.pendingReports ? d.arbitration : undefined}
          deltaTone="danger"
          hint={d.reportsHint}
          footHref={href("/admin/moderation/signalements")}
          footLabel={d.openReports}
        />
        {/* Le seul indicateur d'usage de l'ecran : tout le reste compte un
            stock (comptes, offres) ou un arriere (files). Il se lit sur
            `profiles.last_login_at`, donc sur une connexion reelle. */}
        <StatCard
          label={d.activeAccounts}
          value={formatNumber(data.activePeriod)}
          icon={ActivityIcon}
          accent="secondary"
          delta={data.activePeriod ? undefined : d.noneActive}
          deltaTone="neutral"
          hint={fill(d.activeHint, {
            week: formatNumber(data.active7d),
            month: formatNumber(data.active30d),
          })}
          footNote={periodSpan}
          href={href("/admin/utilisateurs")}
        />
        {/* ⚠️ Reservee a `finance.manage`. Une tuile qui mene a un ecran que
            `requirePermission()` refusera n'est pas une information, c'est une
            impasse — meme regle que les files de la cloche. */}
        {canSeeFinance ? (
          <StatCard
            label={d.toCollect}
            value={formatNumber(awaitingMoney)}
            icon={HandCoinsIcon}
            accent="tertiary"
            delta={awaitingMoney ? d.priority : undefined}
            deltaTone="warning"
            hint={fill(d.toCollectHint, {
              collect: formatNumber(queue.collect),
              pending: formatNumber(queue.paymentsPending),
            })}
            footHref={href("/admin/finances/paiements")}
            footLabel={d.handle}
          />
        ) : null}
      </section>

      {/* Les gestes que personne d'autre ne peut faire. Ils n'apparaissaient
          que dans la cloche : l'ecran d'accueil du seul role qui les debloque
          n'en disait rien, et une publication pouvait attendre sans que rien
          ne la rappelle a qui doit la trancher. */}
      {superTasks.length ? (
        <Panel className="p-4">
          <div className="pb-3">
            <h2 className="flex items-center gap-2 font-heading text-base font-bold">
              <CrownIcon className="size-4 text-brand" />
              {d.superTitle}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{d.superDesc}</p>
          </div>
          <ul className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {superTasks.map((task) => (
              <li key={task.key}>
                <Link
                  href={task.href}
                  className={cn(
                    "flex h-full items-center gap-3 rounded-lg p-3 transition-colors",
                    task.count > 0 ? "bg-warning/10 hover:bg-warning/15" : "bg-muted hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      task.count > 0
                        ? "bg-warning/20 text-warning"
                        : "bg-accent text-muted-foreground",
                    )}
                  >
                    <task.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block font-heading text-lg leading-none font-bold tabular-nums",
                        task.count > 0 ? "text-warning" : "text-muted-foreground",
                      )}
                    >
                      {formatNumber(task.count)}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {task.label}
                    </span>
                  </span>
                  <LinkPendingIcon className="ml-auto size-3 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
          {/* La note ne parle que des publications et des commentaires : elle
              ne s'affiche donc que si ces lignes-la sont montrees. Un compte
              qui ne tient que les retraits lirait sinon une precision sur une
              file qu'il ne voit pas. */}
          {access.permissions.includes("content.validate") ? (
            <p className="mt-3 text-xs text-muted-foreground">{d.superFootnote}</p>
          ) : null}
        </Panel>
      ) : null}

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
              {/* La periode mesuree est ecrite ici, une fois, au-dessus des
                  trois mesures et du graphique qu'elle gouverne. */}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {d.fluxDesc} <span className="text-foreground">{revenueSpan}</span>
              </p>
            </div>
            <div className="-mx-1 flex shrink-0 items-center gap-0.5 self-start overflow-x-auto rounded-lg bg-accent p-0.5 px-1 sm:mx-0 sm:self-auto sm:px-0.5">
              {fluxTabs.map((tab) => (
                <Link
                  key={tab.value}
                  // ⚠️ `i18n.path()` SEUL. `href()` est `localePath(locale, …)`
                  // et `i18n.path()` vaut `localePath(locale, stripLocale(…))` :
                  // les enchainer prefixait deux fois, et l'onglet menait a
                  // `/en/en/admin?flux=…`. Invisible en francais, ou
                  // `localePath` ne prefixe rien — cassé en anglais et en arabe.
                  href={i18n.path(
                    `/admin?periode=${period}${tab.value === "tous" ? "" : `&flux=${tab.value}`}`,
                  )}
                  className={cn(
                    "micro-label inline-flex min-h-9 shrink-0 items-center gap-1 rounded px-2.5 py-1 transition-colors sm:min-h-0",
                    flux === tab.value
                      ? "bg-muted font-bold text-brand"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {/* La page relit la base a chaque clic : sans indicateur,
                      l'onglet semblait ne pas reagir jusqu'a la reponse. */}
                  <LinkPendingIcon className="size-3" />
                </Link>
              ))}
            </div>
          </div>

          {/* Trois mesures avant la courbe. Elles suivent le filtre de flux :
              le « revenu brut » affiche est celui des barres visibles. */}
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-background/60 p-3 sm:gap-3">
            <MiniMetric
              label={d.grossRevenue}
              value={formatAmount(chartTotal)}
              hint={revenueSpan}
            />
            {/* ⚠️ Montant ET nombre de transactions sortent de `chartTransactions`
                / `chartTotal` : meme fenetre, meme filtre de flux. Le montant
                etait filtre et le compte ne l'etait pas, ce qui sous-estimait
                le panier d'autant plus que la periode etait courte. */}
            <MiniMetric
              label={d.averageBasket}
              value={chartTransactions ? formatAmount(chartTotal / chartTransactions) : "—"}
              hint={fill(d.basketHint, { count: formatNumber(chartTransactions) })}
            />
            <MiniMetric
              label={d.successRate}
              value={
                paymentsTotal
                  ? `${Math.round((paymentsSucceeded / paymentsTotal) * 100)} %`
                  : "—"
              }
              // Sans la fonction, ce taux reste celui de tout l'historique :
              // le libelle le dit plutot que de le laisser passer pour un
              // chiffre de periode.
              hint={fill(periodRevenue ? d.successHint : d.successHintAll, {
                ok: formatNumber(paymentsSucceeded),
                total: formatNumber(paymentsTotal),
              })}
              tone="brand"
            />
          </div>

          <div className="mt-3 flex-1 overflow-hidden rounded-lg bg-background">
            <RevenueChart rows={chartRows} granularity={granularity} />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">{d.fluxFootnote}</span>
            <Link
              href={href("/admin/finances/paiements")}
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
              href={href("/admin/finances/abonnements")}
              className="font-semibold text-brand hover:underline"
            >
              {d.plansSubscriptions}
            </Link>
          </div>
        </Panel>
      </div>

      {/* Bandeau du prochain evenement publie. */}
      {data.nextEvent ? (
        <Panel className="flex flex-col items-stretch justify-between gap-3 p-3 md:flex-row md:items-center">
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
          <div className="flex w-full shrink-0 items-center gap-2 md:w-auto md:justify-end">
            <Link
              href={href(`/admin/scout-days/${data.nextEvent.id}`)}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand px-3 text-sm font-bold text-brand-foreground transition-[filter] hover:brightness-110 md:h-8 md:w-auto"
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
          // Trois colonnes des le telephone : a ~100 px de case, un montant
          // formate (« 1 234,56 TND ») depassait en 16 px.
          "mt-1 font-heading text-sm leading-tight font-bold tabular-nums sm:text-base",
          tone === "brand" ? "text-brand" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground">{hint}</p>
    </div>
  );
}


