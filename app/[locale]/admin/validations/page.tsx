import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheckIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  FileTextIcon,
  FilterIcon,
  IdCardIcon,
  MessageSquareWarningIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TimerIcon,
  UserCheckIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { DetailDialog } from "@/components/admin/detail-dialog";
import { DocumentPreviewDialog } from "@/components/admin/document-preview-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { NoteCards } from "@/components/admin/note-cards";
import { HeaderMeta, PageHeader } from "@/components/admin/page-header";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { Pagination } from "@/components/admin/pagination";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { SegmentedNav } from "@/components/admin/segmented-nav";
import { ComplianceList, DossierRail } from "@/components/admin/dossier-rail";
import { DocumentFrame } from "@/components/admin/document-frame";
import { DossierDecision } from "@/components/admin/dossier-decision";
import { QueueBulkForm } from "@/components/admin/queue-bulk-form";
import { MetricStrip } from "@/components/admin/metric-strip";
import { StatusPill } from "@/components/admin/status-pill";
import {
  DocumentDossier,
  IdentityDossier,
  PlayerDossier,
  ProfessionalDossier,
  type ClubHistoryRow,
  type GuardianRow,
  type IdentityRow,
  type ProDocumentRow,
} from "@/components/admin/validation-dossier";
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
import {
  bulkValidatePlayers,
  setDocumentStatus,
  setIdentityStatus,
  setPlayerStatus,
  setProfessionalStatus,
} from "@/lib/actions/users";
import { ageFromBirthDate, formatDate, formatDateTime, formatDuration, timeAgo } from "@/lib/format";
import {
  DOCUMENT_STATUS,
  IDENTITY_STATUS,
  PLAYER_LEVEL,
  PROFESSIONAL_TYPE,
  entry,
  label,
} from "@/lib/labels";
import { fetchProfilesByIds, displayName } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Validations" };

const SEGMENTS = ["joueurs", "professionnels", "justificatifs", "identite"] as const;
type Segment = (typeof SEGMENTS)[number];
const PAGE_SIZE = 20;

export default async function ValidationsPage({
  searchParams,
}: PageProps<"/[locale]/admin/validations">) {
  await requirePermission("verifications.review");
  const resolved = await searchParams;
  const requested = typeof resolved.vue === "string" ? resolved.vue : "joueurs";
  const vue: Segment = (SEGMENTS as readonly string[]).includes(requested)
    ? (requested as Segment)
    : "joueurs";
  const page = Math.max(1, Number(typeof resolved.page === "string" ? resolved.page : 1) || 1);
  // Dossier ouvert dans la colonne de droite. Absent = la premiere ligne de la
  // file, pour que l'ecran ne s'ouvre jamais sur une colonne vide.
  const selected = typeof resolved.dossier === "string" ? resolved.dossier : undefined;
  const search =
    typeof resolved.q === "string" && resolved.q.trim() ? resolved.q.trim() : undefined;

  const supabase = await createClient();

  // Compteurs des quatre files, toujours affiches pour qu'on voie ce qui reste
  // a traiter ailleurs sans changer d'onglet.
  // Fenetre de 30 jours pour les deux compteurs de decisions. `new Date()`
  // plutot que `Date.now()` : la regle de purete de React interdit le second
  // pendant un rendu.
  const window30d = new Date();
  window30d.setDate(window30d.getDate() - 30);
  const since30d = window30d.toISOString();
  const [playersCount, prosCount, docsCount, kycCount, approved30d, refused30d] =
    await Promise.all([
    supabase
      .from("player_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente_validation"),
    supabase
      .from("professional_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente_validation"),
    supabase
      .from("professional_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente"),
    supabase
      .from("identity_verifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente"),
    // Decisions des 30 derniers jours : `status_updated_at` est ecrit par le
    // trigger de changement de statut, c'est donc la date de la decision, pas
    // celle du dossier.
    supabase
      .from("player_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "valide")
      .gte("status_updated_at", since30d),
    supabase
      .from("player_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "refuse")
      .gte("status_updated_at", since30d),
  ]);

  // Delai moyen entre le depot d'une piece d'identite et sa revue, sur les 200
  // dernieres revues. Calcule a partir des deux horodatages reels ; « — » tant
  // qu'aucune piece n'a ete revue, plutot qu'un chiffre invente.
  const { data: reviewed } = await supabase
    .from("identity_verifications")
    .select("created_at, reviewed_at")
    .not("reviewed_at", "is", null)
    .order("reviewed_at", { ascending: false })
    .limit(200);
  const delays = (reviewed ?? [])
    .map((row) => new Date(row.reviewed_at!).getTime() - new Date(row.created_at).getTime())
    .filter((value) => Number.isFinite(value) && value >= 0);
  const reviewDelay = delays.length
    ? formatDuration(delays.reduce((acc, value) => acc + value, 0) / delays.length)
    : null;

  const decisions30d = (approved30d.count ?? 0) + (refused30d.count ?? 0);
  const pending =
    (playersCount.count ?? 0) +
    (prosCount.count ?? 0) +
    (docsCount.count ?? 0) +
    (kycCount.count ?? 0);

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Utilisateurs et validations", href: "/admin/utilisateurs" },
          { label: "Validations" },
        ]}
        title="Files de validation des profils"
        meta={
          pending > 0 ? (
            <HeaderMeta tone="brand" dot>
              {pending} en attente
            </HeaderMeta>
          ) : (
            <HeaderMeta>File vide</HeaderMeta>
          )
        }
        actions={
          // Les dossiers arrivent de l'application mobile : la file peut se
          // remplir pendant qu'on la lit. Pas de « Synchroniser KYC » — il n'y
          // a aucun service externe a appeler, le statut est deja en base.
          <Link
            href={`/admin/validations?vue=${vue}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold hover:bg-accent/70"
          >
            <RefreshCwIcon className="size-3.5 text-brand" />
            Actualiser la file
          </Link>
        }
        description="Les comptes en attente, dans l'ordre d'arrivee. Valider un profil joueur ou professionnel debloque l'acces a l'application : c'est le statut du profil qui l'ouvre, pas celui du document d'identite."
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricStrip
          label="Delai moyen d'examen"
          value={reviewDelay ?? "—"}
          hint="Entre le depot d'une piece et sa revue"
          icon={TimerIcon}
        />
        <MetricStrip
          label="Dossiers en attente"
          value={pending}
          hint="Les quatre files reunies"
          icon={ClockIcon}
          tone="brand"
        />
        <MetricStrip
          label="Refuses (30 j)"
          value={refused30d.count ?? 0}
          hint="Profils joueurs renvoyes avec un motif"
          icon={ShieldAlertIcon}
          tone="danger"
        />
        <MetricStrip
          label="Taux d'approbation"
          value={
            decisions30d > 0
              ? `${Math.round(((approved30d.count ?? 0) / decisions30d) * 100)} %`
              : "—"
          }
          hint={`Sur ${decisions30d} decision(s) des 30 derniers jours`}
          icon={BadgeCheckIcon}
          tone="info"
        />
      </section>

      <SegmentedNav
        basePath="/admin/validations"
        active={vue}
        segments={[
          {
            value: "joueurs",
            label: "Profils joueurs",
            count: playersCount.count ?? 0,
            icon: UserCheckIcon,
          },
          {
            value: "professionnels",
            label: "Comptes professionnels",
            count: prosCount.count ?? 0,
            icon: ShieldCheckIcon,
          },
          {
            value: "justificatifs",
            label: "Justificatifs pro",
            count: docsCount.count ?? 0,
            icon: FileTextIcon,
          },
          {
            value: "identite",
            label: "Pieces d'identite",
            count: kycCount.count ?? 0,
            icon: IdCardIcon,
          },
        ]}
      />

      {/* Bande de filtres : un formulaire GET, donc la recherche vit dans
          l'URL comme le reste de l'ecran et la page reste un Server Component.
          Aucun filtre « score IA » ou « federation » : ces donnees n'existent
          pas dans le schema. */}
      <form
        method="get"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-2.5"
      >
        <input type="hidden" name="vue" value={vue} />
        <div className="flex min-w-72 flex-1 items-center gap-2 rounded-lg bg-background px-3 py-1.5">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            name="q"
            defaultValue={search ?? ""}
            placeholder="Filtrer par nom, club ou nationalite…"
            className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search ? (
            <Link
              href={`/admin/validations?vue=${vue}`}
              aria-label="Effacer le filtre"
              className="text-muted-foreground hover:text-foreground"
            >
              <XCircleIcon className="size-4" />
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold hover:bg-accent/70"
          >
            <FilterIcon className="size-3.5" />
            Appliquer
          </button>
          <span className="micro-label text-muted-foreground">
            Trie par : plus ancien d&apos;abord
          </span>
        </div>
      </form>

      {vue === "joueurs" ? (
        <PlayersQueue page={page} selected={selected} search={search} />
      ) : null}
      {vue === "professionnels" ? (
        <ProfessionalsQueue page={page} selected={selected} search={search} />
      ) : null}
      {vue === "justificatifs" ? <DocumentsQueue page={page} /> : null}
      {vue === "identite" ? <IdentityQueue page={page} /> : null}

      <NoteCards
        notes={[
          {
            icon: SmartphoneIcon,
            title: "Ce que la validation debloque",
            body: "L'application mobile decide de laisser entrer un utilisateur sur le statut de son profil — joueur ou professionnel — et sur rien d'autre. Tant que ce profil n'est pas valide, elle le renvoie vers l'ecran d'attente, quel que soit l'etat de ses pieces.",
          },
          {
            icon: IdCardIcon,
            title: "Piece d'identite ≠ compte valide",
            body: "La revue d'une piece d'identite est un controle distinct de la validation du compte. Accepter la piece ne donne pas l'acces : les deux gestes sont volontairement separes, et refuser une piece demande un motif, transmis a l'interesse.",
          },
          {
            icon: BadgeCheckIcon,
            title: "Un refus reste reversible",
            body: "Un dossier refuse retourne a son auteur avec le motif ecrit ici. Il repasse dans cette file des qu'il est corrige : rien n'est efface, et l'historique du statut reste lisible sur la fiche du compte.",
          },
        ]}
      />
    </>
  );
}

/** Identifiant impossible : evite un `in ()` invalide quand la file est vide. */
const EMPTY_ID = "00000000-0000-0000-0000-000000000000";

function groupBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const value = String(row[key]);
    grouped.set(value, [...(grouped.get(value) ?? []), row]);
  }
  return grouped;
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[key]);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/* ------------------------------------------------------------------ joueurs */

async function PlayersQueue({
  page,
  selected,
  search,
}: {
  page: number;
  selected?: string;
  search?: string;
}) {
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
    .order("updated_at", { ascending: true })
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
  // la premiere de la file — la plus ancienne, donc celle qui attend depuis le
  // plus longtemps.
  const active = rows.find((row) => row.id === selected) ?? rows[0];
  const activeProfile = active ? profiles.get(active.id) : undefined;
  const activeKyc = active ? kycByPlayer.get(active.id) : undefined;
  const activeGuardian = active ? guardianByPlayer.get(active.id) : undefined;
  const activeName = active
    ? displayName(activeProfile, [active.first_name, active.last_name])
    : "";
  const dossierHref = (id: string) =>
    `/admin/validations?vue=joueurs&page=${page}${search ? `&q=${encodeURIComponent(search)}` : ""}&dossier=${id}`;

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
    <div className="grid items-start gap-4 xl:grid-cols-12">
      <div className="flex flex-col gap-4 xl:col-span-8">
        <Panel className="overflow-hidden">
          <QueueBulkForm action={bulkValidatePlayers}>
            {error ? <QueueError message={error.message} /> : null}
            {!rows.length && !error ? (
              <EmptyState
                icon={UserCheckIcon}
                title="Aucun profil joueur en attente"
                description={
                  search
                    ? "Aucun dossier ne correspond a ce filtre."
                    : "Les nouveaux dossiers apparaitront ici des qu'un joueur aura termine son etape KYC."
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
                          aria-label="Tout selectionner"
                          className="size-3.5 accent-[var(--brand)]"
                        />
                        Joueur / candidat
                      </span>
                    </TableHead>
                    <TableHead>Categorie / poste</TableHead>
                    <TableHead>Piece &amp; dossier</TableHead>
                    <TableHead>Horodatage</TableHead>
                    <TableHead className="text-right">Decision rapide</TableHead>
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
                              aria-label={`Selectionner ${displayName(profile, [row.first_name, row.last_name])}`}
                              className="size-3.5 shrink-0 accent-[var(--brand)]"
                            />
                            <UserCell
                              name={displayName(profile, [row.first_name, row.last_name])}
                              secondary={profile?.email}
                              avatarUrl={profile?.avatar_url}
                              href={dossierHref(row.id)}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded bg-accent px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums">
                              {age ? `${age} ans` : "Age ?"}
                            </span>
                            {profile?.is_minor ? (
                              <StatusPill tone="warning">Mineur</StatusPill>
                            ) : null}
                            <span className="text-xs">{row.main_position ?? "Poste ?"}</span>
                          </div>
                          <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">
                            {row.current_club ??
                              (row.is_free_agent ? "Agent libre" : "Club non renseigne")}
                            {row.level ? ` · ${label(PLAYER_LEVEL, row.level)}` : ""}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {kyc ? (
                              <StatusPill tone={entry(IDENTITY_STATUS, kyc.status).tone}>
                                {label(IDENTITY_STATUS, kyc.status)}
                              </StatusPill>
                            ) : (
                              <StatusPill tone="neutral">Aucune piece</StatusPill>
                            )}
                            {kyc?.storage_path ? (
                              <DocumentPreviewDialog
                                url={`/admin/documents?bucket=identity-documents&path=${encodeURIComponent(kyc.storage_path)}`}
                                label="Piece d'identite"
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
                              {Math.round(ratio * 100)} % complet
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="block text-xs tabular-nums">
                            {formatDateTime(row.updated_at)}
                          </span>
                          <span className="text-[0.6875rem] text-muted-foreground">
                            {timeAgo(row.updated_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={dossierHref(row.id)}
                              aria-label="Inspecter le dossier"
                              title="Inspecter le dossier"
                              className="inline-flex size-7 items-center justify-center rounded-lg bg-accent text-foreground hover:bg-accent/70"
                            >
                              <EyeIcon className="size-4" />
                            </Link>
                            <ActionButton
                              action={setPlayerStatus.bind(null, row.id, "valide", undefined)}
                            >
                              <CheckIcon />
                              Valider
                            </ActionButton>
                            <ReasonDialog
                              action={setPlayerStatus.bind(null, row.id, "refuse")}
                              trigger={
                                <button
                                  type="button"
                                  aria-label="Rejeter ou demander un complement"
                                  title="Rejeter ou demander un complement"
                                  className="inline-flex size-7 items-center justify-center rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30"
                                >
                                  <XIcon className="size-4" />
                                </button>
                              }
                              title="Refuser ce profil joueur"
                              description="Le motif est enregistre sur le profil et sert d'explication au joueur."
                              placeholder="Piece d'identite illisible, informations incoherentes…"
                              submitLabel="Refuser le profil"
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
            basePath="/admin/validations"
            params={{ vue: "joueurs", q: search, page: String(page) }}
            page={page}
            pageSize={PAGE_SIZE}
            total={count ?? 0}
          />
        </Panel>
      </div>

      {active ? (
        <div className="flex flex-col gap-4 xl:col-span-4">
          <DossierRail
            reference={`Dossier actif · ${active.id.slice(0, 8)}`}
            title={`Inspection ${activeName}`}
            status={
              <StatusPill tone={activeKyc?.status === "valide" ? "success" : "warning"}>
                {activeKyc?.status === "valide" ? "Pret pour validation" : "Piece a controler"}
              </StatusPill>
            }
            actions={
              <DossierDecision
                approve={setPlayerStatus.bind(null, active.id, "valide", undefined)}
                requestChanges={setPlayerStatus.bind(null, active.id, "incomplet")}
                reject={setPlayerStatus.bind(null, active.id, "refuse")}
                approveLabel="Approuver et notifier le joueur"
              />
            }
            footnote="Des que le profil passe en « valide », l'application laisse entrer le joueur, et son profil devient visible des recruteurs si sa visibilite est activee. Accepter la piece d'identite ne suffit pas : ce sont deux gestes distincts."
          >
            {/* Apercu de la piece : URL signee cinq minutes par
                /admin/documents, jamais l'objet de stockage en clair. */}
            {activeKyc?.storage_path ? (
              <DocumentFrame
                url={`/admin/documents?bucket=identity-documents&path=${encodeURIComponent(activeKyc.storage_path)}`}
                label={`Piece d'identite — ${activeKyc.document_type.toUpperCase()}`}
                hint={activeKyc.facial_check_provider ?? undefined}
                className="[&>iframe]:h-44"
              />
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Aucune piece d&apos;identite deposee pour ce compte.
              </p>
            )}

            {/* Attributs lus en base, et eux seuls : ni numero de CIN ni date
                d'expiration, que le schema ne stocke pas. */}
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/50 p-3">
              <Attribute
                label="Type de piece"
                value={activeKyc ? activeKyc.document_type.toUpperCase() : "—"}
              />
              <Attribute
                label="Date de naissance"
                value={
                  active.birth_date
                    ? `${formatDate(active.birth_date)}${ageFromBirthDate(active.birth_date) ? ` (${ageFromBirthDate(active.birth_date)} ans)` : ""}`
                    : "—"
                }
              />
              <Attribute label="Nationalite" value={active.nationality ?? "—"} />
              <Attribute
                label="Club affilie"
                value={active.current_club ?? (active.is_free_agent ? "Agent libre" : "—")}
                tone="brand"
              />
            </div>

            <ComplianceList
              items={[
                {
                  label: "Piece d'identite deposee",
                  verdict: activeKyc ? label(IDENTITY_STATUS, activeKyc.status) : "Aucune",
                  tone: activeKyc
                    ? activeKyc.status === "valide"
                      ? "success"
                      : activeKyc.status === "refuse"
                        ? "danger"
                        : "warning"
                    : "neutral",
                },
                {
                  label: "Consentement du representant legal",
                  verdict: !activeProfile?.is_minor
                    ? "Non requis"
                    : activeGuardian?.consent_given
                      ? "Recu"
                      : "Manquant",
                  tone: !activeProfile?.is_minor
                    ? "neutral"
                    : activeGuardian?.consent_given
                      ? "success"
                      : "danger",
                },
                {
                  label: "Historique de club",
                  verdict: `${clubsByPlayer.get(active.id)?.length ?? 0} entree(s)`,
                  tone: (clubsByPlayer.get(active.id)?.length ?? 0) > 0 ? "success" : "neutral",
                },
                {
                  label: "Medias deposes",
                  verdict: `${videosByPlayer.get(active.id) ?? 0} video(s) · ${photosByPlayer.get(active.id) ?? 0} photo(s)`,
                  tone:
                    (videosByPlayer.get(active.id) ?? 0) + (photosByPlayer.get(active.id) ?? 0) > 0
                      ? "success"
                      : "neutral",
                },
                {
                  label: "Profil visible dans la recherche",
                  verdict: active.is_visible ? "Oui" : "Non",
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

async function ProfessionalsQueue({
  page,
  selected,
  search,
}: {
  page: number;
  selected?: string;
  search?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("professional_profiles")
    .select(
      "id, professional_type, organization_name, contact_full_name, position_title, country, city, status, status_reason, created_at, updated_at",
      { count: "exact" },
    )
    .eq("status", "en_attente_validation")
    .order("updated_at", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (search) {
    const term = search.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `contact_full_name.ilike.%${term}%,organization_name.ilike.%${term}%,city.ilike.%${term}%`,
      );
    }
  }

  const { data, error, count } = await query;
  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(rows.map((row) => row.id));

  // Toutes les pieces du compte, pas seulement celles en attente : une piece
  // deja refusee est justement ce qui doit retenir la main.
  const { data: documents } = await supabase
    .from("professional_documents")
    .select("id, professional_id, document_label, storage_path, status, created_at")
    .in("professional_id", rows.length ? rows.map((row) => row.id) : [EMPTY_ID]);

  const docsByPro = new Map<string, NonNullable<typeof documents>>();
  for (const document of documents ?? []) {
    const list = docsByPro.get(document.professional_id) ?? [];
    list.push(document);
    docsByPro.set(document.professional_id, list);
  }

  const active = rows.find((row) => row.id === selected) ?? rows[0];
  const activeProfile = active ? profiles.get(active.id) : undefined;
  const activeDocs = active ? (docsByPro.get(active.id) ?? []) : [];
  const dossierHref = (id: string) =>
    `/admin/validations?vue=professionnels&page=${page}${search ? `&q=${encodeURIComponent(search)}` : ""}&dossier=${id}`;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-12">
      <Panel className="xl:col-span-8">
        <PanelHeader
          icon={ShieldCheckIcon}
          title="Comptes professionnels en attente"
          description="Verifier les justificatifs avant de valider : un compte valide accede a la base joueurs. Ouvrir une ligne charge son dossier a droite."
        />
        {error ? <QueueError message={error.message} /> : null}
        {!rows.length && !error ? (
          <EmptyState
            icon={ShieldCheckIcon}
            title="Aucun compte professionnel en attente"
            description="Les dossiers arrivent ici apres l'upload des justificatifs professionnels."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Type / organisation</TableHead>
                <TableHead>Justificatifs</TableHead>
                <TableHead>Depose</TableHead>
                <TableHead className="text-right">Decision rapide</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const profile = profiles.get(row.id);
                const docs = docsByPro.get(row.id) ?? [];
                const isActive = active?.id === row.id;

                return (
                  <TableRow key={row.id} className={isActive ? "row-flagged" : undefined}>
                    <TableCell>
                      <UserCell
                        name={displayName(profile, [row.contact_full_name])}
                        secondary={profile?.email}
                        avatarUrl={profile?.avatar_url}
                        href={dossierHref(row.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusPill tone="info">
                        {label(PROFESSIONAL_TYPE, row.professional_type)}
                      </StatusPill>
                      <span className="mt-1 block max-w-48 truncate text-xs text-muted-foreground">
                        {row.organization_name ?? "Organisation non renseignee"}
                        {[row.city, row.country].filter(Boolean).length
                          ? ` · ${[row.city, row.country].filter(Boolean).join(", ")}`
                          : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      {docs.length ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {docs.map((document) => (
                            <DocumentPreviewDialog
                              key={document.id}
                              url={`/admin/documents?bucket=professional-documents&path=${encodeURIComponent(document.storage_path)}`}
                              label={document.document_label}
                            />
                          ))}
                        </div>
                      ) : (
                        <StatusPill tone="warning">Aucun document</StatusPill>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {timeAgo(row.updated_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <ActionButton
                          action={setProfessionalStatus.bind(null, row.id, "valide", undefined)}
                        >
                          <CheckIcon />
                          Valider
                        </ActionButton>
                        <ReasonDialog
                          action={setProfessionalStatus.bind(null, row.id, "refuse")}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Refuser ce compte">
                              <XIcon className="text-destructive" />
                            </Button>
                          }
                          title="Refuser ce compte professionnel"
                          description="Le motif est enregistre sur le compte et transmis au professionnel."
                          placeholder="Justificatif non conforme, structure non identifiee…"
                          submitLabel="Refuser le compte"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <Pagination
          basePath="/admin/validations"
          params={{ vue: "professionnels", q: search, page: String(page) }}
          page={page}
          pageSize={PAGE_SIZE}
          total={count ?? 0}
        />
      </Panel>

      {active ? (
        <DossierRail
          className="xl:col-span-4"
          reference={`Dossier actif · ${active.id.slice(0, 8)}`}
          title={active.organization_name ?? displayName(activeProfile, [active.contact_full_name])}
          status={
            <StatusPill tone={activeDocs.length ? "warning" : "danger"}>
              {activeDocs.length
                ? `${activeDocs.length} piece(s) a examiner`
                : "Aucune piece deposee"}
            </StatusPill>
          }
          actions={
            <>
              <ActionButton
                className="w-full justify-center"
                action={setProfessionalStatus.bind(null, active.id, "valide", undefined)}
              >
                <CheckIcon />
                Valider et notifier le compte
              </ActionButton>
              <div className="grid grid-cols-2 gap-2">
                <ReasonDialog
                  action={setProfessionalStatus.bind(null, active.id, "incomplet")}
                  trigger={
                    <Button variant="outline" size="xs" className="w-full">
                      <MessageSquareWarningIcon />
                      Demander une piece
                    </Button>
                  }
                  title="Demander des modifications"
                  description="Le compte repasse au statut incomplet et le professionnel recoit le motif a corriger."
                  placeholder="Justificatif ou information a corriger..."
                  submitLabel="Envoyer la demande"
                  destructive={false}
                />
                <ReasonDialog
                  action={setProfessionalStatus.bind(null, active.id, "refuse")}
                  trigger={
                    <Button variant="destructive" size="xs" className="w-full">
                      <XIcon />
                      Rejeter le compte
                    </Button>
                  }
                  title="Refuser ce compte professionnel"
                  description="Le motif est enregistre sur le compte et transmis au professionnel."
                  placeholder="Justificatif non conforme, structure non identifiee…"
                  submitLabel="Refuser le compte"
                />
              </div>
            </>
          }
          footnote="Un compte professionnel valide accede a la base joueurs et peut ouvrir un Scout Day. Valider la structure et valider ses pieces sont deux gestes distincts : le statut du compte est celui que lit l'application."
        >
          <ComplianceList
            items={[
              {
                label: "Justificatifs deposes",
                verdict: `${activeDocs.length} piece(s)`,
                tone: activeDocs.length ? "success" : "danger",
              },
              {
                label: "Piece refusee au dossier",
                verdict: activeDocs.some((doc) => doc.status === "refuse")
                  ? "Oui — a reexaminer"
                  : "Aucune",
                tone: activeDocs.some((doc) => doc.status === "refuse") ? "danger" : "success",
              },
              {
                label: "Organisation renseignee",
                verdict: active.organization_name ? "Oui" : "Manquante",
                tone: active.organization_name ? "success" : "warning",
              },
              {
                label: "Localisation",
                verdict: [active.city, active.country].filter(Boolean).join(", ") || "Non renseignee",
                tone: active.city || active.country ? "success" : "neutral",
              },
            ]}
          />

          <ProfessionalDossier
            pro={active}
            profile={activeProfile}
            documents={activeDocs as ProDocumentRow[]}
          />
        </DossierRail>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ justificatifs */

async function DocumentsQueue({ page }: { page: number }) {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("professional_documents")
    .select("id, professional_id, document_label, storage_path, status, created_at", { count: "exact" })
    .eq("status", "en_attente")
    .order("created_at", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(rows.map((row) => row.professional_id));
  const proIds = rows.length ? rows.map((row) => row.professional_id) : [EMPTY_ID];

  const [prosResult, siblingsResult] = await Promise.all([
    supabase
      .from("professional_profiles")
      .select("id, professional_type, organization_name, contact_full_name, position_title, status")
      .in("id", proIds),
    // Les autres pieces du meme compte : trancher une piece isolement, sans
    // voir ce qui a deja ete accepte ou refuse a cote, fait juger deux fois
    // le meme dossier de deux facons.
    supabase
      .from("professional_documents")
      .select("id, professional_id, document_label, storage_path, status, created_at")
      .in("professional_id", proIds),
  ]);

  const proById = new Map(
    (prosResult.data ?? []).map((row) => [row.id as string, row as Record<string, string | null>]),
  );
  const siblingsByPro = groupBy((siblingsResult.data ?? []) as ProDocumentRow[], "professional_id");

  return (
    <Panel>
      <PanelHeader
        title="Justificatifs professionnels a examiner"
        description="Statut par piece. Un compte peut rester en attente tant qu'une piece n'est pas tranchee."
      />
      {error ? <QueueError message={error.message} /> : null}
      {!rows.length && !error ? (
        <EmptyState
          icon={FileTextIcon}
          title="Aucun justificatif en attente"
          description="Toutes les pieces deposees ont ete examinees."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compte</TableHead>
              <TableHead>Piece</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Depose</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const profile = profiles.get(row.professional_id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={displayName(profile)}
                      secondary={profile?.email}
                      avatarUrl={profile?.avatar_url}
                      href={`/admin/utilisateurs/${row.professional_id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <DocumentPreviewDialog
                      url={`/admin/documents?bucket=professional-documents&path=${encodeURIComponent(row.storage_path)}`}
                      label={row.document_label}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={entry(DOCUMENT_STATUS, row.status).tone}>
                      {label(DOCUMENT_STATUS, row.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(row.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <DetailDialog
                        label="Dossier"
                        title={`Justificatif — ${row.document_label}`}
                        description="La piece, le compte qui l'a deposee, et les autres pieces du meme dossier."
                      >
                        <DocumentDossier
                          document={row as ProDocumentRow}
                          profile={profile}
                          pro={proById.get(row.professional_id)}
                          siblings={siblingsByPro.get(row.professional_id) ?? []}
                        />
                      </DetailDialog>
                      <ActionButton action={setDocumentStatus.bind(null, row.id, "valide")}>
                        <CheckIcon />
                        Valider
                      </ActionButton>
                      <ActionButton
                        variant="destructive"
                        action={setDocumentStatus.bind(null, row.id, "refuse")}
                      >
                        <XIcon />
                        Refuser
                      </ActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Pagination basePath="/admin/validations" params={{ vue: "justificatifs", page: String(page) }} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </Panel>
  );
}

/* ----------------------------------------------------------------- identite */

async function IdentityQueue({ page }: { page: number }) {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("identity_verifications")
    .select(
      "id, player_id, document_type, storage_path, status, facial_check_provider, facial_check_passed, rejection_reason, created_at",
      { count: "exact" },
    )
    .eq("status", "en_attente")
    .order("created_at", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(rows.map((row) => row.player_id));
  const playerIds = rows.length ? rows.map((row) => row.player_id) : [EMPTY_ID];

  // Ce que le joueur a **declare** : c'est avec cela que la piece doit
  // concorder, et l'ecran ne l'affichait pas — on validait un document sans
  // savoir quel nom ni quelle date de naissance il devait porter.
  const [playersResult, guardiansResult] = await Promise.all([
    supabase
      .from("player_profiles")
      .select("id, first_name, last_name, birth_date, nationality")
      .in("id", playerIds),
    supabase
      .from("legal_guardians")
      .select(
        "id, player_id, full_name, relationship, email, phone, id_document_storage_path, consent_document_storage_path, consent_given, consent_given_at, status",
      )
      .in("player_id", playerIds),
  ]);

  const playerById = new Map(
    (playersResult.data ?? []).map((row) => [
      row.id as string,
      row as Record<string, string | null>,
    ]),
  );
  const guardianByPlayer = new Map<string, GuardianRow>(
    (guardiansResult.data ?? []).map((row) => [row.player_id as string, row as GuardianRow]),
  );

  return (
    <Panel>
      <PanelHeader
        title="Pieces d'identite a examiner"
        description="Attention : cette file porte sur la revue des pieces d'identite, distincte du statut du profil joueur. Valider ici ne valide pas le compte — il faut aussi valider le profil dans la file « Profils joueurs »."
      />
      {error ? <QueueError message={error.message} /> : null}
      {!rows.length && !error ? (
        <EmptyState
          icon={ShieldCheckIcon}
          title="Aucune piece d'identite en attente"
          description="Les dossiers KYC deposes depuis l'application arriveront ici."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Joueur</TableHead>
              <TableHead>Type de piece</TableHead>
              <TableHead>Controle facial</TableHead>
              <TableHead>Depose</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const profile = profiles.get(row.player_id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={displayName(profile)}
                      secondary={profile?.email}
                      avatarUrl={profile?.avatar_url}
                      href={`/admin/utilisateurs/${row.player_id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <DocumentPreviewDialog
                      url={`/admin/documents?bucket=identity-documents&path=${encodeURIComponent(row.storage_path)}`}
                      label={row.document_type.toUpperCase()}
                    />
                  </TableCell>
                  <TableCell>
                    {row.facial_check_provider ? (
                      <StatusPill tone={row.facial_check_passed ? "success" : "danger"}>
                        {row.facial_check_passed ? "Reussi" : "Echoue"}
                      </StatusPill>
                    ) : (
                      <span className="text-xs text-muted-foreground">Non realise</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <DetailDialog
                        label="Dossier"
                        title={`Piece d'identite — ${displayName(profile)}`}
                        description="Le document et les informations declarees avec lesquelles il doit concorder."
                      >
                        <IdentityDossier
                          identity={row as IdentityRow}
                          profile={profile}
                          player={playerById.get(row.player_id)}
                          guardian={guardianByPlayer.get(row.player_id)}
                        />
                      </DetailDialog>
                      <ActionButton action={setIdentityStatus.bind(null, row.id, "valide", undefined)}>
                        <CheckIcon />
                        Valider la piece
                      </ActionButton>
                      <ReasonDialog
                        action={setIdentityStatus.bind(null, row.id, "refuse")}
                        trigger={
                          <Button variant="destructive" size="xs">
                            <XIcon />
                            Refuser
                          </Button>
                        }
                        title="Refuser cette piece d'identite"
                        description="Le motif est enregistre dans identity_verifications.rejection_reason."
                        placeholder="Document expire, photo floue…"
                        submitLabel="Refuser la piece"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Pagination basePath="/admin/validations" params={{ vue: "identite", page: String(page) }} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </Panel>
  );
}

function QueueError({ message }: { message: string }) {
  return (
    <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
      Lecture impossible : {message}
    </p>
  );
}
