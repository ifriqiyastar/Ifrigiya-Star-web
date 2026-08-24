import type { Metadata } from "next";
import Link from "next/link";
import { CreditCardIcon, DownloadIcon, ReceiptTextIcon, WalletIcon } from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { CopyButton } from "@/components/admin/copy-button";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { Panel, PanelHeader } from "@/components/admin/panel";
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
import { formatAmount, formatDate, formatNumber } from "@/lib/format";
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  PLAN_CODE,
  ROLE,
  SUBSCRIPTION_STATUS,
  entry,
  label,
  options,
} from "@/lib/labels";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Abonnements & paiements" };

const VUES = ["paiements", "abonnements", "offres"] as const;
type Vue = (typeof VUES)[number];

export default async function FinancesPage({ searchParams }: PageProps<"/admin/finances">) {
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
        kicker="Paiements et revenus"
        title="Abonnements & paiements"
        description="Suivi des encaissements, des souscriptions et du catalogue d'offres. Les tarifs, commissions et regles de remboursement ne sont pas arretes par le cahier des charges : cet ecran suit ce qui est enregistre, il ne facture pas."
        actions={<Link href="/admin/finances/export" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}><DownloadIcon /> Exporter CSV</Link>}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Encaisse"
          value={formatAmount(collected)}
          hint="Paiements « reussi » et « active manuellement »"
          icon={WalletIcon}
          tone="brand"
        />
        <StatCard
          label="En attente"
          value={formatAmount(pendingAmount)}
          hint="A confirmer ou a activer manuellement"
          icon={ReceiptTextIcon}
        />
        <StatCard label="Rembourse" value={formatAmount(refunded)} />
        <StatCard
          label="Abonnements actifs"
          value={formatNumber(activeSubscriptions ?? 0)}
          icon={CreditCardIcon}
        />
      </section>

      <Panel>
        <PanelHeader
          title="Revenus par mois"
          description="Recalcules depuis payments.paid_at, decomposes par type de paiement."
        />
        <RevenueChart rows={revenueRows} />
      </Panel>

      <SegmentedNav
        basePath="/admin/finances"
        active={vue}
        params={params}
        segments={[
          { value: "paiements", label: "Paiements" },
          { value: "abonnements", label: "Abonnements" },
          { value: "offres", label: "Catalogue d'offres" },
        ]}
      />

      {vue === "paiements" ? <PaymentsView params={params} /> : null}
      {vue === "abonnements" ? <SubscriptionsView params={params} /> : null}
      {vue === "offres" ? <PlansView /> : null}
    </>
  );
}

/* ----------------------------------------------------------------- paiements */

async function PaymentsView({ params }: { params: Record<string, string | undefined> }) {
  const supabase = await createClient();

  let query = supabase
    .from("payments")
    .select(
      "id, profile_id, payment_type, subscription_id, scout_day_registration_id, amount, currency, method, status, provider_reference, manually_activated_at, paid_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.statut) query = query.eq("status", params.statut);
  if (params.type) query = query.eq("payment_type", params.type);
  if (params.moyen) query = query.eq("method", params.moyen);

  const { data, error } = await query;
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
        title="Paiements"
        description="« Activer manuellement » sert aux encaissements hors ligne et laisse une trace de l'administrateur qui a valide."
      />
      <FilterBar
        basePath="/admin/finances"
        params={params}
        searchPlaceholder="Reference, nom, email…"
        filters={[
          { name: "statut", label: "Statut", options: options(PAYMENT_STATUS) },
          { name: "type", label: "Objet", options: options(PAYMENT_TYPE) },
          { name: "moyen", label: "Moyen", options: options(PAYMENT_METHOD) },
        ]}
      />
      {error ? (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
          Lecture impossible : {error.message}
        </p>
      ) : null}
      {!filtered.length ? (
        <EmptyState
          icon={ReceiptTextIcon}
          title="Aucun paiement"
          description="Aucun paiement ne correspond a ces criteres."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compte</TableHead>
              <TableHead>Objet</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Moyen</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Encaisse le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => {
              const profile = profiles.get(row.profile_id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={displayName(profile)}
                      secondary={profile?.email}
                      avatarUrl={profile?.avatar_url}
                      href={`/admin/utilisateurs/${row.profile_id}?vue=finances`}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={entry(PAYMENT_TYPE, row.payment_type).tone}>
                      {label(PAYMENT_TYPE, row.payment_type)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatAmount(row.amount, row.currency ?? "TND")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {label(PAYMENT_METHOD, row.method)}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={entry(PAYMENT_STATUS, row.status).tone}>
                      {label(PAYMENT_STATUS, row.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="max-w-48 text-xs text-muted-foreground">
                    {row.provider_reference ? <span className="flex items-center gap-1"><span className="max-w-32 truncate">{row.provider_reference}</span><CopyButton value={row.provider_reference} label="Copier la reference" /></span> : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.paid_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {row.status === "en_attente" ? (
                        <>
                          <ActionButton action={activatePaymentManually.bind(null, row.id)}>
                            Activer manuellement
                          </ActionButton>
                          <ActionButton
                            variant="secondary"
                            action={setPaymentStatus.bind(null, row.id, "reussi")}
                          >
                            Marquer reussi
                          </ActionButton>
                          <ActionButton
                            variant="destructive"
                            action={setPaymentStatus.bind(null, row.id, "echoue")}
                          >
                            Echoue
                          </ActionButton>
                        </>
                      ) : null}
                      {["reussi", "active_manuellement"].includes(row.status) ? (
                        <ReasonDialog
                          action={(reason) => setPaymentStatus(row.id, "rembourse", reason)}
                          trigger={<Button variant="destructive" size="xs">Rembourser</Button>}
                          title="Marquer ce paiement rembourse"
                          description="Indiquez le motif. Le montant sortira des revenus encaisses, mais le remboursement effectif chez le prestataire doit etre confirme separement."
                          label="Motif du remboursement"
                          submitLabel="Marquer rembourse"
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
    </Panel>
  );
}

/* --------------------------------------------------------------- abonnements */

async function SubscriptionsView({ params }: { params: Record<string, string | undefined> }) {
  const supabase = await createClient();

  let query = supabase
    .from("subscriptions")
    .select(
      "id, profile_id, plan_id, status, starts_at, ends_at, cancelled_at, auto_renew, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.statut) query = query.eq("status", params.statut);

  const [{ data, error }, { data: plans }] = await Promise.all([
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
        title="Abonnements"
        description="Activer ou annuler une souscription depuis ici agit sur la base, sans passer par le prestataire de paiement : a reserver aux corrections et aux activations hors ligne."
      />
      <FilterBar
        basePath="/admin/finances"
        params={params}
        searchPlaceholder="Nom ou email de l'abonne…"
        filters={[
          { name: "statut", label: "Statut", options: options(SUBSCRIPTION_STATUS) },
          { name: "type", label: "Offre", options: options(PLAN_CODE) },
        ]}
      />
      {error ? (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
          Lecture impossible : {error.message}
        </p>
      ) : null}
      {!filtered.length ? (
        <EmptyState
          icon={CreditCardIcon}
          title="Aucun abonnement"
          description="Aucune souscription ne correspond a ces criteres."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Abonne</TableHead>
              <TableHead>Offre</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Debut</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Renouvellement</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                      name={displayName(profile)}
                      secondary={profile?.email}
                      avatarUrl={profile?.avatar_url}
                      href={`/admin/utilisateurs/${row.profile_id}?vue=finances`}
                    />
                  </TableCell>
                  <TableCell>
                    {plan ? (
                      <div className="flex flex-col gap-0.5">
                        <span>{label(PLAN_CODE, plan.code)}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatAmount(plan.price_amount, plan.price_currency ?? "TND")}
                        </span>
                      </div>
                    ) : (
                      "Offre inconnue"
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={entry(SUBSCRIPTION_STATUS, row.status).tone}>
                      {label(SUBSCRIPTION_STATUS, row.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.starts_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(row.ends_at)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.auto_renew ? "Automatique" : "Desactive"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {row.status !== "active" ? (
                        <ActionButton action={setSubscriptionStatus.bind(null, row.id, "active")}>
                          Activer
                        </ActionButton>
                      ) : null}
                      {row.status !== "expiree" ? (
                        <ActionButton
                          variant="secondary"
                          action={setSubscriptionStatus.bind(null, row.id, "expiree")}
                        >
                          Expirer
                        </ActionButton>
                      ) : null}
                      {row.status !== "annulee" ? (
                        <ActionButton
                          variant="destructive"
                          action={setSubscriptionStatus.bind(null, row.id, "annulee")}
                        >
                          Annuler
                        </ActionButton>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------- offres */

async function PlansView() {
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
        title="Catalogue d'offres"
        description="Lecture seule. Les limites listees ici sont celles que l'application et la fonction can_message() font respecter cote serveur — les modifier releve d'une migration, pas du back-office."
      />
      {!plans?.length ? (
        <EmptyState
          icon={CreditCardIcon}
          title="Aucune offre"
          description="La table subscription_plans est vide."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Offre</TableHead>
              <TableHead>Public</TableHead>
              <TableHead>Tarif</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Videos max</TableHead>
              <TableHead>Filtres avances</TableHead>
              <TableHead>Messagerie directe</TableHead>
              <TableHead>Base complete</TableHead>
              <TableHead>Abonnes actifs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{plan.label}</span>
                    <code className="text-[0.6875rem] text-muted-foreground">{plan.code}</code>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusPill tone={entry(ROLE, plan.target_role).tone}>
                    {label(ROLE, plan.target_role)}
                  </StatusPill>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatAmount(plan.price_amount, plan.price_currency ?? "TND")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {plan.billing_period_months ? `${plan.billing_period_months} mois` : "Illimitee"}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {plan.max_videos ?? "Illimite"}
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
                  {formatNumber(activeByPlan.get(plan.id) ?? 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

function Yes({ value }: { value: boolean }) {
  return value ? (
    <StatusPill tone="success">Inclus</StatusPill>
  ) : (
    <StatusPill tone="neutral">Non</StatusPill>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
