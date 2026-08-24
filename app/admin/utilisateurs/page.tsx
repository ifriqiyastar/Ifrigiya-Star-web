import type { Metadata } from "next";
import { UsersIcon } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
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
import { formatDate, timeAgo } from "@/lib/format";
import { ACCOUNT_STATUS, ROLE, entry, label, options } from "@/lib/labels";
import { listUsers, USERS_PAGE_SIZE } from "@/lib/queries/users";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/utilisateurs">) {
  await requirePermission("users.read");
  const resolved = await searchParams;
  const params = {
    q: str(resolved.q),
    role: str(resolved.role),
    statut: str(resolved.statut),
    actif: str(resolved.actif),
    page: str(resolved.page),
  };

  const { rows, total, page, error } = await listUsers({
    q: params.q,
    role: params.role,
    statut: params.statut,
    actif: params.actif,
    page: Number(params.page ?? 1) || 1,
  });

  return (
    <>
      <PageHeader
        kicker="Utilisateurs et validations"
        title="Comptes"
        description="Tous les comptes de la plateforme, quel que soit leur type. Ouvrir une fiche donne acces a la consultation, la modification, la suspension, la reactivation et la suppression."
      />

      <Panel>
        <PanelHeader
          title="Annuaire des comptes"
          description="Le statut affiche est celui du profil metier (joueur ou professionnel) ; « Actif » reflete profiles.is_active."
          action={<span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold tabular-nums">{total} compte{total > 1 ? "s" : ""}</span>}
        />
        <FilterBar
          basePath="/admin/utilisateurs"
          params={params}
          filters={[
            { name: "role", label: "Type", options: options(ROLE) },
            { name: "statut", label: "Statut", options: options(ACCOUNT_STATUS) },
            {
              name: "actif",
              label: "Actif",
              options: [
                { value: "oui", label: "Actif" },
                { value: "non", label: "Desactive" },
              ],
            },
          ]}
        />

        {error ? (
          <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
            Lecture impossible : {error}
          </p>
        ) : null}

        {!rows.length ? (
          <EmptyState
            icon={UsersIcon}
            title="Aucun compte"
            description="Aucun compte ne correspond a ces criteres."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Compte</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead>Derniere connexion</TableHead>
                <TableHead>Inscrit le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={row.full_name}
                      secondary={row.email ?? row.phone}
                      avatarUrl={row.avatar_url}
                      href={`/admin/utilisateurs/${row.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={entry(ROLE, row.role).tone}>
                      {label(ROLE, row.role)}
                    </StatusPill>
                  </TableCell>
                  <TableCell>
                    {row.businessStatus ? (
                      <StatusPill tone={entry(ACCOUNT_STATUS, row.businessStatus).tone}>
                        {label(ACCOUNT_STATUS, row.businessStatus)}
                      </StatusPill>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {row.detail ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.deletion_requested_at ? (
                      <StatusPill tone="danger">Suppression demandee</StatusPill>
                    ) : row.is_active ? (
                      <StatusPill tone="success">Actif</StatusPill>
                    ) : (
                      <StatusPill tone="neutral">Desactive</StatusPill>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {timeAgo(row.last_login_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination
          basePath="/admin/utilisateurs"
          params={params}
          page={page}
          pageSize={USERS_PAGE_SIZE}
          total={total}
        />
      </Panel>
    </>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
