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
import { formatDate, formatNumber } from "@/lib/format";
import { suspendUser } from "@/lib/actions/moderation";
import { ACCOUNT_STATUS, ROLE, entry, label, options } from "@/lib/labels";
import { listUsers, USERS_PAGE_SIZE } from "@/lib/queries/users";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/utilisateurs">) {
  const admin = await requirePermission("users.read");
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
    const { data: assignments } = await supabase
      .from("admin_user_roles")
      .select("admin_id, role_id")
      .in("admin_id", adminIds);
    const roleIds = [...new Set((assignments ?? []).map((row) => row.role_id))];
    if (roleIds.length) {
      const { data: roles } = await supabase
        .from("admin_roles")
        .select("id, label")
        .in("id", roleIds);
      const labelById = new Map((roles ?? []).map((row) => [row.id, row.label as string]));
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
        breadcrumb={[{ label: "Utilisateurs et validations" }, { label: "Comptes" }]}
        title="Annuaire des comptes & utilisateurs"
        meta={
          <HeaderMeta tone="brand" dot>
            {formatNumber(allCount)} comptes enregistres
          </HeaderMeta>
        }
        description="Gestion centrale des profils Ifriqiya Star : consultation, affectation, moderation statutaire et tracabilite d'activite. Ouvrir une fiche donne acces a la modification, la suspension, la reactivation et la suppression."
        actions={
          // Un seul bouton : l'export existe. Pas de « Creer un compte » —
          // l'inscription passe par l'application mobile, aucun fournisseur
          // d'email d'invitation n'est configure, et l'attribution d'un role
          // administrateur se fait en SQL depuis la migration 202608240006.
          <Link
            href={`/admin/utilisateurs/export${exportQuery.size ? `?${exportQuery}` : ""}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold hover:bg-accent/70"
          >
            <DownloadIcon className="size-4" />
            Exporter CSV
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          label="Total comptes"
          value={formatNumber(allCount)}
          qualifier={
            allCount ? `${Math.round(((activeAccounts.count ?? 0) / allCount) * 100)} % actifs` : undefined
          }
          share={allCount ? (activeAccounts.count ?? 0) / allCount : undefined}
          icon={UsersIcon}
        />
        <KpiTile
          label="Joueurs"
          value={formatNumber(playerCount)}
          qualifier={allCount ? `${Math.round((playerCount / allCount) * 100)} % de la base` : undefined}
          share={allCount ? playerCount / allCount : undefined}
          icon={UserRoundIcon}
          accent="secondary"
        />
        <KpiTile
          label="Scouts & clubs"
          value={formatNumber(proCount)}
          qualifier={allCount ? `${Math.round((proCount / allCount) * 100)} % de la base` : undefined}
          share={allCount ? proCount / allCount : undefined}
          icon={ShieldCheckIcon}
          accent="secondary"
        />
        <KpiTile
          label="Pieces d'identite validees"
          value={
            playersWithProfile
              ? `${Math.round((Math.min(kycCount, playersWithProfile) / playersWithProfile) * 100)} %`
              : "—"
          }
          qualifier={`${formatNumber(kycCount)} / ${formatNumber(playersWithProfile)} joueurs`}
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
              placeholder="Filtrer par nom, email ou telephone…"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            <kbd className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
              Entree
            </kbd>
          </div>
          <button
            type="submit"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-muted px-3 text-xs font-semibold hover:bg-accent"
          >
            <SlidersHorizontalIcon className="size-3.5" />
            Appliquer
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Selector name="role" label="Type" value={params.role} options={options(ROLE)} all="Tous" />
          <Selector
            name="statut"
            label="Statut"
            value={params.statut}
            options={options(ACCOUNT_STATUS)}
            all="Tous"
          />
          <Selector
            name="actif"
            label="Etat"
            value={params.actif}
            options={[
              { value: "oui", label: "Actif uniquement" },
              { value: "non", label: "Desactive" },
            ]}
            all="Actif (tous)"
          />
          <Selector
            name="suppression"
            label="Suppression"
            value={params.suppression}
            options={[{ value: "oui", label: "Demande en cours" }]}
            all="Toutes"
          />
          <Link
            href="/admin/utilisateurs"
            title="Reinitialiser les filtres"
            aria-label="Reinitialiser les filtres"
            className="inline-flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCcwIcon className="size-4" />
          </Link>
        </div>
      </form>

      <Panel>
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
                <TableHead>Utilisateur &amp; contact</TableHead>
                <TableHead>Role / profil</TableHead>
                <TableHead>Conformite</TableHead>
                <TableHead>Detail &amp; affectation</TableHead>
                <TableHead>Etat compte</TableHead>
                <TableHead className="text-right">Inscrit le</TableHead>
                <TableHead className="text-right">Actions operationnelles</TableHead>
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
                          href={`/admin/utilisateurs/${row.id}`}
                        />
                        {isSelf ? (
                          <span className="micro-label shrink-0 rounded bg-warning/20 px-1.5 py-0.5 text-warning">
                            Moi
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
                        {label(ROLE, row.role)}
                      </span>
                    </TableCell>

                    <TableCell>
                      {row.role === "admin" ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-warning">
                          <ShieldCheckIcon className="size-3" />
                          {adminRoleById.get(row.id) ?? "Administrateur"}
                        </span>
                      ) : row.businessStatus ? (
                        <StatusPill tone={entry(ACCOUNT_STATUS, row.businessStatus).tone} dot>
                          {label(ACCOUNT_STATUS, row.businessStatus)}
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral" dot>
                          Non verifie
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
                          Acces back-office
                        </span>
                      ) : (
                        <span className="text-[0.6875rem] text-muted-foreground italic">
                          Profil standard
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      {row.deletion_requested_at ? (
                        <StatusPill tone="danger" dot>
                          Suppression demandee
                        </StatusPill>
                      ) : row.is_active ? (
                        <StatusPill tone="success" dot>
                          Actif
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral" dot>
                          Desactive
                        </StatusPill>
                      )}
                    </TableCell>

                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      {formatDate(row.created_at)}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/utilisateurs/${row.id}`}
                          title="Consulter la fiche"
                          aria-label={`Consulter la fiche de ${row.full_name || "ce compte"}`}
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
                            Votre compte
                          </span>
                        ) : row.is_active && !row.deletion_requested_at ? (
                          <ReasonDialog
                            action={suspendUser.bind(null, row.id)}
                            trigger={
                              <Button
                                variant="destructive"
                                size="xs"
                                aria-label={`Suspendre ${row.full_name || "ce compte"}`}
                              >
                                <BanIcon />
                                Suspendre
                              </Button>
                            }
                            title="Suspendre cet utilisateur"
                            description="Le profil metier passe a « suspendu » : au prochain demarrage, l'application deconnecte l'utilisateur. La session deja ouverte, elle, continue — c'est reversible depuis sa fiche."
                            placeholder="Comportement abusif, contenu inapproprie…"
                            submitLabel="Suspendre le compte"
                          />
                        ) : (
                          <Link
                            href={`/admin/utilisateurs/${row.id}`}
                            className="rounded bg-muted px-2 py-1 text-[0.6875rem] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            Ouvrir la fiche
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
          basePath="/admin/utilisateurs"
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
            title: "Suspendre n'est pas bannir",
            body: "Suspendre desactive le compte et passe son profil en « suspendu ». Rien ne touche l'authentification : la session deja ouverte continue jusqu'au redemarrage de l'application, qui lit alors le statut du profil et deconnecte l'utilisateur.",
          },
          {
            icon: BanIcon,
            title: "Reactiver ne revalide pas",
            body: "Un compte reactive repart en « en attente de validation », lui-meme bloquant : le dossier revient dans la file au lieu de retrouver l'acces au passage. La regle est appliquee par la base, pas par cet ecran.",
          },
          {
            icon: Trash2Icon,
            title: "Demande de suppression",
            body: "Une demande faite depuis l'application est seulement enregistree : elle n'efface rien. La suppression definitive reste un geste manuel depuis la fiche du compte — elle retire l'acces et les donnees, et elle est irreversible.",
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
