import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon, ReceiptTextIcon } from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { CopyButton } from "@/components/admin/copy-button";
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
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { STACKED_ON_MOBILE } from "@/components/admin/table-stack";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { activatePaymentManually, setPaymentStatus } from "@/lib/actions/finances";
import { requirePermission } from "@/lib/auth";
import { getAdminI18n } from "@/lib/i18n/admin";
import { PAYMENT_METHOD, PAYMENT_STATUS, PAYMENT_TYPE } from "@/lib/labels";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Paiements") };
}

export default async function PaiementsPage({
  searchParams,
}: PageProps<"/[locale]/admin/finances/paiements">) {
  const i18n = await getAdminI18n();
  await requirePermission("finance.manage");

  const resolved = await searchParams;
  const params = {
    q: str(resolved.q),
    statut: str(resolved.statut),
    type: str(resolved.type),
    moyen: str(resolved.moyen),
    page: str(resolved.page),
  };
  const path = i18n.path(financePath("paiements"));

  return (
    <>
      <PageHeader
        breadcrumb={[await financeCrumb(), { label: i18n.t("Paiements") }]}
        title={i18n.t("Paiements")}
        description={i18n.t("Suivi des encaissements, des souscriptions et du catalogue d'offres. Les tarifs, commissions et regles de remboursement ne sont pas arretes par le cahier des charges : cet ecran suit ce qui est enregistre, il ne facture pas.")}
        actions={
          // L'export porte sur les paiements : il reste sur l'ecran des
          // paiements plutot que sur les trois.
          <Link
            href={i18n.path("/admin/finances/export")}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <DownloadIcon />
            {i18n.t("Exporter CSV")}</Link>
        }
      />

      <FinanceMetrics />

      <PaymentsQueue params={params} path={path} />

      <FinanceNotes />
    </>
  );
}

async function PaymentsQueue({
  params,
  path,
}: {
  params: Record<string, string | undefined>;
  path: string;
}) {
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
    .range((page - 1) * FINANCE_PAGE_SIZE, page * FINANCE_PAGE_SIZE - 1);

  if (params.statut) query = query.eq("status", params.statut);
  if (params.type) query = query.eq("payment_type", params.type);
  if (params.moyen) query = query.eq("method", params.moyen);

  const { data, error, count } = await query;
  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(rows.map((row) => row.profile_id));

  // ⚠️ DETTE REPRISE TELLE QUELLE, ET CONNUE : ce filtre passe sur la page
  // **deja paginee**, ce que le reste du back-office s'interdit — un terme
  // present a la 200e ligne n'est jamais trouve, et `count` l'ignore, donc le
  // pied de tableau annonce un total que la liste ne montre pas. Il est ici
  // parce que la recherche porte sur le nom et l'e-mail, qui vivent dans
  // `profiles`, lu separement (aucun embed imbrique vers `profiles`). Le
  // corriger demande de chercher d'abord les comptes correspondants puis de
  // filtrer les paiements sur `profile_id in (…)` **dans la requete** — un
  // changement de requete, pas de mise en page, donc hors du decoupage.
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
        basePath={path}
        params={params}
        searchPlaceholder={i18n.t("Reference, nom, email…")}
        filters={[
          { name: "statut", label: i18n.t("Statut"), options: i18n.labels.options(PAYMENT_STATUS) },
          { name: "type", label: i18n.t("Objet"), options: i18n.labels.options(PAYMENT_TYPE) },
          { name: "moyen", label: i18n.t("Moyen"), options: i18n.labels.options(PAYMENT_METHOD) },
        ]}
      />
      {error ? <FinanceError message={error.message} /> : null}
      {!filtered.length ? (
        <EmptyState
          icon={ReceiptTextIcon}
          title={i18n.t("Aucun paiement")}
          description={i18n.t("Aucun paiement ne correspond a ces criteres.")}
        />
      ) : (
        <Table className={STACKED_ON_MOBILE}>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t("Compte")}</TableHead>
              <TableHead className="max-lg:hidden">{i18n.t("Objet")}</TableHead>
              <TableHead>{i18n.t("Montant")}</TableHead>
              <TableHead className="max-lg:hidden">{i18n.t("Moyen")}</TableHead>
              <TableHead>{i18n.t("Statut")}</TableHead>
              <TableHead className="max-lg:hidden">{i18n.t("Reference")}</TableHead>
              <TableHead className="max-lg:hidden">{i18n.t("Encaisse le")}</TableHead>
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
                  <TableCell className="max-lg:hidden">
                    <StatusPill tone={i18n.labels.entry(PAYMENT_TYPE, row.payment_type).tone}>
                      {i18n.labels.label(PAYMENT_TYPE, row.payment_type)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {i18n.format.formatAmount(row.amount, row.currency ?? "TND")}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-lg:hidden">
                    {i18n.labels.label(PAYMENT_METHOD, row.method)}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={i18n.labels.entry(PAYMENT_STATUS, row.status).tone}>
                      {i18n.labels.label(PAYMENT_STATUS, row.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="max-w-48 text-xs text-muted-foreground max-lg:hidden">
                    {row.provider_reference ? (
                      <span className="flex items-center gap-1">
                        <span className="max-w-32 truncate">{row.provider_reference}</span>
                        <CopyButton
                          value={row.provider_reference}
                          label={i18n.t("Copier la reference")}
                        />
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-lg:hidden">
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
                          trigger={
                            <Button variant="destructive" size="xs">
                              {i18n.t("Rembourser")}</Button>
                          }
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
