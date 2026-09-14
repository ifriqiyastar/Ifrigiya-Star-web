import { getAdminI18n } from "@/lib/i18n/admin";
import type { Metadata } from "next";
import Link from "next/link";
import {
  CreditCardIcon,
  DownloadIcon,
  ReceiptTextIcon,
  TrendingUpIcon,
  Undo2Icon,
  WalletIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { CopyButton } from "@/components/admin/copy-button";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterBar } from "@/components/admin/filter-bar";
import { NoteCards } from "@/components/admin/note-cards";
import { HeaderMeta, PageHeader } from "@/components/admin/page-header";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { Pagination } from "@/components/admin/pagination";
import { RevenueChart, type RevenueRow } from "@/components/admin/revenue-chart";
import { SegmentedNav } from "@/components/admin/segmented-nav";
import { StatCard } from "@/components/admin/stat-card";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  activatePaymentManually,
  setPaymentStatus,
  setSubscriptionStatus,
} from "@/lib/actions/finances";

import { PAYMENT_METHOD, PAYMENT_STATUS, PAYMENT_TYPE, PLAN_CODE, ROLE, SUBSCRIPTION_STATUS } from "@/lib/labels";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Abonnements & paiements") };
}
const PAGE_SIZE = 20;

const VUES = ["paiements", "abonnements", "offres"] as const;
type Vue = (typeof VUES)[number];

export default async function FinancesPage({ searchParams }: PageProps<"/[locale]/admin/finances">) {
  const i18n = await getAdminI18n();

  await requirePermission("finance.manage");
  const resolved = await searchParams;
  const requested = typeof resolved.vue === "string" ? resolved.vue : "paiements";
  const vue: Vue = (VUES as readonly string[]).includes(requested)
    ? (requested as Vue)
    : "paiements";

  const params = {
    vue: typeof resolved.vue === "string" ? resolved.vue : undefined,
    q: str(resolved.q),
    statut: str(resolved.statut),
    type: str(resolved.type),
    moyen: str(resolved.moyen),
    page: str(resolved.page),
  };

  const supabase = await createClient();

  // Synthese : lue directement sur `payments` plutot que sur la vue agregee,
  // pour pouvoir compter aussi les statuts non encaisses (en attente, echoue).
  const { data: allPayments } = await supabase
    .from("payments")
    .select("amount, currency, payment_type, status, paid_at")
    .limit(5000);

  const payments = allPayments ?? [];
  const collected = payments
    .filter((row) => ["reussi", "active_manuellement"].includes(row.status))
    .reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
  const pendingAmount = payments
    .filter((row) => row.status === "en_attente")
    .reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
  const refunded = payments
    .filter((row) => row.status === "rembourse")
    .reduce((acc, row) => acc + Number(row.amount ?? 0), 0);

  const { count: activeSubscriptions } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  // Revenus par mois, recalcules cote application depuis `paid_at`.
  const byMonth = new Map<string, RevenueRow>();
  for (const row of payments) {
    if (!row.paid_at) continue;
    if (!["reussi", "active_manuellement"].includes(row.status)) continue;
    const date = new Date(row.paid_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    const current = byMonth.get(key) ?? { mois: key, abonnement: 0, scout_day: 0 };
    const amount = Number(row.amount ?? 0);
    if (row.payment_type === "abonnement") current.abonnement += amount;
    else current.scout_day += amount;
    byMonth.set(key, current);
  }
  const revenueRows = [...byMonth.values()].sort((a, b) =>
    (a.mois ?? "").localeCompare(b.mois ?? ""),
  );

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: i18n.t("Paiements et revenus") }, { label: i18n.t("Finances et tresorerie") }]}
        title={i18n.t("Abonnements, encaissements & finances")}
        meta={<HeaderMeta tone="brand">{i18n.format.formatAmount(collected)}  {i18n.t("encaisses")}</HeaderMeta>}
        description={i18n.t("Suivi des encaissements, des souscriptions et du catalogue d'offres. Les tarifs, commissions et regles de remboursement ne sont pas arretes par le cahier des charges : cet ecran suit ce qui est enregistre, il ne facture pas.")}
        actions={<Link href={i18n.path("/admin/finances/export")} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}><DownloadIcon />  {i18n.t("Exporter CSV")}</Link>}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={i18n.t("Encaisse")}
          value={i18n.format.formatAmount(collected)}
          hint={i18n.t("Paiements « reussi » et « active manuellement »")}
          icon={WalletIcon}
        />
        <StatCard
          label={i18n.t("En attente")}
          value={i18n.format.formatAmount(pendingAmount)}
          hint={i18n.t("A confirmer ou a activer manuellement")}
          icon={ReceiptTextIcon}
        />
        <StatCard
          label={i18n.t("Rembourse")}
          value={i18n.format.formatAmount(refunded)}
          icon={Undo2Icon}
          deltaTone="warning"
        />
        <StatCard
          label={i18n.t("Abonnements actifs")}
          value={i18n.format.formatNumber(activeSubscriptions ?? 0)}
          icon={CreditCardIcon}
          accent="secondary"
          href={i18n.path("/admin/finances?vue=abonnements")}
        />
      </section>

      <Panel>
        <PanelHeader
          icon={TrendingUpIcon}
          title={i18n.t("Revenus par mois et projection comptable")}
          description={i18n.t("Recalcules depuis la date d'encaissement, decomposes par type de paiement.")}
        />
        <RevenueChart rows={revenueRows} />
      </Panel>

      <SegmentedNav
        basePath={i18n.path("/admin/finances")}
        active={vue}
        params={params}
        segments={[
          { value: "paiements", label: i18n.t("Paiements") },
          { value: "abonnements", label: i18n.t("Abonnements") },
          { value: "offres", label: i18n.t("Catalogue d'offres") },
        ]}
      />

      {vue === "paiements" ? <PaymentsView params={params} /> : null}
      {vue === "abonnements" ? <SubscriptionsView params={params} /> : null}
      {vue === "offres" ? <PlansView /> : null}

      <NoteCards
        notes={[
          {
            icon: WalletIcon,
            title: i18n.t("Cet ecran suit, il ne facture pas"),
            body: i18n.t("Les montants affiches sont ceux enregistres dans la table des paiements. Tarifs, commissions et regles de remboursement ne sont pas arretes par le cahier des charges : rien n'est calcule ici, tout est repris tel quel."),
          },
          {
            icon: ReceiptTextIcon,
            title: i18n.t("Activation manuelle"),
            body: i18n.t("Un encaissement hors ligne se confirme a la main : le paiement passe a « active manuellement » et rejoint les montants encaisses. Le geste est trace, et il reste distinct d'un paiement confirme par la passerelle."),
          },
          {
            icon: CreditCardIcon,
            title: i18n.t("Un abonnement actif n'est pas un paiement"),
            body: i18n.t("Le compteur d'abonnements lit le statut des souscriptions, pas les transactions. Les deux peuvent diverger le temps qu'un paiement soit confirme — c'est normal, et c'est pourquoi ils sont affiches separement."),
          },
        ]}
      />
    </>
  );
}

/* ----------------------------------------------------------------- paiements */

async function PaymentsView({ params }: { params: Record<string, string | undefined> }) {
  const i18n = await getAdminI18n();

  const supabase = await createClient();
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  let query = supabase
    .from("payments")
    .select(
      "id, profile_id, payment_type, subscription_id, scout_day_registration_id, amount, currency, method, status, provider_reference, manually_activated_at, paid_at, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (params.statut) query = query.eq("status", params.statut);
  if (params.type) query = query.eq("payment_type", params.type);
  if (params.moyen) query = query.eq("method", params.moyen);

  const { data, error, count } = await query;
  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(rows.map((row) => row.profile_id));

  const filtered = params.q
    ? rows.filter((row) => {
        const term = params.q!.toLowerCase();
        const profile = profiles.get(row.profile_id);
        return (
          row.provider_reference?.toLowerCase().includes(term) ||
          profile?.full_name?.toLowerCase().includes(term) ||
          profile?.email?.toLowerCase().includes(term)
        );
      })
    : rows;

  return (
    <Panel>
      <PanelHeader
        title={i18n.t("Paiements")}
        description={i18n.t("« Activer manuellement » sert aux encaissements hors ligne et laisse une trace de l'administrateur qui a valide.")}
      />
      <FilterBar
        basePath={i18n.path("/admin/finances")}
        params={params}
        searchPlaceholder={i18n.t("Reference, nom, email…")}
        filters={[
          { name: "statut", label: i18n.t("Statut"), options: i18n.labels.options(PAYMENT_STATUS) },
          { name: "type", label: i18n.t("Objet"), options: i18n.labels.options(PAYMENT_TYPE) },
          { name: "moyen", label: i18n.t("Moyen"), options: i18n.labels.options(PAYMENT_METHOD) },
        ]}
      />
      {error ? (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
          {i18n.t("Lecture impossible :")} {error.message}
        </p>
      ) : null}
      {!filtered.length ? (
        <EmptyState
          icon={ReceiptTextIcon}
          title={i18n.t("Aucun paiement")}
          description={i18n.t("Aucun paiement ne correspond a ces criteres.")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t("Compte")}</TableHead>
              <TableHead>{i18n.t("Objet")}</TableHead>
              <TableHead>{i18n.t("Montant")}</TableHead>
              <TableHead>{i18n.t("Moyen")}</TableHead>
              <TableHead>{i18n.t("Statut")}</TableHead>
              <TableHead>{i18n.t("Reference")}</TableHead>
              <TableHead>{i18n.t("Encaisse le")}</TableHead>
              <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => {
              const profile = profiles.get(row.profile_id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={displayName(profile, undefined, i18n.locale)}
                      secondary={profile?.email}
                      avatarUrl={profile?.avatar_url}
                      href={i18n.path(`/admin/utilisateurs/${row.profile_id}?vue=finances`)}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={i18n.labels.entry(PAYMENT_TYPE, row.payment_type).tone}>
                      {i18n.labels.label(PAYMENT_TYPE, row.payment_type)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {i18n.format.formatAmount(row.amount, row.currency ?? "TND")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i18n.labels.label(PAYMENT_METHOD, row.method)}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={i18n.labels.entry(PAYMENT_STATUS, row.status).tone}>
                      {i18n.labels.label(PAYMENT_STATUS, row.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="max-w-48 text-xs text-muted-foreground">
                    {row.provider_reference ? <span className="flex items-center gap-1"><span className="max-w-32 truncate">{row.provider_reference}</span><CopyButton value={row.provider_reference} label={i18n.t("Copier la reference")} /></span> : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i18n.format.formatDate(row.paid_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {row.status === "en_attente" ? (
                        <>
                          <ActionButton action={activatePaymentManually.bind(null, row.id)}>
                            {i18n.t("Activer manuellement")}</ActionButton>
                          <ActionButton
                            variant="secondary"
                            action={setPaymentStatus.bind(null, row.id, "reussi")}
                          >
                            {i18n.t("Marquer reussi")}</ActionButton>
                          <ActionButton
                            variant="destructive"
                            action={setPaymentStatus.bind(null, row.id, "echoue")}
                          >
                            {i18n.t("Echoue")}</ActionButton>
                        </>
                      ) : null}
                      {["reussi", "active_manuellement"].includes(row.status) ? (
                        <ReasonDialog
                          action={setPaymentStatus.bind(null, row.id, "rembourse")}
                          trigger={<Button variant="destructive" size="xs">{i18n.t("Rembourser")}</Button>}
                          title={i18n.t("Marquer ce paiement rembourse")}
                          description={i18n.t("Indiquez le motif. Le montant sortira des revenus encaisses, mais le remboursement effectif chez le prestataire doit etre confirme separement.")}
                          label={i18n.t("Motif du remboursement")}
                          submitLabel={i18n.t("Marquer rembourse")}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Pagination basePath={i18n.path("/admin/finances")} params={params} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </Panel>
  );
}

/* --------------------------------------------------------------- abonnements */

async function SubscriptionsView({ params }: { params: Record<string, string | undefined> }) {
  const i18n = await getAdminI18n();

  const supabase = await createClient();
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  let query = supabase
    .from("subscriptions")
    .select(
      "id, profile_id, plan_id, status, starts_at, ends_at, cancelled_at, auto_renew, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (params.statut) query = query.eq("status", params.statut);

  const [{ data, error, count }, { data: plans }] = await Promise.all([
    query,
    supabase.from("subscription_plans").select("id, code, label, target_role, price_amount, price_currency"),
  ]);

  const rows = data ?? [];
  const planById = new Map((plans ?? []).map((plan) => [plan.id, plan]));
  const profiles = await fetchProfilesByIds(rows.map((row) => row.profile_id));

  const filtered = rows.filter((row) => {
    if (params.type && planById.get(row.plan_id)?.code !== params.type) return false;
    if (!params.q) return true;
    const term = params.q.toLowerCase();
    const profile = profiles.get(row.profile_id);
    return (
      profile?.full_name?.toLowerCase().includes(term) ||
      profile?.email?.toLowerCase().includes(term)
    );
  });

  return (
    <Panel>
      <PanelHeader
        title={i18n.t("Abonnements")}
        description={i18n.t("Activer ou annuler une souscription depuis ici agit sur la base, sans passer par le prestataire de paiement : a reserver aux corrections et aux activations hors ligne.")}
      />
      <FilterBar
        basePath={i18n.path("/admin/finances")}
        params={params}
        searchPlaceholder={i18n.t("Nom ou email de l'abonne…")}
        filters={[
          { name: "statut", label: i18n.t("Statut"), options: i18n.labels.options(SUBSCRIPTION_STATUS) },
          { name: "type", label: i18n.t("Offre"), options: i18n.labels.options(PLAN_CODE) },
        ]}
      />
      {error ? (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
          {i18n.t("Lecture impossible :")} {error.message}
        </p>
      ) : null}
      {!filtered.length ? (
        <EmptyState
          icon={CreditCardIcon}
          title={i18n.t("Aucun abonnement")}
          description={i18n.t("Aucune souscription ne correspond a ces criteres.")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t("Abonne")}</TableHead>
              <TableHead>{i18n.t("Offre")}</TableHead>
              <TableHead>{i18n.t("Statut")}</TableHead>
              <TableHead>{i18n.t("Debut")}</TableHead>
              <TableHead>{i18n.t("Fin")}</TableHead>
              <TableHead>{i18n.t("Renouvellement")}</TableHead>
              <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => {
              const profile = profiles.get(row.profile_id);
              const plan = planById.get(row.plan_id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={displayName(profile, undefined, i18n.locale)}
                      secondary={profile?.email}
                      avatarUrl={profile?.avatar_url}
                      href={i18n.path(`/admin/utilisateurs/${row.profile_id}?vue=finances`)}
                    />
                  </TableCell>
                  <TableCell>
                    {plan ? (
                      <div className="flex flex-col gap-0.5">
                        <span>{i18n.labels.label(PLAN_CODE, plan.code)}</span>
                        <span className="text-xs text-muted-foreground">
                          {i18n.format.formatAmount(plan.price_amount, plan.price_currency ?? "TND")}
                        </span>
                      </div>
                    ) : (
                      i18n.t("Offre inconnue")
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={i18n.labels.entry(SUBSCRIPTION_STATUS, row.status).tone}>
                      {i18n.labels.label(SUBSCRIPTION_STATUS, row.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i18n.format.formatDate(row.starts_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{i18n.format.formatDate(row.ends_at)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.auto_renew ? i18n.t("Automatique") : i18n.t("Desactive")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {row.status !== "active" ? (
                        <ActionButton action={setSubscriptionStatus.bind(null, row.id, "active")}>
                          {i18n.t("Activer")}</ActionButton>
                      ) : null}
                      {row.status !== "expiree" ? (
                        <ActionButton
                          variant="secondary"
                          action={setSubscriptionStatus.bind(null, row.id, "expiree")}
                        >
                          {i18n.t("Expirer")}</ActionButton>
                      ) : null}
                      {row.status !== "annulee" ? (
                        <ActionButton
                          variant="destructive"
                          action={setSubscriptionStatus.bind(null, row.id, "annulee")}
                        >
                          {i18n.t("Annuler")}</ActionButton>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Pagination basePath={i18n.path("/admin/finances")} params={params} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </Panel>
  );
}

/* -------------------------------------------------------------------- offres */

async function PlansView() {
  const i18n = await getAdminI18n();

  const supabase = await createClient();
  const [{ data: plans }, { data: subscriptions }] = await Promise.all([
    supabase
      .from("subscription_plans")
      .select(
        "id, code, target_role, label, price_amount, price_currency, billing_period_months, max_videos, includes_advanced_filters, includes_direct_messaging, includes_full_player_base, is_active",
      )
      .order("target_role"),
    supabase.from("subscriptions").select("plan_id, status"),
  ]);

  const activeByPlan = new Map<string, number>();
  for (const subscription of subscriptions ?? []) {
    if (subscription.status !== "active") continue;
    activeByPlan.set(subscription.plan_id, (activeByPlan.get(subscription.plan_id) ?? 0) + 1);
  }

  return (
    <Panel>
      <PanelHeader
        title={i18n.t("Catalogue d'offres")}
        description={i18n.t("Lecture seule. Les limites listees ici sont celles que l'application fait respecter cote serveur ; les modifier passe par une intervention technique, pas par le back-office.")}
      />
      {!plans?.length ? (
        <EmptyState
          icon={CreditCardIcon}
          title={i18n.t("Aucune offre")}
          description={i18n.t("Aucune offre n'est enregistree dans le catalogue.")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t("Offre")}</TableHead>
              <TableHead>{i18n.t("Public")}</TableHead>
              <TableHead>{i18n.t("Tarif")}</TableHead>
              <TableHead>{i18n.t("Periode")}</TableHead>
              <TableHead>{i18n.t("Videos max")}</TableHead>
              <TableHead>{i18n.t("Filtres avances")}</TableHead>
              <TableHead>{i18n.t("Messagerie directe")}</TableHead>
              <TableHead>{i18n.t("Base complete")}</TableHead>
              <TableHead>{i18n.t("Abonnes actifs")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{i18n.locale === "en" && plan.code in PLAN_CODE ? i18n.labels.label(PLAN_CODE, plan.code) : plan.label}</span>
                    <code className="text-[0.6875rem] text-muted-foreground">{plan.code}</code>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusPill tone={i18n.labels.entry(ROLE, plan.target_role).tone}>
                    {i18n.labels.label(ROLE, plan.target_role)}
                  </StatusPill>
                </TableCell>
                <TableCell className="tabular-nums">
                  {i18n.format.formatAmount(plan.price_amount, plan.price_currency ?? "TND")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {plan.billing_period_months ? i18n.t("{0} mois", { "0": plan.billing_period_months }) : i18n.t("Illimitee")}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {plan.max_videos ?? i18n.t("Illimite")}
                </TableCell>
                <TableCell>
                  <Yes value={plan.includes_advanced_filters} />
                </TableCell>
                <TableCell>
                  <Yes value={plan.includes_direct_messaging} />
                </TableCell>
                <TableCell>
                  <Yes value={plan.includes_full_player_base} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {i18n.format.formatNumber(activeByPlan.get(plan.id) ?? 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

async function Yes({ value }: { value: boolean }) {
  const i18n = await getAdminI18n();

  return value ? (
    <StatusPill tone="success">{i18n.t("Inclus")}</StatusPill>
  ) : (
    <StatusPill tone="neutral">{i18n.t("Non")}</StatusPill>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
