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
  Trash2Icon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";

import { AutoFilterForm, FilterSearchIcon } from "@/components/admin/auto-filter-form";
import { STACKED_ON_MOBILE } from "@/components/admin/table-stack";
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
import {
  fetchAdminRoleLabels,
  fetchUserStats,
  listUsers,
  USERS_PAGE_SIZE,
} from "@/lib/queries/users";
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

  // La liste et les tuiles partent ENSEMBLE. Les tuiles portent sur toute la
  // base, pas sur la page affichee : rien ne les obligeait a attendre la
  // liste, ce qu'elles faisaient — un aller-retour de plus a chaque
  // chargement et a chaque rafraichissement automatique. Elles tiennent
  // desormais en un seul appel (`fetchUserStats`) au lieu de six requetes,
  // ce qui se voit surtout en paginant : un clic sur « Suivant » les
  // recompte, puisqu'elles sont rendues par la meme page.
  const [{ rows, total, page, error }, stats] = await Promise.all([
    listUsers({
      q: params.q,
      role: params.role,
      statut: params.statut,
      actif: params.actif,
      suppression: params.suppression,
      page: Number(params.page ?? 1) || 1,
    }),
    fetchUserStats(),
  ]);

  const allCount = stats.all;
  const playerCount = stats.players;
  const proCount = stats.professionals;
  const playersWithProfile = stats.playerProfiles;
  const kycCount = stats.identityValidated;

  // Role RBAC des administrateurs listes. Degrade en silence si la migration
  // RBAC n'est pas appliquee : la colonne affiche alors « Administrateur ».
  const adminIds = rows.filter((row) => row.role === "admin").map((row) => row.id);
  const adminRoleById = new Map<string, string>();
  for (const [adminId, role] of await fetchAdminRoleLabels(adminIds)) {
    const label =
      (role.code ? dict.roles.names[role.code as keyof typeof dict.roles.names] : undefined) ??
      role.label;
    if (label) adminRoleById.set(adminId, label);
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
              // Meme defaut que les onglets du tableau de bord : `href()` et
              // `i18n.path()` prefixent chacun la langue, donc l'export menait
              // a `/en/en/admin/utilisateurs/export`.
              href={i18n.path(
                `/admin/utilisateurs/export${exportQuery.size ? `?${exportQuery}` : ""}`,
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
                  percent: Math.round((stats.active / allCount) * 100),
                })
              : undefined
          }
          share={allCount ? stats.active / allCount : undefined}
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

      {/* Barre de recherche et de filtres : l'etat vit dans l'URL et la page
          reste un Server Component qui refait sa requete. `AutoFilterForm`
          l'applique tout seul — une liste au changement, la recherche apres la
          frappe — la ou il fallait cliquer « Appliquer ». */}
      <AutoFilterForm className="flex flex-col items-stretch justify-between gap-3 rounded-lg border border-border bg-card p-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-2">
          <div className="flex h-10 w-full max-w-md items-center gap-2 rounded-lg bg-background px-3 sm:h-auto sm:py-1.5">
            <FilterSearchIcon icon={<SearchIcon className="size-4" />} />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder={d.searchPlaceholder}
              aria-label={d.searchPlaceholder}
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
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
          {/* Le bouton de remise a zero occupe la rangee entiere sous `sm` :
              dans une grille de deux il se serait retrouve a cote d'un filtre,
              a la meme taille, alors qu'il ne filtre pas — il annule. */}
          <Link
            href={href("/admin/utilisateurs")}
            title={d.resetFilters}
            aria-label={d.resetFilters}
            className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground sm:size-9 sm:h-9"
          >
            <RotateCcwIcon className="size-4" />
            <span className="text-xs font-semibold sm:hidden">{d.resetFilters}</span>
          </Link>
        </div>
      </AutoFilterForm>

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
          <Table className={STACKED_ON_MOBILE}>
            <TableHeader>
              <TableRow>
                {/* Sept colonnes ne tiennent pas sur un telephone : la table
                    partait en defilement horizontal avec sa premiere colonne
                    figee, et l'etat d'un compte ne pouvait jamais etre lu en
                    meme temps que le bouton qui agit dessus.

                    Sous `md` la table devient une pile de rangees compactes
                    (`STACKED_ON_MOBILE`) : l'identite sur sa ligne, puis role,
                    conformite et etat en pastilles avec le geste au bout.
                    Seules les deux cellules de pur contexte portent encore
                    `max-lg:hidden` — la fiche les porte deja. La variante est
                    posee sur la cellule elle-meme : elle suit la colonne si
                    l'ordre change, ce qu'un rang numerote dans une feuille de
                    style ne ferait pas. */}
                <TableHead>{d.colUser}</TableHead>
                <TableHead>{d.colRole}</TableHead>
                <TableHead>{d.colCompliance}</TableHead>
                <TableHead className="max-lg:hidden">{d.colDetail}</TableHead>
                <TableHead>{d.colState}</TableHead>
                <TableHead className="text-right max-lg:hidden">{d.colRegistered}</TableHead>
                <TableHead className="text-right">{d.colActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isSelf = row.id === admin.userId;

                // Definies une fois, rendues deux fois : dans leur colonne a
                // partir de `md`, et repliees dans la cellule d'identite en
                // dessous. Deux blocs de JSX separes auraient diverge.
                const rolePill = (
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
                );

                const compliancePill =
                  row.role === "admin" ? (
                    // Pour un administrateur, cette colonne repete son role
                    // RBAC. Deux colonnes eloignees le supportent ; dans la
                    // rangee compacte les deux pastilles se touchent et se
                    // lisent comme un doublon — d'ou le retrait sous `md`.
                    <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-warning max-md:hidden">
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
                  );

                const statePill = row.deletion_requested_at ? (
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
                );

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

                    <TableCell>{rolePill}</TableCell>

                    <TableCell>{compliancePill}</TableCell>

                    <TableCell className="max-lg:hidden">
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

                    <TableCell>{statePill}</TableCell>

                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums max-lg:hidden">
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
                          className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:size-7"
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
 * dans un bloc sombre. Natif, donc aucun etat client — `AutoFilterForm` porte
 * la valeur dans l'URL des qu'elle change.
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
    <label className="flex h-10 min-w-0 items-center gap-1.5 rounded-lg bg-background px-2.5 sm:h-auto sm:py-1.5">
      <span className="micro-label shrink-0 text-muted-foreground">{name_}</span>
      {/* `min-w-0` sur les deux : dans une case de grille, un `<select>` porte
          une largeur intrinseque issue de sa plus longue option et deborde de
          sa colonne au lieu de s'y ajuster. */}
      <select
        name={name}
        defaultValue={value ?? ""}
        className="min-w-0 flex-1 cursor-pointer bg-transparent pr-1 text-xs font-semibold text-foreground outline-none sm:flex-none"
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
