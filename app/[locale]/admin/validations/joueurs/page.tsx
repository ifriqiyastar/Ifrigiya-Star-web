import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckIcon,
  EyeIcon,
  UserCheckIcon,
  XIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { DocumentFrame } from "@/components/admin/document-frame";
import { DocumentPreviewDialog } from "@/components/admin/document-preview-dialog";
import { DossierDecision } from "@/components/admin/dossier-decision";
import { ComplianceList, DossierRail } from "@/components/admin/dossier-rail";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel } from "@/components/admin/panel";
import { QueueBulkForm } from "@/components/admin/queue-bulk-form";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { PlayerDossier } from "@/components/admin/validation-dossier";
import { QueueError, ValidationFilter, ValidationMetrics, ValidationNotes } from "@/components/admin/validations/pieces";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bulkValidatePlayers, setPlayerStatus } from "@/lib/actions/users";
import { requirePermission } from "@/lib/auth";
import { ageFromBirthDate } from "@/lib/format";
import { getAdminI18n } from "@/lib/i18n/admin";
import { IDENTITY_STATUS, PLAYER_LEVEL } from "@/lib/labels";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { EMPTY_ID, PAGE_SIZE, countBy, groupBy } from "@/lib/queries/validations-shared";
import { createClient } from "@/lib/supabase/server";
import type { ClubHistoryRow, GuardianRow, IdentityRow } from "@/components/admin/validation-dossier";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Profils joueurs") };
}

export default async function ValidationsPlayersPage({
  searchParams,
}: PageProps<"/[locale]/admin/validations/joueurs">) {
  const i18n = await getAdminI18n();
  await requirePermission("verifications.review");

  const resolved = await searchParams;
  const page = Math.max(1, Number(resolved.page ?? 1) || 1);
  const selected = typeof resolved.dossier === "string" ? resolved.dossier : undefined;
  const search =
    typeof resolved.q === "string" && resolved.q.trim() ? resolved.q.trim() : undefined;
  const path = i18n.path("/admin/validations/joueurs");

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: i18n.t("Validations"), href: i18n.path("/admin/validations/joueurs") },
          { label: i18n.t("Profils joueurs") },
        ]}
        title={i18n.t("Profils joueurs a valider")}
        description={i18n.t("Les comptes joueurs en attente, du plus recent au plus ancien. Valider debloque l'acces a l'application : c'est le statut du profil qui l'ouvre, pas celui du document d'identite.")}
      />

      <ValidationMetrics />

      <ValidationFilter search={search} path={path} />

      <PlayersQueue page={page} selected={selected} search={search} />

      <ValidationNotes />
    </>
  );
}

async function PlayersQueue({
  page,
  selected,
  search,
}: {
  page: number;
  selected?: string;
  search?: string;
}) {
  const i18n = await getAdminI18n();

  const supabase = await createClient();
  // Toutes les colonnes, et non les six de la liste : le dossier complet est
  // rendu dans la modale de chaque ligne, et il ne doit pas declencher une
  // requete par ligne — `DetailDialog` construit ses enfants cote serveur.
  let query = supabase
    .from("player_profiles")
    .select(
      "id, first_name, last_name, birth_date, nationality, country, city, main_position, secondary_position, foot_preference, current_club, is_free_agent, height_cm, weight_kg, level, about, is_visible, status, status_reason, created_at, updated_at",
      { count: "exact" },
    )
    .eq("status", "en_attente_validation")
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  // Filtre texte : sur les colonnes du profil joueur uniquement. L'email vit
  // dans `profiles`, table jointe apres coup — le chercher ici demanderait une
  // sous-requete pour un gain nul sur une file de vingt lignes.
  if (search) {
    const term = search.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,current_club.ilike.%${term}%,nationality.ilike.%${term}%`,
      );
    }
  }

  const { data, error, count } = await query;
  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(rows.map((row) => row.id));
  const ids = rows.length ? rows.map((row) => row.id) : [EMPTY_ID];

  // Une requete par table, jamais une par ligne.
  const [verificationsResult, guardiansResult, clubsResult, videosResult, photosResult] =
    await Promise.all([
      // Etat du dossier KYC associe : sans lui, l'administrateur validerait a
      // l'aveugle un compte dont la piece d'identite est peut-etre refusee.
      supabase
        .from("identity_verifications")
        .select(
          "id, player_id, status, document_type, storage_path, facial_check_provider, facial_check_passed, rejection_reason, created_at",
        )
        .in("player_id", ids),
      // §4.2 : un mineur ne se valide pas sans le consentement d'un
      // representant legal. L'ecran ne le montrait nulle part.
      supabase
        .from("legal_guardians")
        .select(
          "id, player_id, full_name, relationship, email, phone, id_document_storage_path, consent_document_storage_path, consent_given, consent_given_at, status",
        )
        .in("player_id", ids),
      supabase
        .from("player_club_history")
        .select("id, player_id, club_name, start_date, end_date")
        .in("player_id", ids)
        .order("start_date", { ascending: false }),
      supabase.from("player_videos").select("id, player_id").in("player_id", ids),
      supabase.from("player_photos").select("id, player_id").in("player_id", ids),
    ]);

  const verifications = verificationsResult.data;
  const guardianByPlayer = new Map<string, GuardianRow>(
    (guardiansResult.data ?? []).map((row) => [row.player_id as string, row as GuardianRow]),
  );
  const clubsByPlayer = groupBy((clubsResult.data ?? []) as ClubHistoryRow[], "player_id");
  const videosByPlayer = countBy(videosResult.data ?? [], "player_id");
  const photosByPlayer = countBy(photosResult.data ?? [], "player_id");

  const kycByPlayer = new Map<string, NonNullable<typeof verifications>[number]>();
  for (const verification of verifications ?? []) {
    const current = kycByPlayer.get(verification.player_id);
    if (!current || verification.created_at > current.created_at) {
      kycByPlayer.set(verification.player_id, verification);
    }
  }

  // Ligne ouverte dans la colonne de droite : celle demandee par l'URL, sinon
  // la premiere de la file — la plus recente, toutes les listes du
  // back-office se lisant desormais du plus recent au plus ancien.
  const active = rows.find((row) => row.id === selected) ?? rows[0];
  const activeProfile = active ? profiles.get(active.id) : undefined;
  const activeKyc = active ? kycByPlayer.get(active.id) : undefined;
  const activeGuardian = active ? guardianByPlayer.get(active.id) : undefined;
  const activeName = active
    ? displayName(activeProfile, [active.first_name, active.last_name], i18n.locale)
    : "";
  const dossierHref = (id: string) =>
    i18n.path(`/admin/validations/joueurs?page=${page}${search ? `&q=${encodeURIComponent(search)}` : ""}&dossier=${id}`);

  /**
   * Completude du dossier : cinq elements que la validation suppose reunis.
   * La barre affichee dans la file en est la part remplie — c'est une somme de
   * champs presents, pas un score d'authenticite.
   */
  function completeness(row: (typeof rows)[number]) {
    const profile = profiles.get(row.id);
    const guardian = guardianByPlayer.get(row.id);
    const checks = [
      Boolean(kycByPlayer.get(row.id)),
      profile?.is_minor ? Boolean(guardian?.consent_given) : true,
      Boolean(row.current_club) || Boolean(row.is_free_agent),
      Boolean(row.main_position),
      (videosByPlayer.get(row.id) ?? 0) + (photosByPlayer.get(row.id) ?? 0) > 0,
    ];
    return checks.filter(Boolean).length / checks.length;
  }

  return (
    // ⚠️ PLUS DE GRILLE A DEUX COLONNES. La file porte une selection
    // multiple : ses cases a cocher, l'identite, le poste, la piece,
    // l'horodatage et les gestes rapides tenaient dans huit colonnes sur
    // douze, c'est-a-dire les deux tiers de la largeur utile. Le dossier
    // passe **sous** la file plutot qu'a cote — on choisit dans la file,
    // puis on lit le dossier.
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <Panel className="overflow-hidden">
          <QueueBulkForm action={bulkValidatePlayers}>
            {error ? <QueueError message={error.message} /> : null}
            {!rows.length && !error ? (
              <EmptyState
                icon={UserCheckIcon}
                title={i18n.t("Aucun profil joueur en attente")}
                description={
                  search
                    ? i18n.t("Aucun dossier ne correspond a ce filtre.")
                    : i18n.t("Les nouveaux dossiers apparaitront ici des qu'un joueur aura termine son etape KYC.")
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[34%]">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          data-select-all=""
                          aria-label={i18n.t("Tout selectionner")}
                          className="size-3.5 accent-[var(--brand)]"
                        />
                        {i18n.t("Joueur / candidat")}</span>
                    </TableHead>
                    <TableHead>{i18n.t("Categorie / poste")}</TableHead>
                    <TableHead>{i18n.t("Piece & dossier")}</TableHead>
                    <TableHead>{i18n.t("Horodatage")}</TableHead>
                    <TableHead className="text-right">{i18n.t("Decision rapide")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const profile = profiles.get(row.id);
                    const kyc = kycByPlayer.get(row.id);
                    const age = ageFromBirthDate(row.birth_date);
                    const isActive = active?.id === row.id;
                    const ratio = completeness(row);

                    return (
                      <TableRow key={row.id} className={isActive ? "row-flagged" : undefined}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              name="ids"
                              value={row.id}
                              aria-label={i18n.t("Selectionner {0}", { "0": displayName(profile, [row.first_name, row.last_name], i18n.locale) })}
                              className="size-3.5 shrink-0 accent-[var(--brand)]"
                            />
                            <UserCell
                              name={displayName(profile, [row.first_name, row.last_name], i18n.locale)}
                              secondary={profile?.email}
                              avatarUrl={profile?.avatar_url}
                              href={dossierHref(row.id)}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded bg-accent px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums">
                              {age ? i18n.t("{0} ans", { "0": age }) : i18n.t("Age ?")}
                            </span>
                            {profile?.is_minor ? (
                              <StatusPill tone="warning">{i18n.t("Mineur")}</StatusPill>
                            ) : null}
                            <span className="text-xs">{row.main_position ? i18n.labels.position(row.main_position) : i18n.t("Poste ?")}</span>
                          </div>
                          <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">
                            {row.current_club ??
                              (row.is_free_agent ? i18n.t("Agent libre") : i18n.t("Club non renseigne"))}
                            {row.level ? ` · ${i18n.labels.label(PLAYER_LEVEL, row.level)}` : ""}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {kyc ? (
                              <StatusPill tone={i18n.labels.entry(IDENTITY_STATUS, kyc.status).tone}>
                                {i18n.labels.label(IDENTITY_STATUS, kyc.status)}
                              </StatusPill>
                            ) : (
                              <StatusPill tone="neutral">{i18n.t("Aucune piece")}</StatusPill>
                            )}
                            {kyc?.storage_path ? (
                              <DocumentPreviewDialog
                                url={i18n.path(`/admin/documents?bucket=identity-documents&path=${encodeURIComponent(kyc.storage_path)}`)}
                                label={i18n.t("Piece d'identite")}
                                compact
                              />
                            ) : null}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-accent">
                              <span
                                className="block h-full rounded-full bg-brand"
                                style={{ width: `${Math.round(ratio * 100)}%` }}
                              />
                            </span>
                            <span className="text-[0.625rem] font-bold text-brand tabular-nums">
                              {Math.round(ratio * 100)}  {i18n.t("% complet")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="block text-xs tabular-nums">
                            {i18n.format.formatDateTime(row.updated_at)}
                          </span>
                          <span className="text-[0.6875rem] text-muted-foreground">
                            {i18n.format.timeAgo(row.updated_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={dossierHref(row.id)}
                              aria-label={i18n.t("Inspecter le dossier")}
                              title={i18n.t("Inspecter le dossier")}
                              className="inline-flex size-7 items-center justify-center rounded-lg bg-accent text-foreground hover:bg-accent/70"
                            >
                              <EyeIcon className="size-4" />
                            </Link>
                            <ActionButton
                              action={setPlayerStatus.bind(null, row.id, "valide", undefined)}
                            >
                              <CheckIcon />
                              {i18n.t("Valider")}</ActionButton>
                            <ReasonDialog
                              action={setPlayerStatus.bind(null, row.id, "refuse")}
                              trigger={
                                <button
                                  type="button"
                                  aria-label={i18n.t("Rejeter ou demander un complement")}
                                  title={i18n.t("Rejeter ou demander un complement")}
                                  className="inline-flex size-7 items-center justify-center rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30"
                                >
                                  <XIcon className="size-4" />
                                </button>
                              }
                              title={i18n.t("Refuser ce profil joueur")}
                              description={i18n.t("Le motif est enregistre sur le profil et sert d'explication au joueur.")}
                              placeholder={i18n.t("Piece d'identite illisible, informations incoherentes…")}
                              submitLabel={i18n.t("Refuser le profil")}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </QueueBulkForm>
          <Pagination
            basePath={i18n.path("/admin/validations/joueurs")}
            params={{ vue: "joueurs", q: search, page: String(page) }}
            page={page}
            pageSize={PAGE_SIZE}
            total={count ?? 0}
          />
        </Panel>
      </div>

      {active ? (
        <div className="flex flex-col gap-4">
          <DossierRail
            reference={i18n.t("Dossier actif · {0}", { "0": active.id.slice(0, 8) })}
            title={i18n.t("Inspection {0}", { "0": activeName })}
            status={
              <StatusPill tone={activeKyc?.status === "valide" ? "success" : "warning"}>
                {activeKyc?.status === "valide" ? i18n.t("Pret pour validation") : i18n.t("Piece a controler")}
              </StatusPill>
            }
            actions={
              <DossierDecision
                approve={setPlayerStatus.bind(null, active.id, "valide", undefined)}
                requestChanges={setPlayerStatus.bind(null, active.id, "incomplet")}
                reject={setPlayerStatus.bind(null, active.id, "refuse")}
                approveLabel={i18n.t("Approuver et notifier le joueur")}
              />
            }
            footnote={i18n.t("Des que le profil passe en « valide », l'application laisse entrer le joueur, et son profil devient visible des recruteurs si sa visibilite est activee. Accepter la piece d'identite ne suffit pas : ce sont deux gestes distincts.")}
          >
            {/* Apercu de la piece : URL signee cinq minutes par
                /admin/documents, jamais l'objet de stockage en clair. */}
            {activeKyc?.storage_path ? (
              <DocumentFrame
                url={i18n.path(`/admin/documents?bucket=identity-documents&path=${encodeURIComponent(activeKyc.storage_path)}`)}
                label={i18n.t("Piece d'identite — {0}", { "0": activeKyc.document_type.toUpperCase() })}
                hint={activeKyc.facial_check_provider ?? undefined}
                className="[&>iframe]:h-44"
              />
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                {i18n.t("Aucune piece d'identite deposee pour ce compte.")}</p>
            )}

            {/* Attributs lus en base, et eux seuls : ni numero de CIN ni date
                d'expiration, que le schema ne stocke pas. */}
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/50 p-3">
              <Attribute
                label={i18n.t("Type de piece")}
                value={activeKyc ? activeKyc.document_type.toUpperCase() : "—"}
              />
              <Attribute
                label={i18n.t("Date de naissance")}
                value={
                  active.birth_date
                    ? `${i18n.format.formatDate(active.birth_date)}${ageFromBirthDate(active.birth_date) ? i18n.t(" ({0} ans)", { "0": ageFromBirthDate(active.birth_date) }) : ""}`
                    : "—"
                }
              />
              <Attribute label={i18n.t("Nationalite")} value={active.nationality ?? "—"} />
              <Attribute
                label={i18n.t("Club affilie")}
                value={active.current_club ?? (active.is_free_agent ? i18n.t("Agent libre") : "—")}
                tone="brand"
              />
            </div>

            <ComplianceList
              items={[
                {
                  label: i18n.t("Piece d'identite deposee"),
                  verdict: activeKyc ? i18n.labels.label(IDENTITY_STATUS, activeKyc.status) : i18n.t("Aucune"),
                  tone: activeKyc
                    ? activeKyc.status === "valide"
                      ? "success"
                      : activeKyc.status === "refuse"
                        ? "danger"
                        : "warning"
                    : "neutral",
                },
                {
                  label: i18n.t("Consentement du representant legal"),
                  verdict: !activeProfile?.is_minor
                    ? i18n.t("Non requis")
                    : activeGuardian?.consent_given
                      ? i18n.t("Recu")
                      : i18n.t("Manquant"),
                  tone: !activeProfile?.is_minor
                    ? "neutral"
                    : activeGuardian?.consent_given
                      ? "success"
                      : "danger",
                },
                {
                  label: i18n.t("Historique de club"),
                  verdict: i18n.t("{0} entree(s)", { "0": clubsByPlayer.get(active.id)?.length ?? 0 }),
                  tone: (clubsByPlayer.get(active.id)?.length ?? 0) > 0 ? "success" : "neutral",
                },
                {
                  label: i18n.t("Medias deposes"),
                  verdict: i18n.t("{0} video(s) · {1} photo(s)", { "0": videosByPlayer.get(active.id) ?? 0, "1": photosByPlayer.get(active.id) ?? 0 }),
                  tone:
                    (videosByPlayer.get(active.id) ?? 0) + (photosByPlayer.get(active.id) ?? 0) > 0
                      ? "success"
                      : "neutral",
                },
                {
                  label: i18n.t("Profil visible dans la recherche"),
                  verdict: active.is_visible ? i18n.t("Oui") : i18n.t("Non"),
                  tone: active.is_visible ? "success" : "neutral",
                },
              ]}
            />

            <PlayerDossier
              player={active}
              profile={activeProfile}
              identity={activeKyc as IdentityRow | undefined}
              guardian={activeGuardian}
              clubs={clubsByPlayer.get(active.id) ?? []}
              mediaCounts={{
                videos: videosByPlayer.get(active.id) ?? 0,
                photos: photosByPlayer.get(active.id) ?? 0,
              }}
            />
          </DossierRail>
        </div>
      ) : null}
    </div>
  );
}

/** Une paire intitule / valeur du bloc d'attributs du dossier actif. */
function Attribute({
  label: name,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "brand";
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="micro-label truncate text-muted-foreground">{name}</span>
      <span
        className={`mt-0.5 truncate text-xs font-semibold ${tone === "brand" ? "text-brand" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

/* ----------------------------------------------------------- professionnels */

