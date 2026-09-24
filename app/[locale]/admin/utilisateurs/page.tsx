import { getAdminI18n } from "@/lib/i18n/admin";
import Link from "next/link";
import type { Metadata } from "next";
import {
  BadgeCheckIcon,
  BanIcon,
  DownloadIcon,
  EyeIcon,
  MailIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";

import { CreateEditorDialog } from "@/components/admin/create-editor-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { KpiTile } from "@/components/admin/kpi-tile";
import { NoteCards } from "@/components/admin/note-cards";
import { HeaderMeta, PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel } from "@/components/admin/panel";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { makeFormat } from "@/lib/format";
import { suspendUser } from "@/lib/actions/moderation";
import { fill, getAdminDict, getAdminLocale } from "@/lib/i18n/admin";
import { localePath } from "@/lib/i18n/config";
import { ACCOUNT_STATUS, ROLE, makeLabels } from "@/lib/labels";
import { listUsers, USERS_PAGE_SIZE } from "@/lib/queries/users";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin, requirePermission } from "@/lib/auth";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAdminDict();
  return { title: dict.users.metaTitle };
}

export default async function UsersPage({ searchParams }: PageProps<"/[locale]/admin/utilisateurs">) {
  const i18n = await getAdminI18n();

  const admin = await requirePermission("users.read");
  const [locale, dict, canCreateEditor] = await Promise.all([
    getAdminLocale(),
    getAdminDict(),
    isSuperAdmin(),
  ]);
  const d = dict.users;
  const { formatDate, formatNumber } = makeFormat(locale);
  const { entry, label, options } = makeLabels(locale);
  const href = (path: string) => localePath(locale, path);
  const resolved = await searchParams;
  const params = {
    q: str(resolved.q),
    role: str(resolved.role),
    statut: str(resolved.statut),
    actif: str(resolved.actif),
    suppression: str(resolved.suppression),
    page: str(resolved.page),
  };

  const { rows, total, page, error } = await listUsers({
    q: params.q,
    role: params.role,
    statut: params.statut,
    actif: params.actif,
    suppression: params.suppression,
    page: Number(params.page ?? 1) || 1,
  });

  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [allAccounts, activeAccounts, playerAccounts, proAccounts, playersTotal, kycValidated] =
    await Promise.all([
      supabase.from("profiles").select("id", head),
      supabase.from("profiles").select("id", head).eq("is_active", true),
      supabase.from("profiles").select("id", head).eq("role", "player"),
      supabase.from("profiles").select("id", head).eq("role", "professional"),
      supabase.from("player_profiles").select("id", head),
      // Conformite d'identite : nombre de pieces au statut « valide ». Une
      // ligne par joueur au plus dans les faits, et le libelle dit le
      // denominateur — pas un pourcentage flottant sans base.
      supabase.from("identity_verifications").select("id", head).eq("status", "valide"),
    ]);

  const allCount = allAccounts.count ?? 0;
  const playerCount = playerAccounts.count ?? 0;
  const proCount = proAccounts.count ?? 0;
  const playersWithProfile = playersTotal.count ?? 0;
  const kycCount = kycValidated.count ?? 0;

  // Role RBAC des administrateurs listes. Degrade en silence si la migration
  // RBAC n'est pas appliquee : la colonne affiche alors « Administrateur ».
  const adminIds = rows.filter((row) => row.role === "admin").map((row) => row.id);
  const adminRoleById = new Map<string, string>();
  if (adminIds.length) {
    const { data: assignments, error: assignmentsError } = await supabase
      .from("admin_user_roles")
      .select("admin_id, role_id")
      .in("admin_id", adminIds);
    // Erreur avalee volontairement pour l'utilisateur (repli sur le libelle
    // generique), mais pas pour les logs serveur : un `42501` ici signale un
    // GRANT manquant, pas une absence de migration, et se confond sinon avec
    // le cas « role non attribue ».
    if (assignmentsError) console.error("admin_user_roles read:", assignmentsError);
    const roleIds = [...new Set((assignments ?? []).map((row) => row.role_id))];
    if (roleIds.length) {
      const { data: roles, error: rolesError } = await supabase
        .from("admin_roles")
        .select("id, code, label")
        .in("id", roleIds);
      if (rolesError) console.error("admin_roles read:", rolesError);
      const labelById = new Map((roles ?? []).map((row) => [row.id, dict.roles.names[row.code as keyof typeof dict.roles.names] ?? row.label as string]));
      for (const assignment of assignments ?? []) {
        const roleLabel = labelById.get(assignment.role_id);
        if (roleLabel) adminRoleById.set(assignment.admin_id as string, roleLabel);
      }
    }
  }

  // L'export reprend les filtres de l'ecran : exporter autre chose que ce qui
  // est affiche serait un piege.
  const exportQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") exportQuery.set(key, value);
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: d.breadcrumbSection }, { label: d.breadcrumbCurrent }]}
        title={d.title}
        meta={
          <HeaderMeta tone="brand" dot>
            {fill(d.registeredAccounts, { count: formatNumber(allCount) })}
          </HeaderMeta>
        }
        description={d.description}
        actions={
          <>
            {/* Reserve au super administrateur : creer un compte donne acces
                au back-office, un cran au-dessus de `users.write`. Le geste
                touche l'API Auth Admin et `admin_user_roles` (aucune policy
                d'ecriture, meme pour un admin authentifie) — voir
                `createEditorAccount()`. Un seul role attribuable ici,
                `editeur` : ce n'est pas un ecran general de gestion des roles
                RBAC, qui reste par l'editeur SQL (202608240006). */}
            {canCreateEditor ? <CreateEditorDialog /> : null}
            <Link
              href={href(
                i18n.path(`/admin/utilisateurs/export${exportQuery.size ? `?${exportQuery}` : ""}`),
              )}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold hover:bg-accent/70"
            >
              <DownloadIcon className="size-4" />
              {dict.common.export}
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          label={d.kpiTotal}
          value={formatNumber(allCount)}
          qualifier={
            allCount
              ? fill(d.kpiActiveShare, {
                  percent: Math.round(((activeAccounts.count ?? 0) / allCount) * 100),
                })
              : undefined
          }
          share={allCount ? (activeAccounts.count ?? 0) / allCount : undefined}
          icon={UsersIcon}
        />
        <KpiTile
          label={d.kpiPlayers}
          value={formatNumber(playerCount)}
          qualifier={
            allCount
              ? fill(d.kpiShareOfBase, { percent: Math.round((playerCount / allCount) * 100) })
              : undefined
          }
          share={allCount ? playerCount / allCount : undefined}
          icon={UserRoundIcon}
          accent="secondary"
        />
        <KpiTile
          label={d.kpiPros}
          value={formatNumber(proCount)}
          qualifier={
            allCount
              ? fill(d.kpiShareOfBase, { percent: Math.round((proCount / allCount) * 100) })
              : undefined
          }
          share={allCount ? proCount / allCount : undefined}
          icon={ShieldCheckIcon}
          accent="secondary"
        />
        <KpiTile
          label={d.kpiIdentity}
          value={
            playersWithProfile
              ? `${Math.round((Math.min(kycCount, playersWithProfile) / playersWithProfile) * 100)} %`
              : "—"
          }
          qualifier={fill(d.kpiIdentityQualifier, {
            done: formatNumber(kycCount),
            total: formatNumber(playersWithProfile),
          })}
          share={playersWithProfile ? Math.min(kycCount, playersWithProfile) / playersWithProfile : undefined}
          icon={BadgeCheckIcon}
          accent="tertiary"
        />
      </section>

      {/* Barre de recherche et de filtres : un formulaire GET, donc l'etat vit
          dans l'URL et la page reste un Server Component qui refait sa requete.
          Les listes sont des `<select>` natifs — aucun etat client a tenir. */}
      <form
        method="get"
        className="flex flex-col items-stretch justify-between gap-3 rounded-lg border border-border bg-card p-3 lg:flex-row lg:items-center"
      >
        <div className="flex flex-1 items-center gap-2">
          <div className="flex w-full max-w-md items-center gap-2 rounded-lg bg-background px-3 py-1.5">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder={d.searchPlaceholder}
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            <kbd className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
              {d.enterKey}
            </kbd>
          </div>
          <button
            type="submit"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-muted px-3 text-xs font-semibold hover:bg-accent"
          >
            <SlidersHorizontalIcon className="size-3.5" />
            {d.apply}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Selector
            name="role"
            label={d.filterType}
            value={params.role}
            options={options(ROLE)}
            all={d.filterAll}
          />
          <Selector
            name="statut"
            label={d.filterStatus}
            value={params.statut}
            options={options(ACCOUNT_STATUS)}
            all={d.filterAll}
          />
          <Selector
            name="actif"
            label={d.filterState}
            value={params.actif}
            options={[
              { value: "oui", label: d.activeOnly },
              { value: "non", label: d.deactivated },
            ]}
            all={d.activeAll}
          />
          <Selector
            name="suppression"
            label={d.filterDeletion}
            value={params.suppression}
            options={[{ value: "oui", label: d.deletionPending }]}
            all={d.filterAllFem}
          />
          <Link
            href={href("/admin/utilisateurs")}
            title={d.resetFilters}
            aria-label={d.resetFilters}
            className="inline-flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCcwIcon className="size-4" />
          </Link>
        </div>
      </form>

      <Panel>
        {error ? (
          <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
            {fill(d.readError, { error })}
          </p>
        ) : null}

        {!rows.length ? (
          <EmptyState
            icon={UsersIcon}
            title={d.emptyTitle}
            description={d.emptyDesc}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{d.colUser}</TableHead>
                <TableHead>{d.colRole}</TableHead>
                <TableHead>{d.colCompliance}</TableHead>
                <TableHead>{d.colDetail}</TableHead>
                <TableHead>{d.colState}</TableHead>
                <TableHead className="text-right">{d.colRegistered}</TableHead>
                <TableHead className="text-right">{d.colActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isSelf = row.id === admin.userId;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserCell
                          name={row.full_name}
                          secondary={undefined}
                          avatarUrl={row.avatar_url}
                          href={href(`/admin/utilisateurs/${row.id}`)}
                        />
                        {isSelf ? (
                          <span className="micro-label shrink-0 rounded bg-warning/20 px-1.5 py-0.5 text-warning">
                            {d.self}
                          </span>
                        ) : null}
                      </div>
                      <span className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                        <MailIcon className="size-3 shrink-0" />
                        <span className="truncate">{row.email ?? row.phone ?? "—"}</span>
                      </span>
                    </TableCell>

                    <TableCell>
                      <span
                        className={cn(
                          "micro-label inline-flex items-center rounded-full px-2 py-0.5",
                          row.role === "player"
                            ? "bg-brand/15 text-brand"
                            : row.role === "professional"
                              ? "bg-info/15 text-info"
                              : "bg-warning/15 text-warning",
                        )}
                      >
                        {row.role === "admin"
                          ? (adminRoleById.get(row.id) ?? dict.roles.fallback)
                          : label(ROLE, row.role)}
                      </span>
                    </TableCell>

                    <TableCell>
                      {row.role === "admin" ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-warning">
                          <ShieldCheckIcon className="size-3" />
                          {adminRoleById.get(row.id) ?? dict.roles.fallback}
                        </span>
                      ) : row.businessStatus ? (
                        <StatusPill tone={entry(ACCOUNT_STATUS, row.businessStatus).tone} dot>
                          {label(ACCOUNT_STATUS, row.businessStatus)}
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral" dot>
                          {d.notVerified}
                        </StatusPill>
                      )}
                    </TableCell>

                    <TableCell>
                      {row.detail ? (
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className={cn(
                              "size-2 shrink-0 rounded-sm",
                              row.role === "player" ? "bg-brand" : "bg-info",
                            )}
                          />
                          <span className="max-w-48 truncate text-xs font-medium">
                            {row.detail}
                          </span>
                        </span>
                      ) : row.role === "admin" ? (
                        <span className="text-[0.6875rem] text-muted-foreground">
                          {d.backOfficeAccess}
                        </span>
                      ) : (
                        <span className="text-[0.6875rem] text-muted-foreground italic">
                          {d.standardProfile}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      {row.deletion_requested_at ? (
                        <StatusPill tone="danger" dot>
                          {d.deletionRequested}
                        </StatusPill>
                      ) : row.is_active ? (
                        <StatusPill tone="success" dot>
                          {d.active}
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral" dot>
                          {d.deactivated}
                        </StatusPill>
                      )}
                    </TableCell>

                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      {formatDate(row.created_at)}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={href(`/admin/utilisateurs/${row.id}`)}
                          title={d.openRecord}
                          aria-label={fill(d.openRecordOf, {
                            name: row.full_name || d.thisAccount,
                          })}
                          className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <EyeIcon className="size-4" />
                        </Link>
                        {/* Son propre compte : on ne **desactive** pas le
                            bouton, on ne l'offre pas. `disabled` sur l'element
                            passe en `render` d'un `DialogTrigger` Base UI
                            n'est pas stable au rendu serveur et cassait
                            l'hydratation de la page entiere. */}
                        {isSelf ? (
                          <span className="rounded bg-muted px-2 py-1 text-[0.6875rem] text-muted-foreground italic">
                            {d.yourAccount}
                          </span>
                        ) : row.is_active && !row.deletion_requested_at ? (
                          <ReasonDialog
                            action={suspendUser.bind(null, row.id)}
                            trigger={
                              <Button
                                variant="destructive"
                                size="xs"
                                aria-label={fill(d.suspendName, {
                                  name: row.full_name || d.thisAccount,
                                })}
                              >
                                <BanIcon />
                                {d.suspend}
                              </Button>
                            }
                            title={d.suspendTitle}
                            description={d.suspendDesc}
                            placeholder={d.suspendPlaceholder}
                            submitLabel={d.suspendSubmit}
                          />
                        ) : (
                          <Link
                            href={href(`/admin/utilisateurs/${row.id}`)}
                            className="rounded bg-muted px-2 py-1 text-[0.6875rem] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            {d.openFile}
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Pagination
          basePath={href("/admin/utilisateurs")}
          params={params}
          page={page}
          pageSize={USERS_PAGE_SIZE}
          total={total}
        />
      </Panel>

      <NoteCards
        notes={[
          {
            icon: ShieldCheckIcon,
            title: d.noteSuspendTitle,
            body: d.noteSuspendBody,
          },
          {
            icon: BanIcon,
            title: d.noteReactivateTitle,
            body: d.noteReactivateBody,
          },
          {
            icon: Trash2Icon,
            title: d.noteDeletionTitle,
            body: d.noteDeletionBody,
          },
        ]}
      />
    </>
  );
}

/**
 * Liste de filtre de la maquette : intitule en capitales collé au `<select>`,
 * dans un bloc sombre. Natif, donc aucun etat client — la soumission du
 * formulaire porte la valeur dans l'URL.
 */
function Selector({
  name,
  label: name_,
  value,
  options: choices,
  all,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  all: string;
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5">
      <span className="micro-label text-muted-foreground">{name_}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="cursor-pointer bg-transparent pr-1 text-xs font-semibold text-foreground outline-none"
      >
        <option value="">{all}</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const str = (value: string | string[] | undefined) =>
  typeof value === "string" && value ? value : undefined;
