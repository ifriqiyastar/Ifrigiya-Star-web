import type { Metadata } from "next";
import { CreditCardIcon } from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import {
  FINANCE_PAGE_SIZE,
  FinanceError,
  FinanceMetrics,
  FinanceNotes,
  financeCrumb,
  financePath,
} from "@/components/admin/finances/pieces";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { STACKED_ON_MOBILE } from "@/components/admin/table-stack";
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
import { setSubscriptionStatus } from "@/lib/actions/finances";
import { requirePermission } from "@/lib/auth";
import { getAdminI18n } from "@/lib/i18n/admin";
import { PLAN_CODE, SUBSCRIPTION_STATUS } from "@/lib/labels";
import { NO_PROFILE, displayName, fetchProfilesByIds, searchProfileIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Abonnements") };
}

export default async function AbonnementsPage({
  searchParams,
}: PageProps<"/[locale]/admin/finances/abonnements">) {
  const i18n = await getAdminI18n();
  await requirePermission("finance.manage");

  const resolved = await searchParams;
  const params = {
    q: str(resolved.q),
    statut: str(resolved.statut),
    type: str(resolved.type),
    page: str(resolved.page),
    // Les trois cartes du panneau des revenus, chacune son mois.
    mois: str(resolved.mois),
    "mois-abonnements": str(resolved["mois-abonnements"]),
    "mois-scout-days": str(resolved["mois-scout-days"]),
  };
  const path = i18n.path(financePath("abonnements"));

  return (
    <>
      <PageHeader
        breadcrumb={[await financeCrumb(), { label: i18n.t("Abonnements") }]}
        title={i18n.t("Abonnements")}
        description={i18n.t("Activer ou annuler une souscription depuis ici agit sur la base, sans passer par le prestataire de paiement : a reserver aux corrections et aux activations hors ligne.")}
      />

      <FinanceMetrics basePath={path} params={params} />

      <SubscriptionsQueue params={params} path={path} />

      <FinanceNotes />
    </>
  );
}

async function SubscriptionsQueue({
  params,
  path,
}: {
  params: Record<string, string | undefined>;
  path: string;
}) {
  const i18n = await getAdminI18n();

  const supabase = await createClient();
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  // ⚠️ LES DEUX FILTRES SONT DANS LA REQUETE. Ils passaient sur la page deja
  // paginee — l'offre comme le nom —, donc `count` les ignorait et le pied du
  // tableau annoncait un total que la liste ne montrait pas. Ni l'un ni
  // l'autre ne vit dans `subscriptions` : l'offre est designee par son code
  // dans `subscription_plans`, le nom et l'e-mail par `profiles` (lu
  // separement, aucun embed imbrique vers `profiles` n'etant possible). Les
  // deux se resolvent donc en identifiants d'abord, ENSEMBLE, et seulement
  // quand le filtre correspondant est demande.
  const [planIds, matchedProfiles] = await Promise.all([
    params.type
      ? supabase
          .from("subscription_plans")
          .select("id")
          .eq("code", params.type)
          .then(({ data }) => (data ?? []).map((plan) => plan.id as string))
      : Promise.resolve(null),
    params.q ? searchProfileIds(params.q) : Promise.resolve(null),
  ]);

  let query = supabase
    .from("subscriptions")
    .select(
      "id, profile_id, plan_id, status, starts_at, ends_at, cancelled_at, auto_renew, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * FINANCE_PAGE_SIZE, page * FINANCE_PAGE_SIZE - 1);

  if (params.statut) query = query.eq("status", params.statut);
  // Une liste vide passe par l'identifiant impossible : PostgREST refuse un
  // `in ()` vide, et laisser tomber le filtre afficherait tout l'inverse de ce
  // qui est demande.
  if (planIds) query = query.in("plan_id", planIds.length ? planIds : [NO_PROFILE]);
  if (matchedProfiles) {
    query = query.in("profile_id", matchedProfiles.length ? matchedProfiles : [NO_PROFILE]);
  }

  const [{ data, error, count }, { data: plans }] = await Promise.all([
    query,
    supabase
      .from("subscription_plans")
      .select("id, code, label, target_role, price_amount, price_currency"),
  ]);

  const rows = data ?? [];
  const planById = new Map((plans ?? []).map((plan) => [plan.id, plan]));
  const profiles = await fetchProfilesByIds(rows.map((row) => row.profile_id));

  return (
    <Panel>
      <PanelHeader
        title={i18n.t("Abonnements")}
        description={i18n.t("Activer ou annuler une souscription depuis ici agit sur la base, sans passer par le prestataire de paiement : a reserver aux corrections et aux activations hors ligne.")}
      />
      <FilterBar
        basePath={path}
        params={params}
        searchPlaceholder={i18n.t("Nom ou email de l'abonne…")}
        filters={[
          {
            name: "statut",
            label: i18n.t("Statut"),
            options: i18n.labels.options(SUBSCRIPTION_STATUS),
          },
          { name: "type", label: i18n.t("Offre"), options: i18n.labels.options(PLAN_CODE) },
        ]}
      />
      {error ? <FinanceError message={error.message} /> : null}
      {!rows.length ? (
        <EmptyState
          icon={CreditCardIcon}
          title={i18n.t("Aucun abonnement")}
          description={i18n.t("Aucune souscription ne correspond a ces criteres.")}
        />
      ) : (
        <Table className={STACKED_ON_MOBILE}>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t("Abonne")}</TableHead>
              <TableHead>{i18n.t("Offre")}</TableHead>
              {/* Centree comme celle des paiements : les deux ecrans sont
                  deux onglets du meme ensemble, et une colonne « Statut »
                  alignee differemment de l'un a l'autre se lit comme un
                  defaut d'affichage au moment de basculer. */}
              <TableHead className="text-center">{i18n.t("Statut")}</TableHead>
              <TableHead className="max-lg:hidden">{i18n.t("Debut")}</TableHead>
              <TableHead className="max-lg:hidden">{i18n.t("Fin")}</TableHead>
              <TableHead className="max-lg:hidden">{i18n.t("Renouvellement")}</TableHead>
              <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const profile = profiles.get(row.profile_id);
              const plan = planById.get(row.plan_id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={displayName(profile, undefined, i18n.locale)}
                      secondary={profile?.email}
                      avatarUrl={profile?.avatar_url}
                      preview={profile}
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
                  <TableCell className="text-center">
                    <StatusPill tone={i18n.labels.entry(SUBSCRIPTION_STATUS, row.status).tone}>
                      {i18n.labels.label(SUBSCRIPTION_STATUS, row.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-lg:hidden">
                    {i18n.format.formatDate(row.starts_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-lg:hidden">
                    {i18n.format.formatDate(row.ends_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-lg:hidden">
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
      <Pagination
        basePath={path}
        params={params}
        page={page}
        pageSize={FINANCE_PAGE_SIZE}
        total={count ?? 0}
      />
    </Panel>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
