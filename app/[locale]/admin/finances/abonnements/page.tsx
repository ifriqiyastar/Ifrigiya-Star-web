import type { Metadata } from "next";
import { CreditCardIcon } from "lucide-react";

import { AccountHistoryDialog } from "@/components/admin/finances/account-history";
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
import { emptyHistory, fetchAccountHistories } from "@/lib/queries/finance-history";
import {
  SUBSCRIPTION_SWEEP_LIMIT,
  fetchSubscriptionAccounts,
} from "@/lib/queries/subscription-accounts";
import { displayName, fetchProfilesByIds, searchProfileIds } from "@/lib/queries/profiles";
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

  // ⚠️ UNE LIGNE PAR COMPTE, ET LE REGROUPEMENT EST DANS LA LECTURE (demande
  // client). La liste montrait une ligne par souscription, donc un compte qui
  // renouvelle autant de fois qu'il avait souscrit. Regrouper apres pagination
  // aurait fausse le `count`, rendu les pages inegales et laisse un compte
  // reapparaitre a cheval sur deux pages — voir `fetchSubscriptionAccounts`.
  const [accounts, { data: plans }] = await Promise.all([
    fetchSubscriptionAccounts({
      page,
      pageSize: FINANCE_PAGE_SIZE,
      status: params.statut,
      planIds,
      profileIds: matchedProfiles,
    }),
    supabase
      .from("subscription_plans")
      .select("id, code, label, target_role, price_amount, price_currency"),
  ]);

  const { rows, total, error } = accounts;
  const planById = new Map((plans ?? []).map((plan) => [plan.id, plan]));

  // ⚠️ LA MEME VAGUE QUE LES IDENTITES, pas une de plus. L'historique ne depend
  // que des `profile_id` de la page — comme `fetchProfilesByIds()` — donc les
  // deux partent ensemble et la modale de chaque ligne ne coute aucun
  // aller-retour supplementaire. Une lecture par ligne en aurait ajoute seize.
  const profileIds = rows.map((row) => row.profile_id);
  const [profiles, histories] = await Promise.all([
    fetchProfilesByIds(profileIds),
    fetchAccountHistories(profileIds),
  ]);

  return (
    <Panel>
      {/* L'en-tete de page porte deja la mise en garde sur l'effet des gestes ;
          la repeter mot pour mot ici la faisait figurer deux fois sur le meme
          ecran. Ce panneau dit a la place ce que la liste montre — un compte,
          une ligne —, sans quoi un pied annoncant cinq entrees pour six
          souscriptions se lit comme un decompte faux. */}
      <PanelHeader
        title={i18n.t("Abonnements")}
        description={i18n.t("Un compte par ligne, avec sa souscription la plus recente. Le nombre de souscriptions ouvre l'historique complet du compte.")}
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
              {/* ⚠️ QUATRE COLONNES RAMENEES A UNE. « Souscrit le », « Debut »,
                  « Fin » et « Renouvellement » occupaient la moitie de la
                  largeur pour trois dates et un oui/non — de la bouillie de
                  dates dont aucune ne se lisait. « Souscrit le » n'avait
                  d'ailleurs de raison d'etre que tant qu'un compte occupait
                  plusieurs lignes qu'il fallait distinguer ; la liste etant
                  groupee par compte, cette question ne se pose plus ici et sa
                  reponse est dans l'historique. Reste la periode, qui est ce
                  qu'on vient lire : du debut a la fin, le renouvellement en
                  sous-ligne. */}
              <TableHead className="max-lg:hidden">{i18n.t("Periode")}</TableHead>
              <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const profile = profiles.get(row.profile_id);
              const plan = planById.get(row.plan_id);
              const history = histories.byProfile.get(row.profile_id) ?? emptyHistory();
              const historyCount = history.subscriptions.length;
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
                    <div className="flex flex-col gap-0.5">
                      <span>
                        {plan
                          ? i18n.labels.label(PLAN_CODE, plan.code)
                          : i18n.t("Offre inconnue")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {plan
                          ? i18n.format.formatAmount(
                              plan.price_amount,
                              plan.price_currency ?? "TND",
                            )
                          : null}
                        {/* ⚠️ UN FAIT, PAS UNE COMMANDE. Le nombre de
                            souscriptions etait porte par un bouton borde pose
                            sous le prix : trois lignes dans la cellule, et une
                            quatrieme boite cliquable qui entrait en concurrence
                            avec les gestes de fin de ligne. Il redevient ce
                            qu'il est — une qualification de la ligne, en texte
                            attenue — et l'affordance part la ou le depot pose
                            deja tous ses « voir le detail » : dans la colonne
                            des actions. */}
                        {historyCount > 1 ? (
                          <>
                            {plan ? " · " : null}
                            {i18n.t("{total} souscriptions", { total: historyCount })}
                          </>
                        ) : null}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusPill tone={i18n.labels.entry(SUBSCRIPTION_STATUS, row.status).tone}>
                      {i18n.labels.label(SUBSCRIPTION_STATUS, row.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="max-lg:hidden">
                    <div className="flex flex-col gap-0.5">
                      {/* La fleche porte le sens, pas un intitule : « du … au … »
                          doublerait la largeur pour la meme information. Une
                          echeance absente s'ecrit « — » et non une date vide,
                          un abonnement sans terme etant un fait courant ici. */}
                      <span className="whitespace-nowrap tabular-nums text-foreground">
                        {i18n.format.formatDate(row.starts_at)}
                        <span className="px-1.5 text-muted-foreground">→</span>
                        {row.ends_at ? i18n.format.formatDate(row.ends_at) : "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.auto_renew
                          ? i18n.t("Renouvellement automatique")
                          : i18n.t("Sans renouvellement")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {/* En tete des gestes, comme « Dossier » dans les files de
                          validation : la forme d'une ligne devient alors la meme
                          partout — identite, qualifications, puis « voir », puis
                          decider. */}
                      <AccountHistoryDialog
                        history={history}
                        plans={planById}
                        currentSubscriptionId={row.id}
                        profile={profile}
                        accountName={displayName(profile, undefined, i18n.locale)}
                        accountHref={i18n.path(
                          `/admin/utilisateurs/${row.profile_id}?vue=finances`,
                        )}
                        truncated={histories.truncated}
                        error={histories.error}
                      />
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
      {/* Le plafond du balayage, annonce des qu'il mord : au-dela, les comptes
          dont toutes les souscriptions sont plus anciennes manquent a la liste,
          et un registre ampute presente comme complet est le defaut que
          `lib/csv.ts` corrige du cote des exports. */}
      {accounts.truncated ? (
        <p className="px-4 pb-2 text-xs text-muted-foreground sm:px-6">
          {i18n.t("Lecture limitee aux {limit} souscriptions les plus recentes : des comptes plus anciens peuvent manquer a cette liste.", { limit: i18n.format.formatNumber(SUBSCRIPTION_SWEEP_LIMIT) })}
        </p>
      ) : null}
      <Pagination
        basePath={path}
        params={params}
        page={page}
        pageSize={FINANCE_PAGE_SIZE}
        total={total}
      />
    </Panel>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
