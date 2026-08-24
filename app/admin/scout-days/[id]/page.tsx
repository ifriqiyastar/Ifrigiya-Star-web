import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeftIcon, CalendarDaysIcon, CheckIcon, XIcon } from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { DefinitionList } from "@/components/admin/definition-list";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { StatCard } from "@/components/admin/stat-card";
import { StatusPill } from "@/components/admin/status-pill";
import { ScoutDayDialog } from "@/components/admin/scout-day-dialog";
import { UserCell } from "@/components/admin/user-cell";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { activatePaymentManually } from "@/lib/actions/finances";
import { deleteScoutDay, setRegistrationStatus, setScoutDayStatus } from "@/lib/actions/scout-days";
import { formatAmount, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  REGISTRATION_STATUS,
  SCOUT_DAY_STATUS,
  entry,
  label,
} from "@/lib/labels";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Scout Day" };

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

export default async function ScoutDayDetailPage({
  params,
}: PageProps<"/admin/scout-days/[id]">) {
  await requirePermission("events.manage");
  const { id } = await params;
  const supabase = await createClient();

  const { data: scoutDay } = await supabase
    .from("scout_days")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!scoutDay) notFound();


  const { data: registrations } = await supabase
    .from("scout_day_registrations")
    .select(
      "id, player_id, status, is_eligible, eligibility_checked_at, payment_id, registered_at",
    )
    .eq("scout_day_id", id)
    .order("registered_at", { ascending: true });

  const rows = registrations ?? [];
  const paymentIds = rows.map((row) => row.payment_id).filter(Boolean) as string[];

  const [profiles, payments, evaluations] = await Promise.all([
    fetchProfilesByIds([scoutDay.organizer_id, ...rows.map((row) => row.player_id)]),
    supabase
      .from("payments")
      .select("id, amount, currency, method, status, provider_reference, paid_at")
      .in("id", paymentIds.length ? paymentIds : [EMPTY_UUID]),
    supabase
      .from("scout_evaluations")
      .select(
        "id, registration_id, evaluator_id, technical_score, physical_score, tactical_score, mental_score, overall_score, comment, visible_to_player, created_at",
      )
      .in("registration_id", rows.length ? rows.map((row) => row.id) : [EMPTY_UUID]),
  ]);

  const paymentById = new Map((payments.data ?? []).map((row) => [row.id, row]));
  const evaluationsByRegistration = new Map<string, NonNullable<typeof evaluations.data>>();
  for (const evaluation of evaluations.data ?? []) {
    const list = evaluationsByRegistration.get(evaluation.registration_id) ?? [];
    list.push(evaluation);
    evaluationsByRegistration.set(evaluation.registration_id, list);
  }

  const organizer = profiles.get(scoutDay.organizer_id);
  const confirmed = rows.filter((row) => ["confirme", "present"].includes(row.status)).length;
  const collected = (payments.data ?? [])
    .filter((payment) => ["reussi", "active_manuellement"].includes(payment.status))
    .reduce((acc, payment) => acc + Number(payment.amount ?? 0), 0);
  const pendingPayments = (payments.data ?? []).filter(
    (payment) => payment.status === "en_attente",
  ).length;

  const criteria = (scoutDay.eligibility_criteria ?? {}) as Record<string, unknown>;
  const criteriaEntries = Object.entries(criteria);

  return (
    <>
      <div>
        <Link
          href="/admin/scout-days"
          className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "mb-3 -ml-3")}
        >
          <ArrowLeftIcon />
          Tous les Scout Days
        </Link>
        <PageHeader
          kicker="Scout Days"
          title={scoutDay.title}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <StatusPill tone={entry(SCOUT_DAY_STATUS, scoutDay.status).tone}>
                {label(SCOUT_DAY_STATUS, scoutDay.status)}
              </StatusPill>
              <StatusPill tone={scoutDay.is_paid ? "brand" : "neutral"}>
                {scoutDay.is_paid
                  ? formatAmount(scoutDay.price_amount, scoutDay.price_currency ?? "TND")
                  : "Gratuit"}
              </StatusPill>
              <span className="text-muted-foreground">
                {formatDate(scoutDay.event_date)}
                {scoutDay.location ? ` · ${scoutDay.location}` : ""}
              </span>
            </span>
          }
          actions={
            <>
              <ScoutDayDialog
                value={{
                  id: scoutDay.id,
                  title: scoutDay.title,
                  description: scoutDay.description,
                  event_date: scoutDay.event_date,
                  start_time: scoutDay.start_time,
                  end_time: scoutDay.end_time,
                  location: scoutDay.location,
                  capacity: scoutDay.capacity,
                  eligibility_criteria:
                    typeof scoutDay.eligibility_criteria === "object"
                      ? String(scoutDay.eligibility_criteria?.description ?? "")
                      : String(scoutDay.eligibility_criteria ?? ""),
                  is_paid: scoutDay.is_paid,
                  price_amount: scoutDay.price_amount,
                  price_currency: scoutDay.price_currency,
                }}
              />
              {scoutDay.status !== "publie" ? (
                <ActionButton
                  action={setScoutDayStatus.bind(null, scoutDay.id, "publie")}
                  variant="default"
                  size="sm"
                >
                  <CheckIcon />
                  Publier
                </ActionButton>
              ) : (
                <ActionButton
                  action={setScoutDayStatus.bind(null, scoutDay.id, "brouillon")}
                  size="sm"
                >
                  Depublier
                </ActionButton>
              )}
              {scoutDay.status !== "cloture" ? (
                <ActionButton
                  action={setScoutDayStatus.bind(null, scoutDay.id, "cloture")}
                  size="sm"
                >
                  Cloturer
                </ActionButton>
              ) : null}
              {scoutDay.status !== "annule" ? (
                <ActionButton
                  action={setScoutDayStatus.bind(null, scoutDay.id, "annule")}
                  variant="destructive"
                  size="sm"
                >
                  <XIcon />
                  Annuler
                </ActionButton>
              ) : null}
              <ActionButton
                action={deleteScoutDay.bind(null, scoutDay.id)}
                variant="ghost"
                size="sm"
                confirm={{
                  title: "Supprimer cet evenement",
                  description:
                    "L'evenement et ses inscriptions seront definitivement supprimes. Preferez « Annuler » pour un evenement qui n'aura pas lieu.",
                  actionLabel: "Supprimer definitivement",
                }}
              >
                Supprimer
              </ActionButton>
            </>
          }
        />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Inscriptions"
          value={`${formatNumber(rows.length)}${scoutDay.capacity ? ` / ${scoutDay.capacity}` : ""}`}
          hint={`${formatNumber(confirmed)} confirmees ou presentes`}
          icon={CalendarDaysIcon}
          tone="brand"
        />
        <StatCard
          label="Encaisse"
          value={formatAmount(collected, scoutDay.price_currency ?? "TND")}
          hint={`${formatNumber(pendingPayments)} paiement(s) en attente`}
        />
        <StatCard
          label="Evaluations"
          value={formatNumber(evaluations.data?.length ?? 0)}
          hint="Rapports de scouting saisis"
        />
        <StatCard
          label="Places restantes"
          value={
            scoutDay.capacity ? formatNumber(Math.max(0, scoutDay.capacity - rows.length)) : "—"
          }
          hint={scoutDay.capacity ? "Capacite declaree" : "Aucune capacite definie"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Fiche de l'evenement" />
          <div className="space-y-5 px-4 py-5 sm:px-5">
            <DefinitionList
              items={[
                {
                  label: "Organisateur",
                  value: (
                    <Link
                      href={`/admin/utilisateurs/${scoutDay.organizer_id}`}
                      className="hover:text-brand"
                    >
                      {displayName(organizer)}
                    </Link>
                  ),
                },
                { label: "Date", value: formatDate(scoutDay.event_date) },
                {
                  label: "Horaires",
                  value:
                    [scoutDay.start_time, scoutDay.end_time]
                      .filter(Boolean)
                      .map((value) => String(value).slice(0, 5))
                      .join(" – ") || "—",
                },
                { label: "Lieu", value: scoutDay.location ?? "—" },
                { label: "Capacite", value: scoutDay.capacity ?? "Non limitee" },
                {
                  label: "Tarif",
                  value: scoutDay.is_paid
                    ? formatAmount(scoutDay.price_amount, scoutDay.price_currency ?? "TND")
                    : "Gratuit",
                },
                { label: "Cree le", value: formatDateTime(scoutDay.created_at) },
                { label: "Mis a jour le", value: formatDateTime(scoutDay.updated_at) },
              ]}
            />
            {scoutDay.description ? (
              <div className="space-y-1.5">
                <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  Description
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {scoutDay.description}
                </p>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Criteres d'eligibilite"
            description="Structure libre (jsonb) : le CDC ne fixe pas de liste fermee de criteres."
          />
          <div className="px-4 py-5 sm:px-5">
            {!criteriaEntries.length ? (
              <p className="text-xs text-muted-foreground">Aucun critere declare.</p>
            ) : (
              <dl className="space-y-3">
                {criteriaEntries.map(([key, value]) => (
                  <div key={key} className="space-y-0.5">
                    <dt className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                      {key.replace(/_/g, " ")}
                    </dt>
                    <dd className="text-sm break-words">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Inscriptions et paiements"
          description="Un paiement encaisse hors ligne se debloque via « Activer manuellement »."
        />
        {!rows.length ? (
          <EmptyState
            icon={CalendarDaysIcon}
            title="Aucune inscription"
            description="Aucun joueur ne s'est encore inscrit a cet evenement."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joueur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Eligibilite</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead>Evaluation</TableHead>
                <TableHead>Inscrit le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const player = profiles.get(row.player_id);
                const payment = row.payment_id ? paymentById.get(row.payment_id) : undefined;
                const registrationEvaluations = evaluationsByRegistration.get(row.id) ?? [];
                const bestScore = registrationEvaluations.length
                  ? Math.max(
                      ...registrationEvaluations.map((evaluation) =>
                        Number(evaluation.overall_score ?? 0),
                      ),
                    )
                  : null;

                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <UserCell
                        name={displayName(player)}
                        secondary={player?.email}
                        avatarUrl={player?.avatar_url}
                        href={`/admin/utilisateurs/${row.player_id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={entry(REGISTRATION_STATUS, row.status).tone}>
                        {label(REGISTRATION_STATUS, row.status)}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      {row.is_eligible === null ? (
                        <span className="text-xs text-muted-foreground">Non verifiee</span>
                      ) : (
                        <StatusPill tone={row.is_eligible ? "success" : "danger"}>
                          {row.is_eligible ? "Eligible" : "Non eligible"}
                        </StatusPill>
                      )}
                    </TableCell>
                    <TableCell>
                      {payment ? (
                        <div className="flex flex-col gap-1">
                          <StatusPill tone={entry(PAYMENT_STATUS, payment.status).tone}>
                            {label(PAYMENT_STATUS, payment.status)}
                          </StatusPill>
                          <span className="text-xs text-muted-foreground">
                            {formatAmount(payment.amount, payment.currency ?? "TND")} ·{" "}
                            {label(PAYMENT_METHOD, payment.method)}
                          </span>
                        </div>
                      ) : scoutDay.is_paid ? (
                        <StatusPill tone="warning">Aucun paiement</StatusPill>
                      ) : (
                        <span className="text-xs text-muted-foreground">Gratuit</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {bestScore === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span className="font-semibold tabular-nums">
                          {bestScore.toFixed(1)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            /100
                          </span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.registered_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {row.status !== "confirme" ? (
                          <ActionButton
                            action={setRegistrationStatus.bind(null, row.id, "confirme")}
                          >
                            Confirmer
                          </ActionButton>
                        ) : null}
                        {row.status !== "present" ? (
                          <ActionButton
                            action={setRegistrationStatus.bind(null, row.id, "present")}
                            variant="secondary"
                          >
                            Present
                          </ActionButton>
                        ) : null}
                        {row.status !== "absent" ? (
                          <ActionButton
                            action={setRegistrationStatus.bind(null, row.id, "absent")}
                            variant="ghost"
                          >
                            Absent
                          </ActionButton>
                        ) : null}
                        {row.status !== "refuse" ? (
                          <ActionButton
                            action={setRegistrationStatus.bind(null, row.id, "refuse")}
                            variant="destructive"
                          >
                            Refuser
                          </ActionButton>
                        ) : null}
                        {payment?.status === "en_attente" ? (
                          <ActionButton
                            action={activatePaymentManually.bind(null, payment.id)}
                            variant="default"
                          >
                            Activer le paiement
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

      {evaluations.data?.length ? (
        <Panel>
          <PanelHeader
            title="Rapports de scouting"
            description="Le bareme du score /100 n'est pas fixe par le CDC : les scores affiches sont ceux saisis par les evaluateurs, moyennes par la colonne calculee overall_score."
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joueur</TableHead>
                <TableHead>Technique</TableHead>
                <TableHead>Physique</TableHead>
                <TableHead>Tactique</TableHead>
                <TableHead>Mental</TableHead>
                <TableHead>Global</TableHead>
                <TableHead>Visible au joueur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.data.map((evaluation) => {
                const registration = rows.find((row) => row.id === evaluation.registration_id);
                const player = registration ? profiles.get(registration.player_id) : undefined;
                return (
                  <TableRow key={evaluation.id}>
                    <TableCell>{displayName(player)}</TableCell>
                    <TableCell className="tabular-nums">{evaluation.technical_score}</TableCell>
                    <TableCell className="tabular-nums">{evaluation.physical_score}</TableCell>
                    <TableCell className="tabular-nums">{evaluation.tactical_score}</TableCell>
                    <TableCell className="tabular-nums">{evaluation.mental_score}</TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {evaluation.overall_score}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={evaluation.visible_to_player ? "success" : "neutral"}>
                        {evaluation.visible_to_player ? "Publie" : "Prive"}
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      ) : null}
    </>
  );
}
