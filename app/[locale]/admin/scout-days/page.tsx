import { getAdminI18n } from "@/lib/i18n/admin";
import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  ListChecksIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterBar } from "@/components/admin/filter-bar";
import { NoteCards } from "@/components/admin/note-cards";
import { HeaderMeta, PageHeader } from "@/components/admin/page-header";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { Pagination } from "@/components/admin/pagination";
import { StatCard } from "@/components/admin/stat-card";
import { StatusPill } from "@/components/admin/status-pill";
import { ScoutDayCalendar, type CalendarEvent } from "@/components/admin/scout-day-calendar";
import { ScoutDayDialog } from "@/components/admin/scout-day-dialog";
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
  deleteScoutDay,
  refuseScoutDay,
  setScoutDayStatus,
  validateScoutDay,
} from "@/lib/actions/scout-days";

import { SCOUT_DAY_STATUS } from "@/lib/labels";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { fetchCountries } from "@/lib/countries-api";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess, requirePermission } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Scout Days") };
}

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
const PAGE_SIZE = 20;

export default async function ScoutDaysPage({ searchParams }: PageProps<"/[locale]/admin/scout-days">) {
  const i18n = await getAdminI18n();

  const admin = await requirePermission("events.manage");
  // Valider est reserve au super administrateur (migration 0040). On cache le
  // geste plutot que de laisser un « Responsable evenements » decouvrir la
  // regle par un refus Postgres.
  const { permissions } = await getAdminAccess(admin.userId);
  const canValidate = permissions.includes("events.validate");
  const resolved = await searchParams;
  const params = {
    q: str(resolved.q),
    statut: str(resolved.statut),
    paye: str(resolved.paye),
    mois: str(resolved.mois),
    page: str(resolved.page),
  };
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  // Mois affiche par le calendrier. On reste en chaines `YYYY-MM` / `YYYY-MM-DD` :
  // `event_date` est un `date` Postgres sans fuseau, et le convertir en `Date`
  // local decalerait les evenements d'un jour selon le decalage du serveur.
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = /^\d{4}-\d{2}$/.test(params.mois ?? "") ? params.mois! : today.slice(0, 7);
  const [calYear, calMonth] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(new Date(Date.UTC(calYear, calMonth, 0)).getUTCDate()).padStart(2, "0")}`;

  const supabase = await createClient();

  let query = supabase
    .from("scout_days")
    .select(
      // Volontairement sans les colonnes de la migration 0040 : le tableau ne
      // les affiche pas, et les demander ferait echouer toute la liste en
      // 42703 tant que 0040 n'est pas appliquee. La file d'attente ci-dessous
      // les lit dans sa propre requete, qui elle peut retourner vide sans
      // consequence.
      "id, organizer_id, title, description, event_date, start_time, location, capacity, is_paid, price_amount, price_currency, status, eligibility_criteria, created_at",
      { count: "exact" },
    )
    .order("event_date", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (params.statut) query = query.eq("status", params.statut);
  if (params.paye === "oui") query = query.eq("is_paid", true);
  if (params.paye === "non") query = query.eq("is_paid", false);

  // File d'attente de validation : independante des filtres de la liste, comme
  // le calendrier. Le plus ancien soumis en tete — c'est celui qui attend
  // depuis le plus longtemps.
  const { data: pendingRows } = await supabase
    .from("scout_days")
    .select(
      "id, organizer_id, title, event_date, start_time, location, capacity, is_paid, price_amount, price_currency, submitted_at",
    )
    .eq("status", "en_attente_validation")
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .limit(50);
  const pending = pendingRows ?? [];

  // Le calendrier montre *tous* les evenements du mois, filtres de la liste
  // exclus : c'est une vue d'ensemble, pas un reflet du tableau.
  const { data: calendarRows } = await supabase
    .from("scout_days")
    .select("id, title, event_date, start_time, location, status")
    .gte("event_date", monthStart)
    .lte("event_date", monthEnd)
    .order("event_date");

  // Organisateurs proposes a la creation : seuls les comptes professionnels
  // valides peuvent porter un evenement (cle etrangere vers
  // professional_profiles).
  const { data: organizers } = await supabase
    .from("professional_profiles")
    .select("id, contact_full_name, organization_name")
    .eq("status", "valide")
    .order("contact_full_name")
    .limit(1000);

  // Referentiel pays charge cote serveur : meme service que l'app mobile, et
  // pas de dependance au CORS d'un tiers depuis le navigateur.
  const countries = await fetchCountries();

  const { data, error, count } = await query;
  const rows = (data ?? []).filter((row) =>
    params.q
      ? `${row.title} ${row.location ?? ""}`.toLowerCase().includes(params.q.toLowerCase())
      : true,
  );

  const profiles = await fetchProfilesByIds([
    ...rows.map((row) => row.organizer_id),
    ...pending.map((row) => row.organizer_id),
  ]);

  // Nombre d'inscrits par evenement : une seule requete, comptee en memoire.
  // PostgREST sait faire un count agrege, mais pas sans jointure imbriquee.
  const { data: registrations } = await supabase
    .from("scout_day_registrations")
    .select("id, scout_day_id, status")
    .in("scout_day_id", rows.length ? rows.map((row) => row.id) : [EMPTY_UUID]);

  const countByEvent = new Map<string, { total: number; confirmed: number }>();
  for (const registration of registrations ?? []) {
    const current = countByEvent.get(registration.scout_day_id) ?? { total: 0, confirmed: 0 };
    current.total += 1;
    if (["confirme", "present"].includes(registration.status)) current.confirmed += 1;
    countByEvent.set(registration.scout_day_id, current);
  }

  const published = rows.filter((row) => row.status === "publie").length;
  const drafts = rows.filter((row) => row.status === "brouillon").length;
  const totalRegistrations = (registrations ?? []).length;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: i18n.t("Scout Days") }, { label: i18n.t("Evenements de detection") }]}
        title={i18n.t("Evenements de detection & tournois")}
        meta={
          pending.length ? (
            <HeaderMeta tone="brand">{pending.length}  {i18n.t("a valider")}</HeaderMeta>
          ) : (
            <HeaderMeta>{i18n.t("Aucun en attente")}</HeaderMeta>
          )
        }
        description={i18n.t("Tous les Scout Days, quel que soit leur organisateur. L'administration peut publier, remettre en brouillon, annuler ou cloturer un evenement, et suivre inscriptions et paiements.")}
        actions={<ScoutDayDialog organizers={organizers ?? []} countries={countries} />}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={i18n.t("Evenements")}
          value={i18n.format.formatNumber(rows.length)}
          icon={CalendarDaysIcon}
        />
        <StatCard
          label={i18n.t("A valider")}
          value={i18n.format.formatNumber(pending.length)}
          icon={ClockIcon}
          accent="secondary"
        />
        <StatCard
          label={i18n.t("Publies")}
          value={i18n.format.formatNumber(published)}
          icon={CheckIcon}
          href={i18n.path("/admin/scout-days?statut=publie")}
        />
        <StatCard
          label={i18n.t("Brouillons")}
          value={i18n.format.formatNumber(drafts)}
          icon={ClockIcon}
          href={i18n.path("/admin/scout-days?statut=brouillon")}
        />
        <StatCard
          label={i18n.t("Inscriptions")}
          value={i18n.format.formatNumber(totalRegistrations)}
          icon={UsersIcon}
          accent="secondary"
        />
      </section>

      {pending.length ? (
        <Panel highlighted>
          <PanelHeader
            icon={ShieldCheckIcon}
            title={i18n.t("Scout Days a valider ({0})", { "0": pending.length })}
            description={
              canValidate
                ? i18n.t("Un evenement cree par un professionnel arrive ici automatiquement. Valider le publie et previent l'organisateur ; refuser le renvoie en brouillon avec le motif, qu'il recevra tel quel — et il revient dans cette file des qu'il enregistre une correction.")
                : i18n.t("Un evenement cree par un professionnel arrive ici automatiquement. Seul un super administrateur peut le valider ou le refuser.")
            }
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18n.t("Evenement")}</TableHead>
                <TableHead>{i18n.t("Organisateur")}</TableHead>
                <TableHead>{i18n.t("Date")}</TableHead>
                <TableHead>{i18n.t("Soumis le")}</TableHead>
                <TableHead>{i18n.t("Tarif")}</TableHead>
                <TableHead className="text-right">{i18n.t("Decision")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((row) => {
                const organizer = profiles.get(row.organizer_id);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={i18n.path(`/admin/scout-days/${row.id}`)}
                        className="block max-w-64 truncate font-medium hover:text-brand"
                      >
                        {row.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {row.location ?? "—"}
                        {row.capacity ? i18n.t(" · {0} places", { "0": row.capacity }) : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      <UserCell
                        name={displayName(organizer, undefined, i18n.locale)}
                        secondary={organizer?.email}
                        avatarUrl={organizer?.avatar_url}
                        href={i18n.path(`/admin/utilisateurs/${row.organizer_id}`)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i18n.format.formatDate(row.event_date)}
                      {row.start_time ? (
                        <span className="ml-1 text-xs">{String(row.start_time).slice(0, 5)}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {i18n.format.formatDateTime(row.submitted_at)}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.is_paid
                        ? i18n.format.formatAmount(row.price_amount, row.price_currency ?? "TND")
                        : i18n.t("Gratuit")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {canValidate ? (
                          <>
                            <ActionButton action={validateScoutDay.bind(null, row.id)}>
                              <CheckIcon />
                              {i18n.t("Valider")}</ActionButton>
                            <ReasonDialog
                              action={refuseScoutDay.bind(null, row.id)}
                              trigger={
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
                                >
                                  <XIcon className="size-3.5" />
                                  {i18n.t("Refuser")}</button>
                              }
                              title={i18n.t("Refuser cet evenement")}
                              description={i18n.t("L'evenement retourne en brouillon chez son organisateur, qui recoit le motif en notification.")}
                              label={i18n.t("Motif du refus")}
                              placeholder={i18n.t("Lieu imprecis, tarif incoherent, date a confirmer…")}
                              submitLabel={i18n.t("Refuser l'evenement")}
                            />
                          </>
                        ) : (
                          <StatusPill tone="warning">{i18n.t("Super administrateur requis")}</StatusPill>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      ) : null}

      <ScoutDayCalendar
        events={(calendarRows ?? []) as CalendarEvent[]}
        month={month}
        basePath={i18n.path("/admin/scout-days")}
        params={params}
        today={today}
      />

      <Panel>
        <PanelHeader
          icon={ListChecksIcon}
          title={i18n.t("Liste des evenements enregistres")}
          description={i18n.t("Annuler previent les inscrits via une notification ; supprimer est irreversible et efface les inscriptions en cascade.")}
        />
        <FilterBar
          basePath={i18n.path("/admin/scout-days")}
          params={params}
          searchPlaceholder={i18n.t("Rechercher un titre, un lieu…")}
          filters={[
            { name: "statut", label: i18n.t("Statut"), options: i18n.labels.options(SCOUT_DAY_STATUS) },
            {
              name: "paye",
              label: i18n.t("Payant"),
              options: [
                { value: "oui", label: i18n.t("Payant") },
                { value: "non", label: i18n.t("Gratuit") },
              ],
            },
          ]}
        />

        {error ? (
          <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
            {i18n.t("Lecture impossible :")} {error.message}
          </p>
        ) : null}

        {!rows.length ? (
          <EmptyState
            icon={CalendarDaysIcon}
            title={i18n.t("Aucun evenement")}
            description={i18n.t("Aucun Scout Day ne correspond a ces criteres.")}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18n.t("Evenement")}</TableHead>
                <TableHead>{i18n.t("Organisateur")}</TableHead>
                <TableHead>{i18n.t("Date")}</TableHead>
                <TableHead>{i18n.t("Statut")}</TableHead>
                <TableHead>{i18n.t("Inscriptions")}</TableHead>
                <TableHead>{i18n.t("Tarif")}</TableHead>
                <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const organizer = profiles.get(row.organizer_id);
                const counts = countByEvent.get(row.id) ?? { total: 0, confirmed: 0 };
                const full = row.capacity ? counts.total >= row.capacity : false;

                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={i18n.path(`/admin/scout-days/${row.id}`)}
                        className="block max-w-64 truncate font-medium hover:text-brand"
                      >
                        {row.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">{row.location ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      <UserCell
                        name={displayName(organizer, undefined, i18n.locale)}
                        secondary={organizer?.email}
                        avatarUrl={organizer?.avatar_url}
                        href={i18n.path(`/admin/utilisateurs/${row.organizer_id}`)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i18n.format.formatDate(row.event_date)}
                      {row.start_time ? (
                        <span className="ml-1 text-xs">{String(row.start_time).slice(0, 5)}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={i18n.labels.entry(SCOUT_DAY_STATUS, row.status).tone}>
                        {i18n.labels.label(SCOUT_DAY_STATUS, row.status)}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">
                        {counts.total}
                        {row.capacity ? ` / ${row.capacity}` : ""}
                      </span>
                      {full ? (
                        <StatusPill tone="danger" className="ml-2">
                          {i18n.t("Complet")}</StatusPill>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.is_paid
                        ? i18n.format.formatAmount(row.price_amount, row.price_currency ?? "TND")
                        : i18n.t("Gratuit")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {row.status === "publie" ? (
                          <ActionButton action={setScoutDayStatus.bind(null, row.id, "brouillon")}>
                            {i18n.t("Depublier")}</ActionButton>
                        ) : canValidate ? (
                          <ActionButton
                            action={
                              row.status === "en_attente_validation"
                                ? validateScoutDay.bind(null, row.id)
                                : setScoutDayStatus.bind(null, row.id, "publie")
                            }
                          >
                            <CheckIcon />
                            {row.status === "en_attente_validation" ? i18n.t("Valider") : i18n.t("Publier")}
                          </ActionButton>
                        ) : null}
                        {row.status === "en_attente_validation" && canValidate ? (
                          <ReasonDialog
                            action={refuseScoutDay.bind(null, row.id)}
                            trigger={
                              <button
                                type="button"
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
                              >
                                {i18n.t("Refuser")}</button>
                            }
                            title={i18n.t("Refuser cet evenement")}
                            description={i18n.t("L'evenement retourne en brouillon chez son organisateur, qui recoit le motif en notification.")}
                            label={i18n.t("Motif du refus")}
                            placeholder={i18n.t("Lieu imprecis, tarif incoherent, date a confirmer…")}
                            submitLabel={i18n.t("Refuser l'evenement")}
                          />
                        ) : null}
                        {row.status !== "annule" ? (
                          <ActionButton
                            variant="destructive"
                            action={setScoutDayStatus.bind(null, row.id, "annule")}
                          >
                            <XIcon />
                            {i18n.t("Annuler")}</ActionButton>
                        ) : null}
                        <ActionButton
                          variant="ghost"
                          action={deleteScoutDay.bind(null, row.id)}
                          confirm={{
                            title: i18n.t("Supprimer cet evenement"),
                            description:
                              i18n.t("L'evenement et toutes ses inscriptions seront supprimes definitivement. Pour un evenement qui n'aura pas lieu, preferez le statut « annule », qui previent les inscrits."),
                            actionLabel: i18n.t("Supprimer definitivement"),
                          }}
                        >
                          <Trash2Icon />
                        </ActionButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <Pagination
          basePath={i18n.path("/admin/scout-days")}
          params={params}
          page={page}
          pageSize={PAGE_SIZE}
          total={count ?? 0}
        />
      </Panel>

      <NoteCards
        notes={[
          {
            icon: ShieldCheckIcon,
            title: i18n.t("Publier est un geste de super administrateur"),
            body: i18n.t("Un professionnel soumet son evenement, et seul un super administrateur le fait passer a « publie ». La regle est appliquee par la base de donnees : la permission affichee ici ne fait que cacher un bouton que la base refuserait de toute facon."),
          },
          {
            icon: XIcon,
            title: i18n.t("Un refus est toujours motive"),
            body: i18n.t("Refuser renvoie l'evenement en brouillon chez son organisateur et exige un motif, qu'il recoit tel quel en notification. Il revient dans la file des qu'il enregistre une correction."),
          },
          {
            icon: SlidersHorizontalIcon,
            title: i18n.t("Les criteres filtrent vraiment"),
            body: i18n.t("Age, postes, niveaux, pays et villes sont compares par egalite de chaine au profil du joueur. Un critere ecrit en texte libre s'affiche mais ne filtre personne : le formulaire n'ecrit que les cles reconnues par l'application mobile."),
          },
        ]}
      />
    </>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
