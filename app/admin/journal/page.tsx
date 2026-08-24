import Link from "next/link";
import type { Metadata } from "next";
import { ScrollTextIcon } from "lucide-react";

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
import { formatDateTime } from "@/lib/format";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Journal d'audit" };

const PAGE_SIZE = 40;

/** Types de cible presents dans le journal, pour alimenter le filtre. */
const TARGET_TYPES = [
  "profile",
  "player_profile",
  "professional_profile",
  "professional_document",
  "identity_verification",
  "post",
  "post_comment",
  "player_video",
  "player_photo",
  "report",
  "scout_day",
  "scout_day_registration",
  "payment",
  "subscription",
];

/**
 * §13 — tracabilite. `admin_audit_log` est alimente par `log_admin_action()`,
 * appele par chaque Server Action du back-office. La table est en lecture
 * seule ici : un journal qu'on peut modifier depuis l'interface qu'il
 * surveille ne prouve rien.
 */
export default async function JournalPage({ searchParams }: PageProps<"/admin/journal">) {
  await requirePermission("audit.read");
  const resolved = await searchParams;
  const params = {
    q: str(resolved.q),
    cible: str(resolved.cible),
    page: str(resolved.page),
  };
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("admin_audit_log")
    .select("id, admin_id, action, target_type, target_id, metadata, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (params.cible) query = query.eq("target_type", params.cible);
  if (params.q) {
    const term = params.q.replace(/[%,()]/g, " ").trim();
    if (term) query = query.ilike("action", `%${term}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);

  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(rows.map((row) => row.admin_id));

  return (
    <>
      <PageHeader
        kicker="Securite et tracabilite"
        title="Journal d'audit"
        description="Chaque validation, suspension, suppression ou action de moderation passee par ce back-office y est consignee avec son auteur. La table n'est pas modifiable depuis l'interface."
      />

      <Panel>
        <PanelHeader
          title="Actions administrateur"
          description="Ordre chronologique inverse. La colonne « Details » reprend le contenu jsonb enregistre avec l'action."
        />
        <FilterBar
          basePath="/admin/journal"
          params={params}
          searchPlaceholder="Rechercher une action (suspend, validate…)"
          filters={[
            {
              name: "cible",
              label: "Cible",
              options: TARGET_TYPES.map((value) => ({
                value,
                label: value.replace(/_/g, " "),
              })),
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
            icon={ScrollTextIcon}
            title="Aucune action tracee"
            description="Le journal se remplira des la premiere action effectuee depuis ce back-office."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Administrateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Cible</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const admin = profiles.get(row.admin_id);
                const metadata = row.metadata as Record<string, unknown> | null;
                const hasMetadata = metadata && Object.keys(metadata).length > 0;

                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell>
                      <UserCell
                        name={displayName(admin)}
                        secondary={admin?.email}
                        avatarUrl={admin?.avatar_url}
                        href={`/admin/utilisateurs/${row.admin_id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-brand">{row.action}</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusPill tone="neutral">
                          {row.target_type.replace(/_/g, " ")}
                        </StatusPill>
                        <Link
                          href={`/admin/utilisateurs/${row.target_id}`}
                          className="max-w-40 truncate text-[0.6875rem] text-muted-foreground hover:text-foreground"
                          title={row.target_id}
                        >
                          {row.target_id}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal">
                      {hasMetadata ? (
                        <code className="text-[0.6875rem] break-words text-muted-foreground">
                          {JSON.stringify(metadata)}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Pagination
          basePath="/admin/journal"
          params={params}
          page={page}
          pageSize={PAGE_SIZE}
          total={count ?? 0}
        />
      </Panel>
    </>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
