import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDaysIcon, CheckIcon, Trash2Icon, XIcon } from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { StatCard } from "@/components/admin/stat-card";
import { StatusPill } from "@/components/admin/status-pill";
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
import { deleteScoutDay, setScoutDayStatus } from "@/lib/actions/scout-days";
import { formatAmount, formatDate, formatNumber } from "@/lib/format";
import { SCOUT_DAY_STATUS, entry, label, options } from "@/lib/labels";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Scout Days" };

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

export default async function ScoutDaysPage({ searchParams }: PageProps<"/admin/scout-days">) {
  await requirePermission("events.manage");
  const resolved = await searchParams;
  const params = { q: str(resolved.q), statut: str(resolved.statut), paye: str(resolved.paye) };

  const supabase = await createClient();

  let query = supabase
    .from("scout_days")
    .select(
      "id, organizer_id, title, description, event_date, start_time, location, capacity, is_paid, price_amount, price_currency, status, eligibility_criteria, created_at",
    )
    .order("event_date", { ascending: false })
    .limit(200);

  if (params.statut) query = query.eq("status", params.statut);
  if (params.paye === "oui") query = query.eq("is_paid", true);
  if (params.paye === "non") query = query.eq("is_paid", false);

  const { data, error } = await query;
  const rows = (data ?? []).filter((row) =>
    params.q
      ? `${row.title} ${row.location ?? ""}`.toLowerCase().includes(params.q.toLowerCase())
      : true,
  );

  const profiles = await fetchProfilesByIds(rows.map((row) => row.organizer_id));

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
        kicker="Scout Days"
        title="Evenements de detection"
        description="Tous les Scout Days, quel que soit leur organisateur. L'administration peut publier, remettre en brouillon, annuler ou cloturer un evenement, et suivre inscriptions et paiements."
        actions={<ScoutDayDialog />}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Evenements"
          value={formatNumber(rows.length)}
          icon={CalendarDaysIcon}
          tone="brand"
        />
        <StatCard label="Publies" value={formatNumber(published)} />
        <StatCard label="Brouillons" value={formatNumber(drafts)} />
        <StatCard label="Inscriptions" value={formatNumber(totalRegistrations)} />
      </section>

      <Panel>
        <PanelHeader
          title="Liste des evenements"
          description="Annuler previent les inscrits via une notification ; supprimer est irreversible et efface les inscriptions en cascade."
        />
        <FilterBar
          basePath="/admin/scout-days"
          params={params}
          searchPlaceholder="Rechercher un titre, un lieu…"
          filters={[
            { name: "statut", label: "Statut", options: options(SCOUT_DAY_STATUS) },
            {
              name: "paye",
              label: "Payant",
              options: [
                { value: "oui", label: "Payant" },
                { value: "non", label: "Gratuit" },
              ],
            },
          ]}
        />

        {error ? (
          <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
            Lecture impossible : {error.message}
          </p>
        ) : null}

        {!rows.length ? (
          <EmptyState
            icon={CalendarDaysIcon}
            title="Aucun evenement"
            description="Aucun Scout Day ne correspond a ces criteres."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evenement</TableHead>
                <TableHead>Organisateur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Inscriptions</TableHead>
                <TableHead>Tarif</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                        href={`/admin/scout-days/${row.id}`}
                        className="block max-w-64 truncate font-medium hover:text-brand"
                      >
                        {row.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">{row.location ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      <UserCell
                        name={displayName(organizer)}
                        secondary={organizer?.email}
                        avatarUrl={organizer?.avatar_url}
                        href={`/admin/utilisateurs/${row.organizer_id}`}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.event_date)}
                      {row.start_time ? (
                        <span className="ml-1 text-xs">{String(row.start_time).slice(0, 5)}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={entry(SCOUT_DAY_STATUS, row.status).tone}>
                        {label(SCOUT_DAY_STATUS, row.status)}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">
                        {counts.total}
                        {row.capacity ? ` / ${row.capacity}` : ""}
                      </span>
                      {full ? (
                        <StatusPill tone="danger" className="ml-2">
                          Complet
                        </StatusPill>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.is_paid
                        ? formatAmount(row.price_amount, row.price_currency ?? "TND")
                        : "Gratuit"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {row.status !== "publie" ? (
                          <ActionButton action={setScoutDayStatus.bind(null, row.id, "publie")}>
                            <CheckIcon />
                            Publier
                          </ActionButton>
                        ) : (
                          <ActionButton action={setScoutDayStatus.bind(null, row.id, "brouillon")}>
                            Depublier
                          </ActionButton>
                        )}
                        {row.status !== "annule" ? (
                          <ActionButton
                            variant="destructive"
                            action={setScoutDayStatus.bind(null, row.id, "annule")}
                          >
                            <XIcon />
                            Annuler
                          </ActionButton>
                        ) : null}
                        <ActionButton
                          variant="ghost"
                          action={deleteScoutDay.bind(null, row.id)}
                          confirm={{
                            title: "Supprimer cet evenement",
                            description:
                              "L'evenement et toutes ses inscriptions seront supprimes definitivement. Pour un evenement qui n'aura pas lieu, preferez le statut « annule », qui previent les inscrits.",
                            actionLabel: "Supprimer definitivement",
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
      </Panel>
    </>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
