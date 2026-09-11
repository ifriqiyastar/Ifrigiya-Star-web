import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ActivityIcon,
  ArrowLeftIcon,
  BanIcon,
  BriefcaseIcon,
  HistoryIcon,
  InfoIcon,
  CheckIcon,
  CreditCardIcon,
  FileTextIcon,
  ImageIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import { AccountActions } from "@/components/admin/account-actions";
import { ActionButton } from "@/components/admin/action-button";
import { DefinitionList } from "@/components/admin/definition-list";
import { DocumentPreviewDialog } from "@/components/admin/document-preview-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { MediaPreviewDialog } from "@/components/admin/media-preview-dialog";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { SegmentedNav } from "@/components/admin/segmented-nav";
import { StatCard } from "@/components/admin/stat-card";
import { StatusPill } from "@/components/admin/status-pill";
import { createClient } from "@/lib/supabase/server";
import { ProfileCoreForm } from "@/components/admin/forms/profile-core-form";
import { PlayerProfileForm } from "@/components/admin/forms/player-profile-form";
import { ProfessionalProfileForm } from "@/components/admin/forms/professional-profile-form";
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
  deletePlayerPhoto,
  deletePlayerVideo,
} from "@/lib/actions/moderation";
import {
  setDocumentStatus,
  setIdentityStatus,
  updatePlayerProfile,
  updateProfessionalProfile,
  updateProfileCore,
} from "@/lib/actions/users";
import { activatePaymentManually, setSubscriptionStatus } from "@/lib/actions/finances";
import { requirePermission } from "@/lib/auth";
import {
  ageFromBirthDate,
  formatAmount,
  formatDate,
  formatDateTime,
  formatNumber,
  initials,
  timeAgo,
} from "@/lib/format";
import {
  ACCOUNT_STATUS,
  DOCUMENT_STATUS,
  FOOT_PREFERENCE,
  IDENTITY_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  PLAN_CODE,
  PLAYER_LEVEL,
  REGISTRATION_STATUS,
  ROLE,
  SUBSCRIPTION_STATUS,
  entry,
  label,
} from "@/lib/labels";
import {
  getUserContent,
  getUserDetail,
  getUserDossier,
  getUserFinances,
} from "@/lib/queries/user-detail";
import { privateStorageUrl, publicStorageUrl } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Fiche compte" };

const VUES = ["fiche", "dossier", "contenus", "finances"] as const;
type Vue = (typeof VUES)[number];

export default async function UserDetailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/utilisateurs/[id]">) {
  const [{ id }, resolvedSearch, admin] = await Promise.all([
    params,
    searchParams,
    requirePermission("users.read"),
  ]);

  const detail = await getUserDetail(id);
  if (!detail) notFound();

  const { profile, player, professional } = detail;
  const requested = typeof resolvedSearch.vue === "string" ? resolvedSearch.vue : "fiche";
  const vue: Vue = (VUES as readonly string[]).includes(requested) ? (requested as Vue) : "fiche";

  const businessStatus = (player?.status ?? professional?.status ?? null) as string | null;
  const statusReason = (player?.status_reason ?? professional?.status_reason ?? null) as
    | string
    | null;
  // Comptes des onglets et deux mesures reelles pour l'entete. Tout est
  // compte, jamais estime : pas de « score DTN » ni de « note globale »
  // inventes — la note affichee est la moyenne des evaluations reellement
  // publiees pour ce joueur.
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [identityDocs, proDocs, guardians, videos, photos, registrations] = await Promise.all([
    supabase.from("identity_verifications").select("id", head).eq("player_id", id),
    supabase.from("professional_documents").select("id", head).eq("professional_id", id),
    supabase.from("legal_guardians").select("id", head).eq("player_id", id),
    supabase.from("player_videos").select("id", head).eq("player_id", id),
    supabase.from("player_photos").select("id", head).eq("player_id", id),
    supabase.from("scout_day_registrations").select("id").eq("player_id", id).limit(500),
  ]);

  const registrationIds = ((registrations.data ?? []) as { id: string }[]).map((row) => row.id);
  const { data: evaluations } = registrationIds.length
    ? await supabase
        .from("scout_evaluations")
        .select("overall_score")
        .in("registration_id", registrationIds)
    : { data: [] as { overall_score: number | null }[] };
  const scores = ((evaluations ?? []) as { overall_score: number | null }[])
    .map((row) => Number(row.overall_score))
    .filter((value: number) => Number.isFinite(value));
  const averageScore = scores.length
    ? Math.round((scores.reduce((acc: number, value: number) => acc + value, 0) / scores.length) * 10) /
      10
    : null;

  const dossierCount =
    (identityDocs.count ?? 0) + (proDocs.count ?? 0) + (guardians.count ?? 0);
  const mediaCount = (videos.count ?? 0) + (photos.count ?? 0);

  /**
   * Completion du profil : la part des champs renseignes parmi ceux que
   * l'application attend pour ce role. La liste est explicite, donc le
   * pourcentage se verifie a l'oeil — ce n'est pas une note de qualite.
   */
  const completionFields = player
    ? [
        player.first_name,
        player.last_name,
        player.birth_date,
        player.nationality,
        player.country,
        player.city,
        player.main_position,
        player.foot_preference,
        player.height_cm,
        player.weight_kg,
        player.level,
        player.current_club ?? (player.is_free_agent ? "libre" : null),
        player.about,
      ]
    : professional
      ? [
          professional.organization_name,
          professional.contact_full_name,
          professional.position_title,
          professional.country,
          professional.city,
          profile.phone,
        ]
      : [profile.full_name, profile.email, profile.phone];
  const completion = Math.round(
    (completionFields.filter((value) => value !== null && value !== undefined && value !== "")
      .length /
      completionFields.length) *
      100,
  );

  // La photo vient des tables metier (cf. fetchProfilesByIds) : `profiles`
  // n'a pas de colonne avatar sur ce projet.
  const avatarUrl =
    ((player?.profile_photo_url ?? professional?.photo_url) as string | null) ?? null;
  const contextLine =
    (player?.current_club as string | null) ??
    (professional?.organization_name as string | null) ??
    (player?.main_position as string | null) ??
    null;

  const displayName =
    profile.full_name?.trim() ||
    [player?.first_name, player?.last_name].filter(Boolean).join(" ") ||
    (professional?.contact_full_name as string | undefined) ||
    profile.email ||
    "Compte sans nom";

  const roleTone =
    profile.role === "player" ? "brand" : profile.role === "professional" ? "info" : "warning";

  return (
    <>
      {/* Barre de retour et de contexte, comme la maquette : d'ou l'on vient,
          quel type de compte, et la mesure qui situe la fiche. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/utilisateurs"
            className="micro-label inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-brand"
          >
            <ArrowLeftIcon className="size-3.5" />
            Tous les comptes
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="micro-label rounded bg-muted px-2 py-0.5 text-brand">
            {label(ROLE, profile.role)}
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span className="max-w-64 truncate text-xs font-semibold">{displayName}</span>
        </nav>
        <span className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <span className="micro-label text-muted-foreground">Completion du profil</span>
          <span className="font-heading text-sm font-bold text-brand tabular-nums">
            {completion} %
          </span>
        </span>
      </div>

      {/* Carte d'identite : avatar, nom, etats, ligne de contexte, mesures, et
          les gestes d'administration dans le meme bloc. */}
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            {profile.role === "player" || profile.role === "professional" ? (
              <IdentityAvatar name={displayName} url={avatarUrl} />
            ) : (
              <IdentityAvatar name={displayName} url={null} />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading truncate text-2xl leading-tight font-extrabold tracking-tight">
                  {displayName}
                </h1>
                <StatusPill tone={roleTone}>{label(ROLE, profile.role)}</StatusPill>
                {businessStatus ? (
                  <StatusPill tone={entry(ACCOUNT_STATUS, businessStatus).tone}>
                    {label(ACCOUNT_STATUS, businessStatus)}
                  </StatusPill>
                ) : null}
                {profile.is_active ? (
                  <StatusPill tone="success" dot>
                    Actif
                  </StatusPill>
                ) : (
                  <StatusPill tone="neutral" dot>
                    Desactive
                  </StatusPill>
                )}
                {profile.is_minor ? <StatusPill tone="warning">Mineur</StatusPill> : null}
                {profile.deletion_requested_at ? (
                  <StatusPill tone="danger">Suppression demandee</StatusPill>
                ) : null}
                {player?.is_visible === false ? (
                  <StatusPill tone="neutral">Hors recherche</StatusPill>
                ) : null}
              </div>

              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono">#{profile.id.slice(0, 8)}</span>
                {profile.email ? (
                  <span className="truncate">{profile.email}</span>
                ) : null}
                {profile.phone ? <span className="tabular-nums">{profile.phone}</span> : null}
                {player?.birth_date ? (
                  <span>
                    {formatDate(player.birth_date as string)} (
                    {ageFromBirthDate(player.birth_date as string) ?? "—"} ans)
                  </span>
                ) : null}
                {contextLine ? <span className="text-foreground">{contextLine}</span> : null}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-6">
            <HeaderFigure
              label="Completion"
              value={`${completion} %`}
              hint="Champs renseignes"
            />
            {profile.role === "player" ? (
              <HeaderFigure
                label="Note moyenne"
                value={averageScore === null ? "—" : String(averageScore)}
                hint={
                  scores.length
                    ? `${scores.length} evaluation(s)`
                    : "Aucune evaluation"
                }
                tone="info"
              />
            ) : null}
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <AccountActions
            profileId={profile.id}
            role={profile.role}
            isActive={profile.is_active}
            businessStatus={businessStatus}
            isVisible={(player?.is_visible as boolean | undefined) ?? null}
            self={profile.id === admin.userId}
          />
          {statusReason ? (
            <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Motif enregistre :</span>{" "}
              {statusReason}
            </p>
          ) : null}
        </div>
      </Panel>

      <SegmentedNav
        basePath={`/admin/utilisateurs/${profile.id}`}
        active={vue}
        segments={[
          { value: "fiche", label: "Fiche & modification", icon: UserRoundIcon },
          {
            value: "dossier",
            label: "Dossier de validation",
            icon: ShieldCheckIcon,
            count: dossierCount,
          },
          {
            value: "contenus",
            label: "Medias du compte",
            icon: VideoIcon,
            count: mediaCount,
          },
          { value: "finances", label: "Abonnements & paiements", icon: CreditCardIcon },
        ]}
      />

      {vue === "fiche" ? (
        <div className="grid items-start gap-3 lg:grid-cols-12">
          {/* Colonne gauche : ce que la base enregistre seule, en lecture. */}
          <div className="flex flex-col gap-3 lg:col-span-5">
            <Panel className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 pb-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <HistoryIcon className="size-4 text-brand" />
                  Activite du compte
                </h2>
                <span className="micro-label text-muted-foreground">Lecture seule</span>
              </div>

              <p className="flex items-start gap-2 rounded-lg bg-background p-3 text-xs leading-relaxed text-muted-foreground">
                <InfoIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                Ces horodatages sont ecrits a l&apos;inscription ou par l&apos;application
                mobile : ils ne se modifient pas depuis le back-office.
              </p>

              <dl className="mt-3 flex flex-col gap-1.5">
                <ActivityRow label="Inscription" value={formatDateTime(profile.created_at)} />
                <ActivityRow
                  label="Derniere mise a jour"
                  value={formatDateTime(profile.updated_at)}
                />
                <ActivityRow
                  label="Derniere connexion"
                  value={formatDateTime(profile.last_login_at)}
                  pill={profile.last_login_at ? timeAgo(profile.last_login_at) : undefined}
                />
                <ActivityRow
                  label="CGU acceptees"
                  value={formatDateTime(profile.cgu_accepted_at)}
                />
                <ActivityRow
                  label="Confidentialite acceptee"
                  value={formatDateTime(profile.privacy_accepted_at)}
                />
                <ActivityRow label="Desactive le" value={formatDateTime(profile.deactivated_at)} />
                <ActivityRow
                  label="Suppression demandee le"
                  value={formatDateTime(profile.deletion_requested_at)}
                />
              </dl>
            </Panel>

            {player ? <PlayerFacts player={player} /> : null}
          </div>

          {/* Colonne droite : ce qui se modifie. */}
          <div className="flex flex-col gap-3 lg:col-span-7">
            <Panel>
              <PanelHeader
                icon={UserRoundIcon}
                title="Fiche compte & droits d'acces"
                description="Nom, contact, langue et role. Le role commande les droits dans toute l'application et sur l'application mobile."
              />
              <ProfileCoreForm
                values={{
                  full_name: profile.full_name,
                  email: profile.email,
                  phone: profile.phone,
                  locale: profile.locale,
                  role: profile.role,
                }}
                action={updateProfileCore.bind(null, profile.id)}
                canChangeRole={profile.id !== admin.userId}
              />
            </Panel>

            {player ? (
              <Panel>
                <PanelHeader
                  icon={ActivityIcon}
                  title="Profil sportif & caracteristiques"
                  description={`Age calcule : ${ageFromBirthDate(player.birth_date as string) ?? "—"} ans · Score de classement enregistre : ${player.ranking_score ?? 0}`}
                />
                <PlayerProfileForm
                  values={{
                    first_name: player.first_name as string | null,
                    last_name: player.last_name as string | null,
                    birth_date: player.birth_date as string | null,
                    nationality: player.nationality as string | null,
                    country: player.country as string | null,
                    city: player.city as string | null,
                    main_position: player.main_position as string | null,
                    secondary_position: player.secondary_position as string | null,
                    foot_preference: player.foot_preference as string | null,
                    current_club: player.current_club as string | null,
                    is_free_agent: Boolean(player.is_free_agent),
                    height_cm: player.height_cm as number | null,
                    weight_kg: player.weight_kg as number | null,
                    level: (player.level as string) ?? "amateur",
                    about: player.about as string | null,
                  }}
                  action={updatePlayerProfile.bind(null, profile.id)}
                />
              </Panel>
            ) : null}

            {professional ? (
              <Panel>
                <PanelHeader
                  icon={BriefcaseIcon}
                  title="Fiche professionnelle"
                  description="Type de compte, organisation et contact declares a l'inscription."
                />
                <ProfessionalProfileForm
                  values={{
                    professional_type: professional.professional_type as string,
                    organization_name: professional.organization_name as string | null,
                    contact_full_name: professional.contact_full_name as string | null,
                    position_title: professional.position_title as string | null,
                    country: professional.country as string | null,
                    city: professional.city as string | null,
                  }}
                  action={updateProfessionalProfile.bind(null, profile.id)}
                />
              </Panel>
            ) : null}
          </div>
        </div>
      ) : null}

      {vue === "dossier" ? <DossierView profileId={profile.id} role={profile.role} /> : null}
      {vue === "contenus" ? <ContentView profileId={profile.id} role={profile.role} /> : null}
      {vue === "finances" ? <FinancesView profileId={profile.id} role={profile.role} /> : null}
    </>
  );
}

/* --------------------------------------------------------------- profil joueur */

function PlayerFacts({ player }: { player: Record<string, unknown> }) {
  return (
    <Panel>
      <PanelHeader title="Donnees sportives en un coup d'oeil" />
      <div className="px-4 py-5 sm:px-5">
        <DefinitionList
          items={[
            { label: "Niveau", value: label(PLAYER_LEVEL, player.level as string) },
            { label: "Pied fort", value: label(FOOT_PREFERENCE, player.foot_preference as string) },
            { label: "Taille", value: player.height_cm ? `${player.height_cm} cm` : "—" },
            { label: "Poids", value: player.weight_kg ? `${player.weight_kg} kg` : "—" },
            { label: "Club actuel", value: (player.current_club as string) ?? "—" },
            { label: "Joueur libre", value: player.is_free_agent ? "Oui" : "Non" },
            {
              label: "Visible dans la recherche",
              value: player.is_visible ? "Oui" : "Non",
            },
            { label: "Score de classement", value: String(player.ranking_score ?? 0) },
          ]}
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------- dossier */

async function DossierView({ profileId, role }: { profileId: string; role: string }) {
  const { identity, guardians, documents } = await getUserDossier(profileId, role);

  return (
    <>
      {/* Bandeau de regle, en tete du dossier : c'est la confusion la plus
          couteuse de cet ecran, elle est donc ecrite avant les pieces. */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
          <InfoIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Piece d&apos;identite et compte sont decouples</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            La revue d&apos;une piece d&apos;identite est un controle distinct de la validation
            du compte. Accepter la piece atteste de l&apos;identite ; elle n&apos;ouvre ni
            l&apos;acces a l&apos;application ni la visibilite du joueur — c&apos;est la
            validation du profil qui le fait, depuis la file de validation ou l&apos;entete de
            cette fiche.
          </p>
        </div>
      </div>

      {role === "player" ? (
        <SectionTitle
          title="Verifications d'identite (KYC)"
          hint={`${identity.length} piece(s) au dossier`}
        />
      ) : null}

      {role === "player" ? (
        <Panel>
          <PanelHeader
            icon={ShieldCheckIcon}
            title="Pieces deposees"
            description="Chaque piece est affichee en place : la decision se prend en face du document, pas derriere un bouton."
          />
          {!identity.length ? (
            <EmptyState
              icon={FileTextIcon}
              title="Aucun dossier d'identite"
              description="Le joueur n'a pas encore soumis de piece d'identite."
            />
          ) : (
            /* Une carte par piece, avec le document **affiche en place**.
               C'etait un tableau ou la colonne « Piece » ne contenait qu'un
               bouton : on validait une identite sans avoir vu le scan, ou en
               l'ouvrant ailleurs. Ici le document est le sujet, pas une
               colonne parmi six — il occupe donc la carte, et la decision se
               prend juste au-dessus, en face de ce qu'on regarde. */
            <ul className="divide-y divide-border">
              {identity.map((row) => {
                const url = privateStorageUrl(
                  "identity-documents",
                  row.storage_path as string | null,
                );
                return (
                  <li key={String(row.id)} className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone="neutral">
                        {String(row.document_type ?? "Document").toUpperCase()}
                      </StatusPill>
                      <StatusPill tone={entry(IDENTITY_STATUS, row.status as string).tone}>
                        {label(IDENTITY_STATUS, row.status as string)}
                      </StatusPill>
                      {row.facial_check_provider ? (
                        <StatusPill tone={row.facial_check_passed ? "success" : "danger"}>
                          Controle facial {row.facial_check_passed ? "reussi" : "echoue"}
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral">Controle facial non realise</StatusPill>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Depose le {formatDate(row.created_at as string)}
                      </span>

                      <span className="flex-1" />

                      {/* Les gestes suivent le statut : proposer « Valider »
                          sur une piece deja valide, c'est offrir un bouton qui
                          ne fait rien, et laisser croire qu'il reste quelque
                          chose a decider. Meme regle que `AccountActions`. */}
                      <div className="flex flex-wrap items-center gap-2">
                        {row.reviewed_at ? (
                          <span className="text-xs text-muted-foreground">
                            Examine le {formatDate(row.reviewed_at as string)}
                          </span>
                        ) : null}

                        {row.status !== "valide" ? (
                          <ActionButton
                            action={setIdentityStatus.bind(
                              null,
                              String(row.id),
                              "valide",
                              undefined,
                            )}
                          >
                            <CheckIcon />
                            {row.status === "refuse" ? "Valider finalement" : "Valider"}
                          </ActionButton>
                        ) : null}

                        {row.status !== "refuse" ? (
                          <ReasonDialog
                            action={setIdentityStatus.bind(null, String(row.id), "refuse")}
                            trigger={
                              <Button variant="destructive" size="xs">
                                <XIcon />
                                {row.status === "valide" ? "Revoquer" : "Refuser"}
                              </Button>
                            }
                            title={
                              row.status === "valide"
                                ? "Revoquer cette piece d'identite"
                                : "Refuser cette piece d'identite"
                            }
                            description={
                              row.status === "valide"
                                ? "La piece repasse en « refuse » et le motif est enregistre dans rejection_reason. Le statut du profil joueur n'est pas touche : s'il doit perdre l'acces, suspendez le compte."
                                : "Le motif est enregistre sur la piece et transmis au joueur."
                            }
                            placeholder="Document expire, photo floue, nom non concordant…"
                            submitLabel={
                              row.status === "valide" ? "Revoquer la piece" : "Refuser la piece"
                            }
                          />
                        ) : null}
                      </div>
                    </div>

                    {row.rejection_reason ? (
                      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        Motif du refus : {row.rejection_reason as string}
                      </p>
                    ) : null}

                    {/* Apercu en **modale**, et non en cadre pose dans la
                        page : le document occupait la moitie de l'ecran en
                        permanence, alors qu'on ne le regarde qu'au moment de
                        trancher. Le bouton l'ouvre en grand quand on en a
                        besoin. */}
                    {url ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <DocumentPreviewDialog
                          url={url}
                          label={`Piece d'identite — ${String(row.document_type ?? "document").toUpperCase()}`}
                        />
                        <span className="text-xs text-muted-foreground">
                          Doit concorder avec le nom et la date de naissance declares.
                        </span>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                        Aucun fichier joint a cette verification : rien a examiner.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      ) : null}

      {role === "player" ? (
        <Panel>
          <PanelHeader
            icon={ShieldCheckIcon}
            title="Representant legal"
            description="Le CDC laisse le circuit de consentement des mineurs indefini : ces donnees sont affichees telles qu'elles ont ete saisies, sans workflow automatique."
          />
          {!guardians.length ? (
            <EmptyState
              icon={FileTextIcon}
              title="Aucun representant declare"
              description="Requis en base des lors que le joueur est mineur."
            />
          ) : (
            <div className="space-y-5 px-4 py-5 sm:px-5">
              {guardians.map((guardian) => (
                <div key={String(guardian.id)} className="space-y-3">
                  <DefinitionList
                    items={[
                      { label: "Nom", value: (guardian.full_name as string) ?? "—" },
                      { label: "Lien de parente", value: (guardian.relationship as string) ?? "—" },
                      { label: "Email", value: (guardian.email as string) ?? "—" },
                      { label: "Telephone", value: (guardian.phone as string) ?? "—" },
                      {
                        label: "Consentement",
                        value: guardian.consent_given
                          ? `Donne le ${formatDate(guardian.consent_given_at as string)}`
                          : "Non donne",
                      },
                      {
                        label: "Statut du dossier",
                        value: (
                          <StatusPill tone={entry(DOCUMENT_STATUS, guardian.status as string).tone}>
                            {label(DOCUMENT_STATUS, guardian.status as string)}
                          </StatusPill>
                        ),
                      },
                    ]}
                  />
                  <div className="flex flex-wrap gap-2">
                    {guardian.id_document_storage_path ? (
                      <DocumentPreview
                        bucket="guardian-documents"
                        path={guardian.id_document_storage_path as string}
                        title="Piece d'identite du representant"
                      />
                    ) : null}
                    {guardian.consent_document_storage_path ? (
                      <DocumentPreview
                        bucket="guardian-documents"
                        path={guardian.consent_document_storage_path as string}
                        title="Attestation de consentement"
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      {role === "professional" ? (
        <Panel>
          <PanelHeader
            title="Justificatifs professionnels"
            description="Chaque piece porte son propre statut de verification."
          />
          {!documents.length ? (
            <EmptyState
              icon={FileTextIcon}
              title="Aucun justificatif"
              description="Le compte n'a pas encore depose de piece."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Piece</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Examine le</TableHead>
                  <TableHead>Depose le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>
                      <DocumentPreview
                        bucket="professional-documents"
                        path={row.storage_path as string}
                        title={(row.document_label as string) ?? "Document"}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={entry(DOCUMENT_STATUS, row.status as string).tone}>
                        {label(DOCUMENT_STATUS, row.status as string)}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.reviewed_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell>
                      {/* Meme regle que pour le KYC : on n'offre pas de
                          valider une piece deja validee, ni de refuser une
                          piece deja refusee. Le geste restant nomme ce qu'il
                          fait — revenir sur une decision, pas la repeter. */}
                      <div className="flex items-center justify-end gap-2">
                        {row.status !== "valide" ? (
                          <ActionButton
                            action={setDocumentStatus.bind(null, String(row.id), "valide")}
                          >
                            <CheckIcon />
                            {row.status === "refuse" ? "Valider finalement" : "Valider"}
                          </ActionButton>
                        ) : null}
                        {row.status !== "refuse" ? (
                          <ActionButton
                            variant="destructive"
                            action={setDocumentStatus.bind(null, String(row.id), "refuse")}
                            confirm={
                              row.status === "valide"
                                ? {
                                    title: "Revoquer ce justificatif",
                                    description:
                                      "La piece repasse en « refuse ». Le statut du compte professionnel n'est pas touche : s'il doit perdre l'acces, refusez le compte ou suspendez-le.",
                                    actionLabel: "Revoquer",
                                  }
                                : undefined
                            }
                          >
                            <XIcon />
                            {row.status === "valide" ? "Revoquer" : "Refuser"}
                          </ActionButton>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ contenus */

/**
 * Les medias deposes par le compte.
 *
 * Les publications, les commentaires, les signalements et les blocages ont ete
 * retires de cet ecran : ils se lisent et se traitent dans « Moderation », qui
 * en detient le dossier complet et les gestes. Les garder ici donnait deux
 * endroits pour le meme travail, dont un sans le contexte.
 *
 * Les compteurs restent, en `count: exact` : ils disent en un coup d'oeil ce
 * qui existe, sans charger cinquante lignes pour en prendre la longueur.
 */
async function ContentView({ profileId, role }: { profileId: string; role: string }) {
  const content = await getUserContent(profileId, role);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Videos" value={formatNumber(content.videos.length)} icon={VideoIcon} />
        <StatCard label="Photos" value={formatNumber(content.photos.length)} icon={ImageIcon} />
        <StatCard
          label="Publications"
          value={formatNumber(content.postsCount)}
          icon={MessageSquareIcon}
        />
        <StatCard
          label="Signalements recus"
          value={formatNumber(content.reportsAboutCount)}
          accent={content.reportsAboutCount ? "error" : "neutral"}
          icon={FileTextIcon}
        />
        <StatCard
          label="Blocages recus"
          value={formatNumber(content.blocksReceivedCount)}
          accent={content.blocksReceivedCount ? "error" : "neutral"}
          icon={BanIcon}
        />
      </section>

      {role === "player" ? (
        <>
          <Panel>
            <PanelHeader
              title="Videos du joueur"
              description="La suppression est definitive : la ligne et le fichier de stockage sont retires."
            />
            {!content.videos.length ? (
              <EmptyState icon={VideoIcon} title="Aucune video" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Duree</TableHead>
                    <TableHead>Ajoutee le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {content.videos.map((video) => {
                    const youtube = video.youtube_url as string | null;
                    // `player-videos` est un bucket **public** (verifie contre
                    // `storage.buckets`) : l'URL directe suffit, et une balise
                    // `<video>` la lit.
                    const url =
                      youtube ?? publicStorageUrl("player-videos", video.storage_path as string);
                    const titre = (video.title as string) ?? "Sans titre";
                    const thumbnail = video.thumbnail_url as string | null;
                    return (
                      <TableRow key={String(video.id)}>
                        <TableCell className="max-w-72">
                          {url ? (
                            <MediaPreviewDialog
                              kind={youtube ? "youtube" : "video"}
                              url={url}
                              label={titre}
                              description="Video deposee par le joueur. Sa suppression est definitive."
                              trigger={
                                <span className="flex items-center gap-3">
                                  {/* La vignette n'existe que pour YouTube ;
                                      pour un fichier importe on affiche un
                                      cartouche, pas un cadre vide. */}
                                  {thumbnail ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={thumbnail}
                                      alt=""
                                      className="h-11 w-16 shrink-0 rounded-md border border-border object-cover"
                                    />
                                  ) : (
                                    <span className="flex h-11 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
                                      <VideoIcon className="size-4 text-muted-foreground" />
                                    </span>
                                  )}
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm">{titre}</span>
                                    <span className="text-xs text-muted-foreground">
                                      Voir la video
                                    </span>
                                  </span>
                                </span>
                              }
                            />
                          ) : (
                            titre
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusPill tone={video.youtube_url ? "info" : "neutral"}>
                            {video.youtube_url ? "YouTube" : "Importee"}
                          </StatusPill>
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {video.duration_sec ? `${video.duration_sec} s` : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(video.created_at as string)}
                        </TableCell>
                        <TableCell className="text-right">
                          <ActionButton
                            variant="destructive"
                            action={deletePlayerVideo.bind(null, String(video.id))}
                            confirm={{
                              title: "Supprimer cette video",
                              description:
                                "La video et son fichier de stockage seront definitivement supprimes.",
                              actionLabel: "Supprimer",
                            }}
                          >
                            Supprimer
                          </ActionButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Photos du joueur" />
            {!content.photos.length ? (
              <EmptyState icon={ImageIcon} title="Aucune photo" />
            ) : (
              <ul className="grid gap-3 px-4 py-5 sm:grid-cols-3 sm:px-5 lg:grid-cols-4">
                {content.photos.map((photo) => {
                  const url = privateStorageUrl("player-photos", photo.storage_path);
                  return (
                    <li
                      key={String(photo.id)}
                      className="space-y-2 rounded-xl border border-border bg-background p-2"
                    >
                      {url ? (
                        // La vignette est recadree en carre : elle suffit a
                        // reconnaitre une photo, pas a la moderer. Un clic
                        // l'ouvre entiere. `player-photos` est un bucket
                        // **prive**, d'ou le passage par `/admin/documents`.
                        <MediaPreviewDialog
                          kind="image"
                          url={url}
                          label={(photo.caption as string) ?? "Photo du joueur"}
                          description="Photo deposee par le joueur. Sa suppression est definitive."
                          trigger={
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={url}
                              alt={(photo.caption as string) ?? "Photo du joueur"}
                              className="aspect-square w-full rounded-lg object-cover"
                            />
                          }
                        />
                      ) : null}
                      <p className="truncate text-[0.6875rem] text-muted-foreground">
                        {(photo.caption as string) ?? formatDate(photo.created_at)}
                      </p>
                      <ActionButton
                        variant="destructive"
                        className="w-full"
                        action={deletePlayerPhoto.bind(null, String(photo.id))}
                        confirm={{
                          title: "Supprimer cette photo",
                          description: "La photo et son fichier de stockage seront supprimes.",
                          actionLabel: "Supprimer",
                        }}
                      >
                        Supprimer
                      </ActionButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {content.cvs.length ? (
            <Panel>
              <PanelHeader title="CV generes" />
              <ul className="divide-y divide-border">
                {content.cvs.map((cv) => {
                  const url = privateStorageUrl("player-cv", cv.storage_path as string);
                  return (
                    <li
                      key={String(cv.id)}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5"
                    >
                      <span className="flex items-center gap-2">
                        <FileTextIcon className="size-3.5 text-muted-foreground" />
                        {formatDateTime(cv.generated_at as string)}
                        {cv.is_current ? <StatusPill tone="brand">Courant</StatusPill> : null}
                      </span>
                      {url ? (
                        // Le CV est un PDF dans un bucket prive : le meme
                        // apercu que les justificatifs, plutot qu'un lien qui
                        // faisait quitter la fiche.
                        <DocumentPreviewDialog
                          url={url}
                          label={`CV du ${formatDate(cv.generated_at as string)}`}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ) : null}
        </>
      ) : null}

    </>
  );
}

/* ------------------------------------------------------------------ finances */

async function FinancesView({ profileId, role }: { profileId: string; role: string }) {
  const data = await getUserFinances(profileId, role);

  const totalPaid = data.payments
    .filter((payment) => ["reussi", "active_manuellement"].includes(String(payment.status)))
    .reduce((acc, payment) => acc + Number(payment.amount ?? 0), 0);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total encaisse" value={formatAmount(totalPaid)} />
        <StatCard label="Paiements" value={formatNumber(data.payments.length)} />
        {role === "player" ? (
          <>
            <StatCard label="Vues du profil" value={formatNumber(data.viewsCount)} />
            <StatCard label="Mises en favori" value={formatNumber(data.favoritesCount)} />
          </>
        ) : (
          <>
            <StatCard label="Abonnements" value={formatNumber(data.subscriptions.length)} />
            <StatCard label="Paiements" value={formatNumber(data.payments.length)} />
          </>
        )}
      </section>

      <Panel>
        <PanelHeader title="Abonnements" description="Historique des souscriptions du compte." />
        {!data.subscriptions.length ? (
          <EmptyState title="Aucun abonnement" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Offre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Debut</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Renouvellement</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.subscriptions.map((subscription) => {
                const plan = data.plans.get(String(subscription.plan_id)) as
                  | Record<string, unknown>
                  | undefined;
                return (
                  <TableRow key={String(subscription.id)}>
                    <TableCell>
                      {plan ? label(PLAN_CODE, plan.code as string) : "Offre inconnue"}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        tone={entry(SUBSCRIPTION_STATUS, subscription.status as string).tone}
                      >
                        {label(SUBSCRIPTION_STATUS, subscription.status as string)}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(subscription.starts_at as string)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(subscription.ends_at as string)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {subscription.auto_renew ? "Automatique" : "Desactive"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {subscription.status !== "active" ? (
                          <ActionButton
                            action={setSubscriptionStatus.bind(
                              null,
                              String(subscription.id),
                              "active",
                            )}
                          >
                            Activer
                          </ActionButton>
                        ) : null}
                        {subscription.status !== "annulee" ? (
                          <ActionButton
                            variant="destructive"
                            action={setSubscriptionStatus.bind(
                              null,
                              String(subscription.id),
                              "annulee",
                            )}
                          >
                            Annuler
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

      <Panel>
        <PanelHeader
          title="Paiements"
          description="Un encaissement hors ligne se valide par « Activer manuellement »."
        />
        {!data.payments.length ? (
          <EmptyState title="Aucun paiement" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Objet</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Moyen</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Encaisse le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.map((payment) => (
                <TableRow key={String(payment.id)}>
                  <TableCell>
                    <StatusPill tone={entry(PAYMENT_TYPE, payment.payment_type as string).tone}>
                      {label(PAYMENT_TYPE, payment.payment_type as string)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatAmount(payment.amount as number, (payment.currency as string) ?? "TND")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {label(PAYMENT_METHOD, payment.method as string)}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={entry(PAYMENT_STATUS, payment.status as string).tone}>
                      {label(PAYMENT_STATUS, payment.status as string)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                    {(payment.provider_reference as string) ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(payment.paid_at as string)}
                  </TableCell>
                  <TableCell className="text-right">
                    {payment.status === "en_attente" ? (
                      <ActionButton
                        action={activatePaymentManually.bind(null, String(payment.id))}
                      >
                        Activer manuellement
                      </ActionButton>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      {role === "player" ? (
        <Panel>
          <PanelHeader title="Inscriptions Scout Day" />
          {!data.registrations.length ? (
            <EmptyState title="Aucune inscription" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evenement</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Eligibilite</TableHead>
                  <TableHead>Inscrit le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.registrations.map((registration) => {
                  const scoutDay = data.scoutDays.get(String(registration.scout_day_id)) as
                    | Record<string, unknown>
                    | undefined;
                  return (
                    <TableRow key={String(registration.id)}>
                      <TableCell>
                        {scoutDay ? (
                          <Link
                            href={`/admin/scout-days/${registration.scout_day_id}`}
                            className="hover:text-brand"
                          >
                            {scoutDay.title as string}
                          </Link>
                        ) : (
                          "Evenement supprime"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(scoutDay?.event_date as string)}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          tone={entry(REGISTRATION_STATUS, registration.status as string).tone}
                        >
                          {label(REGISTRATION_STATUS, registration.status as string)}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {registration.is_eligible === null
                          ? "Non verifiee"
                          : registration.is_eligible
                            ? "Eligible"
                            : "Non eligible"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(registration.registered_at as string)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Panel>
      ) : null}

    </>
  );
}

/* -------------------------------------------------------------------- utils */

/**
 * Une piece justificative du dossier : piece d'identite, justificatif
 * professionnel, document du representant legal.
 *
 * C'etait un simple lien `target="_blank"`, ce qui faisait quitter la fiche
 * pour revenir decider — et on ne compare pas un nom declare a un scan quand
 * les deux sont dans deux onglets. Le document s'ouvre desormais en apercu, au
 * meme endroit que la decision, avec « Ouvrir dans un onglet » a l'interieur
 * pour les cas ou le plein ecran est necessaire.
 *
 * Les quatre buckets vises sont **prives** : l'URL passe par
 * `/admin/documents`, qui la signe pour cinq minutes avec la session
 * administrateur.
 */
function DocumentPreview({
  bucket,
  path,
  title,
}: {
  bucket: string;
  path: string | null;
  title: string;
}) {
  const url = privateStorageUrl(bucket, path);
  if (!url) return <span className="text-xs text-muted-foreground">{title} (aucun fichier)</span>;
  return <DocumentPreviewDialog url={url} label={title} />;
}

/** Vignette d'identite de l'entete : photo si elle existe, initiales sinon. */
function IdentityAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="size-14 shrink-0 rounded-xl border border-border object-cover"
      />
    );
  }
  return (
    <span className="font-heading flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-bold text-brand">
      {initials(name)}
    </span>
  );
}

/** Une mesure de l'entete : intitule, valeur, precision. */
function HeaderFigure({
  label: name,
  value,
  hint,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "brand" | "info";
}) {
  return (
    <div className="flex flex-col text-right">
      <span className="micro-label text-muted-foreground">{name}</span>
      <span
        className={cn(
          "font-heading text-xl leading-none font-bold tracking-tight tabular-nums",
          tone === "info" ? "text-info" : "text-brand",
        )}
      >
        {value}
      </span>
      <span className="text-[0.625rem] text-muted-foreground">{hint}</span>
    </div>
  );
}

/** Une ligne d'horodatage de la carte « Activite du compte ». */
function ActivityRow({
  label: name,
  value,
  pill,
}: {
  label: string;
  value: string;
  pill?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded bg-background px-3 py-1.5">
      <dt className="text-xs text-muted-foreground">{name}</dt>
      <dd className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold tabular-nums">{value}</span>
        {pill ? (
          <span className="micro-label rounded bg-brand/20 px-1.5 py-0.5 text-brand">{pill}</span>
        ) : null}
      </dd>
    </div>
  );
}

/**
 * Intitule de section entre deux blocs, avec la pastille de couleur de la
 * maquette : une section n'est pas un panneau, elle en regroupe plusieurs.
 */
function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <h2 className="flex items-center gap-2 font-heading text-sm font-bold tracking-tight">
        <span aria-hidden className="size-2 rounded-full bg-brand" />
        {title}
      </h2>
      {hint ? <span className="micro-label text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
