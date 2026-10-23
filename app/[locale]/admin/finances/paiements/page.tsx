import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon, HandCoinsIcon, ReceiptTextIcon } from "lucide-react";

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
import { ScoutDayPopup } from "@/components/admin/finances/scout-day-popup";
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
import {
  activatePaymentManually,
  recordScoutDayPayment,
  setPaymentStatus,
} from "@/lib/actions/finances";
import { requirePermission } from "@/lib/auth";
import { getAdminI18n } from "@/lib/i18n/admin";
import { PAYMENT_METHOD, PAYMENT_STATUS, PAYMENT_TYPE } from "@/lib/labels";
import { NO_PROFILE, displayName, fetchProfilesByIds, searchProfileIds } from "@/lib/queries/profiles";
import { orLikeTerm } from "@/lib/queries/search-term";
import {
  fetchScoutDaysByRegistration,
  fetchUnsettledScoutDayRegistrations,
} from "@/lib/queries/scout-day-payments";
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
    // Les trois cartes du panneau des revenus, chacune son mois.
    mois: str(resolved.mois),
    "mois-abonnements": str(resolved["mois-abonnements"]),
    "mois-scout-days": str(resolved["mois-scout-days"]),
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

      <FinanceMetrics basePath={path} params={params} />

      {/* Avant le releve, pas dedans : ce sont les encaissements qui RESTENT a
          saisir, et ils n'ont aucune ligne dans la table des paiements. */}
      <UnsettledScoutDayRegistrations />

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

  // ⚠️ LA RECHERCHE EST DANS LA REQUETE. Elle passait sur la page deja
  // paginee : un nom present a la 200e ligne n'etait jamais trouve, et `count`
  // l'ignorait, donc le pied du tableau annoncait un total que la liste ne
  // montrait pas. Le nom et l'e-mail vivent dans `profiles`, lu separement
  // (aucun embed imbrique vers `profiles` : deux cles etrangeres rendent
  // l'embed ambigu) — d'ou cette lecture prealable, qui ramene les comptes
  // correspondants et transforme la recherche en `profile_id in (…)`. Elle ne
  // coute un aller-retour QUE lorsqu'un terme est tape.
  const matchedProfiles = params.q ? await searchProfileIds(params.q) : null;

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
  if (matchedProfiles) {
    // La reference du prestataire reste cherchee a cote du nom : le jour ou
    // une passerelle en ecrira, une reference collee dans le champ trouvera
    // son paiement. Les deux conditions partent dans le meme `or=(...)`.
    query = query.or(
      [
        `provider_reference.ilike.${orLikeTerm(params.q!)}`,
        `profile_id.in.(${(matchedProfiles.length ? matchedProfiles : [NO_PROFILE]).join(",")})`,
      ].join(","),
    );
  }

  const { data, error, count } = await query;
  const rows = data ?? [];
  // ⚠️ EN PARALLELE, pas a la suite : les deux lectures ne dependent pas l'une
  // de l'autre, et une vague de plus se paie sur chaque affichage de l'ecran.
  const [profiles, scoutDays] = await Promise.all([
    fetchProfilesByIds(rows.map((row) => row.profile_id)),
    fetchScoutDaysByRegistration(rows.map((row) => row.scout_day_registration_id)),
  ]);

  return (
    <Panel>
      <PanelHeader
        title={i18n.t("Paiements")}
        description={i18n.t("« Activer manuellement » sert aux encaissements hors ligne et laisse une trace de l'administrateur qui a valide.")}
      />
      <FilterBar
        basePath={path}
        params={params}
        // La reference n'est plus annoncee puisque la colonne ne l'est plus
        // — mais la recherche continue de la faire correspondre plus bas : le
        // jour ou une passerelle en ecrira, une reference collee ici trouvera
        // toujours son paiement.
        searchPlaceholder={i18n.t("Nom, email…")}
        filters={[
          { name: "statut", label: i18n.t("Statut"), options: i18n.labels.options(PAYMENT_STATUS) },
          { name: "type", label: i18n.t("Objet"), options: i18n.labels.options(PAYMENT_TYPE) },
          { name: "moyen", label: i18n.t("Moyen"), options: i18n.labels.options(PAYMENT_METHOD) },
        ]}
      />
      {error ? <FinanceError message={error.message} /> : null}
      {!rows.length ? (
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
              {/* Centree comme « Statut » et « Scout Day » (retour client) :
                  une pastille est une etiquette, pas un texte qu'on lit de
                  gauche a droite — elle se pose au milieu de sa colonne. */}
              <TableHead className="text-center">{i18n.t("Objet")}</TableHead>
              <TableHead>{i18n.t("Montant")}</TableHead>
              {/* ⚠️ L'EVENEMENT PREND LA PLACE DU MOYEN DE PAIEMENT (retour
                  client). Les deux raisons tiennent :

                   * le moyen etait **deja dit par le statut** — « active
                     manuellement » EST l'encaissement hors ligne, et c'est la
                     distinction qui compte dans ce produit ;
                   * l'evenement, lui, n'avait pas de colonne : il vivait en
                     seconde ligne de la colonne « Objet », ou rien n'annoncait
                     qu'on pouvait le lire.

                  Le moyen reste filtrable (la passerelle distingue carte et
                  mobile money, ce que le statut ne dit pas) et reste lisible
                  sur la fiche du compte et dans l'export. */}
              <TableHead className="text-center">{i18n.t("Scout Day")}</TableHead>
              {/* ⚠️ CENTREE, EN-TETE COMPRIS (retour client). « Active
                  manuellement » est la plus longue pastille du referentiel : a
                  gauche, elle depassait largement un en-tete de six lettres et
                  la colonne ne se lisait plus comme un bloc. Centrer la seule
                  valeur n'aurait rien regle — c'est la paire en-tete/valeur qui
                  doit s'aligner, la meme regle que pour le nom de l'evenement. */}
              <TableHead className="text-center">{i18n.t("Statut")}</TableHead>
              {/* La reference du prestataire est retiree : aucun paiement n'en
                  porte tant qu'aucune passerelle n'est branchee, et une colonne
                  de tirets occupe la largeur dont l'evenement avait besoin.
                  Rien n'est perdu — elle reste sur la fiche du compte, sur
                  celle de l'evenement, dans l'export CSV, et c'est toujours
                  elle que le webhook apparie. */}
              <TableHead className="max-lg:hidden">{i18n.t("Encaisse le")}</TableHead>
              <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const profile = profiles.get(row.profile_id);
              const scoutDay = row.scout_day_registration_id
                ? scoutDays.get(row.scout_day_registration_id)
                : undefined;
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
                  {/* ⚠️ « Scout Day » tout court ne disait pas LEQUEL : un
                      administrateur voyait un encaissement sans pouvoir le
                      rattacher a son evenement. Le nom est devenu un bouton
                      qui ouvre la fiche courte de l'evenement (date, lieu,
                      tarif) et mene a sa page. Rien n'est duplique — on rend
                      identifiable ce qui ne l'etait pas.

                      ⚠️ La cellule n'est plus masquee sous `lg` : elle ne
                      porte plus seulement du contexte, elle QUALIFIE la ligne,
                      et c'est precisement sur telephone qu'un encaissement
                      anonyme pose probleme. */}
                  {/* « Objet » ne porte plus que le TYPE : l'evenement a sa
                      propre colonne, ou il est la valeur et non une seconde
                      ligne. Les deux etaient empiles ici — la pastille flottait
                      au-dessus du bouton, la rangee faisait deux etages la ou
                      les autres en font un, et sa hauteur variait selon qu'un
                      paiement portait un evenement ou non. */}
                  <TableCell className="text-center">
                    <StatusPill tone={i18n.labels.entry(PAYMENT_TYPE, row.payment_type).tone}>
                      {i18n.labels.label(PAYMENT_TYPE, row.payment_type)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {i18n.format.formatAmount(row.amount, row.currency ?? "TND")}
                  </TableCell>
                  <TableCell className="text-center">
                    {scoutDay ? (
                      <ScoutDayPopup event={scoutDay} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {/* `text-center` suffit : `StatusPill` est un `inline-flex`,
                      donc une boite de niveau ligne que l'alignement du texte
                      centre. Pas de `justify-center` a poser, et rien a changer
                      en rangee compacte sous `md`, ou la cellule perd ses
                      marges et se range dans le flux de la ligne. */}
                  <TableCell className="text-center">
                    <StatusPill tone={i18n.labels.entry(PAYMENT_STATUS, row.status).tone}>
                      {i18n.labels.label(PAYMENT_STATUS, row.status)}
                    </StatusPill>
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

/** Combien d'inscriptions a encaisser le panneau montre au plus. */
const UNSETTLED_LIMIT = 15;

/**
 * « Inscriptions a encaisser » — la moitie manquante de cet ecran.
 *
 * ⚠️ Le tableau ci-dessus liste la table des PAIEMENTS. Une inscription a un
 * evenement payant dont personne n'a saisi l'encaissement n'y a aucune ligne,
 * donc aucun bouton : l'ecran paraissait a jour alors qu'il restait de
 * l'argent a encaisser. Ce panneau montre ces inscriptions-la, et porte le
 * geste qui leur manquait.
 *
 * ⚠️ Le bouton appelle la meme fonction que l'application mobile de
 * l'organisateur (`record_scout_day_payment`) : le montant vient du TARIF de
 * l'evenement, jamais d'une saisie, et le statut pose est
 * `active_manuellement` — celui qui distingue les especes d'un encaissement
 * prestataire.
 */
async function UnsettledScoutDayRegistrations() {
  const i18n = await getAdminI18n();
  const { rows, truncated } = await fetchUnsettledScoutDayRegistrations(UNSETTLED_LIMIT);
  if (!rows.length) return null;

  // ⚠️ UNE SEULE DEMANDE d'identites pour les joueurs ET les organisateurs :
  // les deux sont connus des que les lignes le sont, donc les separer ne
  // paierait qu'un aller-retour de plus.
  const profiles = await fetchProfilesByIds([
    ...rows.map((row) => row.playerId),
    ...rows.map((row) => row.scoutDay.organizerId ?? ""),
  ]);

  // ⚠️ LE TOTAL NE MELANGE PAS LES DEVISES. Chaque evenement porte la sienne ;
  // additionner des dinars et des euros afficherait un nombre qui n'existe
  // pas. Une pastille par devise, et le libelle dit « sur cette liste » —
  // quand la liste est tronquee, le total ne vaut que pour ce qui est montre.
  const totals = new Map<string, number>();
  for (const row of rows) {
    const currency = row.scoutDay.priceCurrency ?? "TND";
    totals.set(currency, (totals.get(currency) ?? 0) + Number(row.scoutDay.priceAmount ?? 0));
  }

  return (
    // `highlighted` : ce panneau n'est pas un releve, c'est une liste de choses
    // a faire. Sans ce liseré il se lisait comme un second tableau de
    // paiements, et c'est ce qui le faisait passer inapercu au-dessus du vrai.
    <Panel highlighted>
      <PanelHeader
        icon={HandCoinsIcon}
        title={i18n.t("Inscriptions a encaisser")}
        description={
          truncated
            ? i18n.t("Evenements payants dont le reglement n'est pas saisi. Les {0} plus recentes ; la fiche de l'evenement porte la liste complete.", {
                "0": i18n.format.formatNumber(UNSETTLED_LIMIT),
              })
            : i18n.t("Evenements payants dont le reglement n'est pas saisi.")
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="micro-label">{i18n.t("A encaisser sur cette liste")}</span>
            {[...totals].map(([currency, total]) => (
              <StatusPill key={currency} tone="brand">
                {i18n.format.formatAmount(total, currency)}
              </StatusPill>
            ))}
          </div>
        }
      />
      <Table className={STACKED_ON_MOBILE}>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t("Compte")}</TableHead>
            {/* Centree comme la colonne « Scout Day » du releve : c'est le
                meme bouton, montrant le meme evenement, et les deux panneaux se
                suivent sur le meme ecran — l'un aligne a gauche et l'autre
                centre se lirait comme un defaut d'affichage. */}
            <TableHead className="text-center">{i18n.t("Evenement")}</TableHead>
            <TableHead>{i18n.t("Montant")}</TableHead>
            <TableHead className="max-lg:hidden">{i18n.t("Inscrit le")}</TableHead>
            <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const profile = profiles.get(row.playerId);
            // Le geste, pose deux fois volontairement : dans la ligne, pour
            // enchainer une file d'encaissements, et dans le popup, la ou
            // l'administrateur vient justement de verifier de quel evenement
            // il s'agit. C'est la meme action liee a la meme inscription.
            const record = (
              <ActionButton action={recordScoutDayPayment.bind(null, row.registrationId)}>
                {i18n.t("Marquer comme paye")}</ActionButton>
            );
            return (
              <TableRow key={row.registrationId}>
                <TableCell>
                  <UserCell
                    name={displayName(profile, undefined, i18n.locale)}
                    secondary={profile?.email}
                    avatarUrl={profile?.avatar_url}
                    preview={profile}
                    href={i18n.path(`/admin/utilisateurs/${row.playerId}?vue=finances`)}
                  />
                </TableCell>
                {/* ⚠️ PLUS DE `max-lg:hidden` ICI. L'evenement etait masque
                    sous `lg`, c'est-a-dire sur le telephone ou cet ecran est
                    reellement consulte : restaient un nom, un montant et un
                    bouton « Marquer comme paye » sans dire de quoi. */}
                <TableCell className="text-center">
                  <ScoutDayPopup
                    event={row.scoutDay}
                    organizer={
                      row.scoutDay.organizerId
                        ? profiles.get(row.scoutDay.organizerId)
                        : undefined
                    }
                    registration={{ status: row.status, registeredAt: row.registeredAt }}
                    action={record}
                  />
                </TableCell>
                <TableCell className="font-medium tabular-nums">
                  {i18n.format.formatAmount(
                    row.scoutDay.priceAmount ?? 0,
                    row.scoutDay.priceCurrency ?? "TND",
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground max-lg:hidden">
                  {i18n.format.formatDate(row.registeredAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end">{record}</div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
