import { getAdminI18n } from "@/lib/i18n/admin";
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
import { ageFromBirthDate, initials } from "@/lib/format";
import { ACCOUNT_STATUS, DOCUMENT_STATUS, FOOT_PREFERENCE, IDENTITY_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, PAYMENT_TYPE, PLAN_CODE, PLAYER_LEVEL, REGISTRATION_STATUS, ROLE, SUBSCRIPTION_STATUS } from "@/lib/labels";
import {
  getUserContent,
  getUserDetail,
  getUserDossier,
  getUserFinances,
} from "@/lib/queries/user-detail";
import { privateStorageUrl, publicStorageUrl } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Fiche compte") };
}

const VUES = ["fiche", "dossier", "contenus", "finances"] as const;
type Vue = (typeof VUES)[number];

export default async function UserDetailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/utilisateurs/[id]">) {
  const i18n = await getAdminI18n();

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
    (player?.main_position ? i18n.labels.position(String(player.main_position)) : null) ??
    null;

  const displayName =
    profile.full_name?.trim() ||
    [player?.first_name, player?.last_name].filter(Boolean).join(" ") ||
    (professional?.contact_full_name as string | undefined) ||
    profile.email ||
    i18n.t("Compte sans nom");

  const roleTone =
    profile.role === "player" ? "brand" : profile.role === "professional" ? "info" : "warning";

  return (
    <>
      {/* Barre de retour et de contexte, comme la maquette : d'ou l'on vient,
          quel type de compte, et la mesure qui situe la fiche. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-2">
          <Link
            href={i18n.path("/admin/utilisateurs")}
            className="micro-label inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-brand"
          >
            <ArrowLeftIcon className="size-3.5" />
            {i18n.t("Tous les comptes")}</Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="micro-label rounded bg-muted px-2 py-0.5 text-brand">
            {i18n.labels.label(ROLE, profile.role)}
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span className="max-w-64 truncate text-xs font-semibold">{displayName}</span>
        </nav>
        <span className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <span className="micro-label text-muted-foreground">{i18n.t("Completion du profil")}</span>
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
                <StatusPill tone={roleTone}>{i18n.labels.label(ROLE, profile.role)}</StatusPill>
                {businessStatus ? (
                  <StatusPill tone={i18n.labels.entry(ACCOUNT_STATUS, businessStatus).tone}>
                    {i18n.labels.label(ACCOUNT_STATUS, businessStatus)}
                  </StatusPill>
                ) : null}
                {profile.is_active ? (
                  <StatusPill tone="success" dot>
                    {i18n.t("Actif")}</StatusPill>
                ) : (
                  <StatusPill tone="neutral" dot>
                    {i18n.t("Desactive")}</StatusPill>
                )}
                {profile.is_minor ? <StatusPill tone="warning">{i18n.t("Mineur")}</StatusPill> : null}
                {profile.deletion_requested_at ? (
                  <StatusPill tone="danger">{i18n.t("Suppression demandee")}</StatusPill>
                ) : null}
                {player?.is_visible === false ? (
                  <StatusPill tone="neutral">{i18n.t("Hors recherche")}</StatusPill>
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
                    {i18n.format.formatDate(player.birth_date as string)} (
                    {ageFromBirthDate(player.birth_date as string) ?? "—"}  {i18n.t("ans)")}</span>
                ) : null}
                {contextLine ? <span className="text-foreground">{contextLine}</span> : null}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-6">
            <HeaderFigure
              label={i18n.t("Completion")}
              value={`${completion} %`}
              hint={i18n.t("Champs renseignes")}
            />
            {profile.role === "player" ? (
              <HeaderFigure
                label={i18n.t("Note moyenne")}
                value={averageScore === null ? "—" : String(averageScore)}
                hint={
                  scores.length
                    ? i18n.t("{0} evaluation(s)", { "0": scores.length })
                    : i18n.t("Aucune evaluation")
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
            email={profile.email}
            isActive={profile.is_active}
            businessStatus={businessStatus}
            isVisible={(player?.is_visible as boolean | undefined) ?? null}
            self={profile.id === admin.userId}
          />
          {statusReason ? (
            <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{i18n.t("Motif enregistre :")}</span>{" "}
              {statusReason}
            </p>
          ) : null}
        </div>
      </Panel>

      <SegmentedNav
        basePath={i18n.path(`/admin/utilisateurs/${profile.id}`)}
        active={vue}
        segments={[
          { value: "fiche", label: i18n.t("Fiche & modification"), icon: UserRoundIcon },
          {
            value: "dossier",
            label: i18n.t("Dossier de validation"),
            icon: ShieldCheckIcon,
            count: dossierCount,
          },
          {
            value: "contenus",
            label: i18n.t("Medias du compte"),
            icon: VideoIcon,
            count: mediaCount,
          },
          { value: "finances", label: i18n.t("Abonnements & paiements"), icon: CreditCardIcon },
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
                  {i18n.t("Activite du compte")}</h2>
                <span className="micro-label text-muted-foreground">{i18n.t("Lecture seule")}</span>
              </div>

              <p className="flex items-start gap-2 rounded-lg bg-background p-3 text-xs leading-relaxed text-muted-foreground">
                <InfoIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                {i18n.t("Ces horodatages sont ecrits a l'inscription ou par l'application mobile : ils ne se modifient pas depuis le back-office.")}</p>

              <dl className="mt-3 flex flex-col gap-1.5">
                <ActivityRow label={i18n.t("Inscription")} value={i18n.format.formatDateTime(profile.created_at)} />
                <ActivityRow
                  label={i18n.t("Derniere mise a jour")}
                  value={i18n.format.formatDateTime(profile.updated_at)}
                />
                <ActivityRow
                  label={i18n.t("Derniere connexion")}
                  value={i18n.format.formatDateTime(profile.last_login_at)}
                  pill={profile.last_login_at ? i18n.format.timeAgo(profile.last_login_at) : undefined}
                />
                <ActivityRow
                  label={i18n.t("CGU acceptees")}
                  value={i18n.format.formatDateTime(profile.cgu_accepted_at)}
                />
                <ActivityRow
                  label={i18n.t("Confidentialite acceptee")}
                  value={i18n.format.formatDateTime(profile.privacy_accepted_at)}
                />
                <ActivityRow label={i18n.t("Desactive le")} value={i18n.format.formatDateTime(profile.deactivated_at)} />
                <ActivityRow
                  label={i18n.t("Suppression demandee le")}
                  value={i18n.format.formatDateTime(profile.deletion_requested_at)}
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
                title={i18n.t("Fiche compte & droits d'acces")}
                description={i18n.t("Nom, contact, langue et role. Le role commande les droits dans toute l'application et sur l'application mobile.")}
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
                  title={i18n.t("Profil sportif & caracteristiques")}
                  description={i18n.t("Age calcule : {0} ans · Score de classement enregistre : {1}", { "0": ageFromBirthDate(player.birth_date as string) ?? "—", "1": player.ranking_score ?? 0 })}
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
                  title={i18n.t("Fiche professionnelle")}
                  description={i18n.t("Type de compte, organisation et contact declares a l'inscription.")}
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

async function PlayerFacts({ player }: { player: Record<string, unknown> }) {
  const i18n = await getAdminI18n();

  return (
    <Panel>
      <PanelHeader title={i18n.t("Donnees sportives en un coup d'oeil")} />
      <div className="px-4 py-5 sm:px-5">
        <DefinitionList
          items={[
            { label: i18n.t("Niveau"), value: i18n.labels.label(PLAYER_LEVEL, player.level as string) },
            { label: i18n.t("Pied fort"), value: i18n.labels.label(FOOT_PREFERENCE, player.foot_preference as string) },
            { label: i18n.t("Taille"), value: player.height_cm ? i18n.t("{0} cm", { "0": player.height_cm }) : "—" },
            { label: i18n.t("Poids"), value: player.weight_kg ? i18n.t("{0} kg", { "0": player.weight_kg }) : "—" },
            { label: i18n.t("Club actuel"), value: (player.current_club as string) ?? "—" },
            { label: i18n.t("Joueur libre"), value: player.is_free_agent ? i18n.t("Oui") : i18n.t("Non") },
            {
              label: i18n.t("Visible dans la recherche"),
              value: player.is_visible ? i18n.t("Oui") : i18n.t("Non"),
            },
            { label: i18n.t("Score de classement"), value: String(player.ranking_score ?? 0) },
          ]}
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------- dossier */

async function DossierView({ profileId, role }: { profileId: string; role: string }) {
  const i18n = await getAdminI18n();

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
          <p className="text-sm font-semibold">{i18n.t("Piece d'identite et compte sont decouples")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {i18n.t("La revue d'une piece d'identite est un controle distinct de la validation du compte. Accepter la piece atteste de l'identite ; elle n'ouvre ni l'acces a l'application ni la visibilite du joueur — c'est la validation du profil qui le fait, depuis la file de validation ou l'entete de cette fiche.")}</p>
        </div>
      </div>

      {role === "player" ? (
        <SectionTitle
          title={i18n.t("Verifications d'identite (KYC)")}
          hint={i18n.t("{0} piece(s) au dossier", { "0": identity.length })}
        />
      ) : null}

      {role === "player" ? (
        <Panel>
          <PanelHeader
            icon={ShieldCheckIcon}
            title={i18n.t("Pieces deposees")}
            description={i18n.t("Chaque piece est affichee en place : la decision se prend en face du document, pas derriere un bouton.")}
          />
          {!identity.length ? (
            <EmptyState
              icon={FileTextIcon}
              title={i18n.t("Aucun dossier d'identite")}
              description={i18n.t("Le joueur n'a pas encore soumis de piece d'identite.")}
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
                        {String(row.document_type ?? i18n.t("Document")).toUpperCase()}
                      </StatusPill>
                      <StatusPill tone={i18n.labels.entry(IDENTITY_STATUS, row.status as string).tone}>
                        {i18n.labels.label(IDENTITY_STATUS, row.status as string)}
                      </StatusPill>
                      {row.facial_check_provider ? (
                        <StatusPill tone={row.facial_check_passed ? "success" : "danger"}>
                          {i18n.t("Controle facial")} {row.facial_check_passed ? "reussi" : "echoue"}
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral">{i18n.t("Controle facial non realise")}</StatusPill>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {i18n.t("Depose le")} {i18n.format.formatDate(row.created_at as string)}
                      </span>

                      <span className="flex-1" />

                      {/* Les gestes suivent le statut : proposer « Valider »
                          sur une piece deja valide, c'est offrir un bouton qui
                          ne fait rien, et laisser croire qu'il reste quelque
                          chose a decider. Meme regle que `AccountActions`. */}
                      <div className="flex flex-wrap items-center gap-2">
                        {row.reviewed_at ? (
                          <span className="text-xs text-muted-foreground">
                            {i18n.t("Examine le")} {i18n.format.formatDate(row.reviewed_at as string)}
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
                            {row.status === "refuse" ? i18n.t("Valider finalement") : i18n.t("Valider")}
                          </ActionButton>
                        ) : null}

                        {row.status !== "refuse" ? (
                          <ReasonDialog
                            action={setIdentityStatus.bind(null, String(row.id), "refuse")}
                            trigger={
                              <Button variant="destructive" size="xs">
                                <XIcon />
                                {row.status === "valide" ? i18n.t("Revoquer") : i18n.t("Refuser")}
                              </Button>
                            }
                            title={
                              row.status === "valide"
                                ? i18n.t("Revoquer cette piece d'identite")
                                : i18n.t("Refuser cette piece d'identite")
                            }
                            description={
                              row.status === "valide"
                                ? i18n.t("La piece repasse en « refuse » et le motif est enregistre dans rejection_reason. Le statut du profil joueur n'est pas touche : s'il doit perdre l'acces, suspendez le compte.")
                                : i18n.t("Le motif est enregistre sur la piece et transmis au joueur.")
                            }
                            placeholder={i18n.t("Document expire, photo floue, nom non concordant…")}
                            submitLabel={
                              row.status === "valide" ? i18n.t("Revoquer la piece") : i18n.t("Refuser la piece")
                            }
                          />
                        ) : null}
                      </div>
                    </div>

                    {row.rejection_reason ? (
                      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {i18n.t("Motif du refus :")} {row.rejection_reason as string}
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
                          label={i18n.t("Piece d'identite — {0}", { "0": String(row.document_type ?? "document").toUpperCase() })}
                        />
                        <span className="text-xs text-muted-foreground">
                          {i18n.t("Doit concorder avec le nom et la date de naissance declares.")}</span>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                        {i18n.t("Aucun fichier joint a cette verification : rien a examiner.")}</p>
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
            title={i18n.t("Representant legal")}
            description={i18n.t("Le CDC laisse le circuit de consentement des mineurs indefini : ces donnees sont affichees telles qu'elles ont ete saisies, sans workflow automatique.")}
          />
          {!guardians.length ? (
            <EmptyState
              icon={FileTextIcon}
              title={i18n.t("Aucun representant declare")}
              description={i18n.t("Requis en base des lors que le joueur est mineur.")}
            />
          ) : (
            <div className="space-y-5 px-4 py-5 sm:px-5">
              {guardians.map((guardian) => (
                <div key={String(guardian.id)} className="space-y-3">
                  <DefinitionList
                    items={[
                      { label: i18n.t("Nom"), value: (guardian.full_name as string) ?? "—" },
                      { label: i18n.t("Lien de parente"), value: (guardian.relationship as string) ?? "—" },
                      { label: i18n.t("Email"), value: (guardian.email as string) ?? "—" },
                      { label: i18n.t("Telephone"), value: (guardian.phone as string) ?? "—" },
                      {
                        label: i18n.t("Consentement"),
                        value: guardian.consent_given
                          ? i18n.t("Donne le {0}", { "0": i18n.format.formatDate(guardian.consent_given_at as string) })
                          : i18n.t("Non donne"),
                      },
                      {
                        label: i18n.t("Statut du dossier"),
                        value: (
                          <StatusPill tone={i18n.labels.entry(DOCUMENT_STATUS, guardian.status as string).tone}>
                            {i18n.labels.label(DOCUMENT_STATUS, guardian.status as string)}
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
                        title={i18n.t("Piece d'identite du representant")}
                      />
                    ) : null}
                    {guardian.consent_document_storage_path ? (
                      <DocumentPreview
                        bucket="guardian-documents"
                        path={guardian.consent_document_storage_path as string}
                        title={i18n.t("Attestation de consentement")}
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
            title={i18n.t("Justificatifs professionnels")}
            description={i18n.t("Chaque piece porte son propre statut de verification.")}
          />
          {!documents.length ? (
            <EmptyState
              icon={FileTextIcon}
              title={i18n.t("Aucun justificatif")}
              description={i18n.t("Le compte n'a pas encore depose de piece.")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{i18n.t("Piece")}</TableHead>
                  <TableHead>{i18n.t("Statut")}</TableHead>
                  <TableHead>{i18n.t("Examine le")}</TableHead>
                  <TableHead>{i18n.t("Depose le")}</TableHead>
                  <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>
                      <DocumentPreview
                        bucket="professional-documents"
                        path={row.storage_path as string}
                        title={(row.document_label as string) ?? i18n.t("Document")}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={i18n.labels.entry(DOCUMENT_STATUS, row.status as string).tone}>
                        {i18n.labels.label(DOCUMENT_STATUS, row.status as string)}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i18n.format.formatDate(row.reviewed_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i18n.format.formatDate(row.created_at)}
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
                            {row.status === "refuse" ? i18n.t("Valider finalement") : i18n.t("Valider")}
                          </ActionButton>
                        ) : null}
                        {row.status !== "refuse" ? (
                          <ActionButton
                            variant="destructive"
                            action={setDocumentStatus.bind(null, String(row.id), "refuse")}
                            confirm={
                              row.status === "valide"
                                ? {
                                    title: i18n.t("Revoquer ce justificatif"),
                                    description:
                                      i18n.t("La piece repasse en « refuse ». Le statut du compte professionnel n'est pas touche : s'il doit perdre l'acces, refusez le compte ou suspendez-le."),
                                    actionLabel: i18n.t("Revoquer"),
                                  }
                                : undefined
                            }
                          >
                            <XIcon />
                            {row.status === "valide" ? i18n.t("Revoquer") : i18n.t("Refuser")}
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
  const i18n = await getAdminI18n();

  const content = await getUserContent(profileId, role);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label={i18n.t("Videos")} value={i18n.format.formatNumber(content.videos.length)} icon={VideoIcon} />
        <StatCard label={i18n.t("Photos")} value={i18n.format.formatNumber(content.photos.length)} icon={ImageIcon} />
        <StatCard
          label={i18n.t("Publications")}
          value={i18n.format.formatNumber(content.postsCount)}
          icon={MessageSquareIcon}
        />
        <StatCard
          label={i18n.t("Signalements recus")}
          value={i18n.format.formatNumber(content.reportsAboutCount)}
          accent={content.reportsAboutCount ? "error" : "neutral"}
          icon={FileTextIcon}
        />
        <StatCard
          label={i18n.t("Blocages recus")}
          value={i18n.format.formatNumber(content.blocksReceivedCount)}
          accent={content.blocksReceivedCount ? "error" : "neutral"}
          icon={BanIcon}
        />
      </section>

      {role === "player" ? (
        <>
          <Panel>
            <PanelHeader
              title={i18n.t("Videos du joueur")}
              description={i18n.t("La suppression est definitive : la ligne et le fichier de stockage sont retires.")}
            />
            {!content.videos.length ? (
              <EmptyState icon={VideoIcon} title={i18n.t("Aucune video")} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{i18n.t("Titre")}</TableHead>
                    <TableHead>{i18n.t("Source")}</TableHead>
                    <TableHead>{i18n.t("Duree")}</TableHead>
                    <TableHead>{i18n.t("Ajoutee le")}</TableHead>
                    <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
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
                    const titre = (video.title as string) ?? i18n.t("Sans titre");
                    const thumbnail = video.thumbnail_url as string | null;
                    return (
                      <TableRow key={String(video.id)}>
                        <TableCell className="max-w-72">
                          {url ? (
                            <MediaPreviewDialog
                              kind={youtube ? "youtube" : "video"}
                              url={url}
                              label={titre}
                              description={i18n.t("Video deposee par le joueur. Sa suppression est definitive.")}
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
                                      {i18n.t("Voir la video")}</span>
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
                            {video.youtube_url ? "YouTube" : i18n.t("Importee")}
                          </StatusPill>
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {video.duration_sec ? i18n.t("{0} s", { "0": video.duration_sec }) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {i18n.format.formatDate(video.created_at as string)}
                        </TableCell>
                        <TableCell className="text-right">
                          <ActionButton
                            variant="destructive"
                            action={deletePlayerVideo.bind(null, String(video.id))}
                            confirm={{
                              title: i18n.t("Supprimer cette video"),
                              description:
                                i18n.t("La video et son fichier de stockage seront definitivement supprimes."),
                              actionLabel: i18n.t("Supprimer"),
                            }}
                          >
                            {i18n.t("Supprimer")}</ActionButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Panel>

          <Panel>
            <PanelHeader title={i18n.t("Photos du joueur")} />
            {!content.photos.length ? (
              <EmptyState icon={ImageIcon} title={i18n.t("Aucune photo")} />
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
                          label={(photo.caption as string) ?? i18n.t("Photo du joueur")}
                          description={i18n.t("Photo deposee par le joueur. Sa suppression est definitive.")}
                          trigger={
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={url}
                              alt={(photo.caption as string) ?? i18n.t("Photo du joueur")}
                              className="aspect-square w-full rounded-lg object-cover"
                            />
                          }
                        />
                      ) : null}
                      <p className="truncate text-[0.6875rem] text-muted-foreground">
                        {(photo.caption as string) ?? i18n.format.formatDate(photo.created_at)}
                      </p>
                      <ActionButton
                        variant="destructive"
                        className="w-full"
                        action={deletePlayerPhoto.bind(null, String(photo.id))}
                        confirm={{
                          title: i18n.t("Supprimer cette photo"),
                          description: i18n.t("La photo et son fichier de stockage seront supprimes."),
                          actionLabel: i18n.t("Supprimer"),
                        }}
                      >
                        {i18n.t("Supprimer")}</ActionButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {content.cvs.length ? (
            <Panel>
              <PanelHeader title={i18n.t("CV generes")} />
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
                        {i18n.format.formatDateTime(cv.generated_at as string)}
                        {cv.is_current ? <StatusPill tone="brand">{i18n.t("Courant")}</StatusPill> : null}
                      </span>
                      {url ? (
                        // Le CV est un PDF dans un bucket prive : le meme
                        // apercu que les justificatifs, plutot qu'un lien qui
                        // faisait quitter la fiche.
                        <DocumentPreviewDialog
                          url={url}
                          label={i18n.t("CV du {0}", { "0": i18n.format.formatDate(cv.generated_at as string) })}
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
  const i18n = await getAdminI18n();

  const data = await getUserFinances(profileId, role);

  const totalPaid = data.payments
    .filter((payment) => ["reussi", "active_manuellement"].includes(String(payment.status)))
    .reduce((acc, payment) => acc + Number(payment.amount ?? 0), 0);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={i18n.t("Total encaisse")} value={i18n.format.formatAmount(totalPaid)} />
        <StatCard label={i18n.t("Paiements")} value={i18n.format.formatNumber(data.payments.length)} />
        {role === "player" ? (
          <>
            <StatCard label={i18n.t("Vues du profil")} value={i18n.format.formatNumber(data.viewsCount)} />
            <StatCard label={i18n.t("Mises en favori")} value={i18n.format.formatNumber(data.favoritesCount)} />
          </>
        ) : (
          <>
            <StatCard label={i18n.t("Abonnements")} value={i18n.format.formatNumber(data.subscriptions.length)} />
            <StatCard label={i18n.t("Paiements")} value={i18n.format.formatNumber(data.payments.length)} />
          </>
        )}
      </section>

      <Panel>
        <PanelHeader title={i18n.t("Abonnements")} description={i18n.t("Historique des souscriptions du compte.")} />
        {!data.subscriptions.length ? (
          <EmptyState title={i18n.t("Aucun abonnement")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18n.t("Offre")}</TableHead>
                <TableHead>{i18n.t("Statut")}</TableHead>
                <TableHead>{i18n.t("Debut")}</TableHead>
                <TableHead>{i18n.t("Fin")}</TableHead>
                <TableHead>{i18n.t("Renouvellement")}</TableHead>
                <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
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
                      {plan ? i18n.labels.label(PLAN_CODE, plan.code as string) : i18n.t("Offre inconnue")}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        tone={i18n.labels.entry(SUBSCRIPTION_STATUS, subscription.status as string).tone}
                      >
                        {i18n.labels.label(SUBSCRIPTION_STATUS, subscription.status as string)}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i18n.format.formatDate(subscription.starts_at as string)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i18n.format.formatDate(subscription.ends_at as string)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {subscription.auto_renew ? i18n.t("Automatique") : i18n.t("Desactive")}
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
                            {i18n.t("Activer")}</ActionButton>
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
                            {i18n.t("Annuler")}</ActionButton>
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
          title={i18n.t("Paiements")}
          description={i18n.t("Un encaissement hors ligne se valide par « Activer manuellement ».")}
        />
        {!data.payments.length ? (
          <EmptyState title={i18n.t("Aucun paiement")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18n.t("Objet")}</TableHead>
                <TableHead>{i18n.t("Montant")}</TableHead>
                <TableHead>{i18n.t("Moyen")}</TableHead>
                <TableHead>{i18n.t("Statut")}</TableHead>
                <TableHead>{i18n.t("Reference")}</TableHead>
                <TableHead>{i18n.t("Encaisse le")}</TableHead>
                <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.map((payment) => (
                <TableRow key={String(payment.id)}>
                  <TableCell>
                    <StatusPill tone={i18n.labels.entry(PAYMENT_TYPE, payment.payment_type as string).tone}>
                      {i18n.labels.label(PAYMENT_TYPE, payment.payment_type as string)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {i18n.format.formatAmount(payment.amount as number, (payment.currency as string) ?? "TND")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i18n.labels.label(PAYMENT_METHOD, payment.method as string)}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={i18n.labels.entry(PAYMENT_STATUS, payment.status as string).tone}>
                      {i18n.labels.label(PAYMENT_STATUS, payment.status as string)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                    {(payment.provider_reference as string) ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i18n.format.formatDate(payment.paid_at as string)}
                  </TableCell>
                  <TableCell className="text-right">
                    {payment.status === "en_attente" ? (
                      <ActionButton
                        action={activatePaymentManually.bind(null, String(payment.id))}
                      >
                        {i18n.t("Activer manuellement")}</ActionButton>
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
          <PanelHeader title={i18n.t("Inscriptions Scout Day")} />
          {!data.registrations.length ? (
            <EmptyState title={i18n.t("Aucune inscription")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{i18n.t("Evenement")}</TableHead>
                  <TableHead>{i18n.t("Date")}</TableHead>
                  <TableHead>{i18n.t("Statut")}</TableHead>
                  <TableHead>{i18n.t("Eligibilite")}</TableHead>
                  <TableHead>{i18n.t("Inscrit le")}</TableHead>
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
                            href={i18n.path(`/admin/scout-days/${registration.scout_day_id}`)}
                            className="hover:text-brand"
                          >
                            {scoutDay.title as string}
                          </Link>
                        ) : (
                          i18n.t("Evenement supprime")
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {i18n.format.formatDate(scoutDay?.event_date as string)}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          tone={i18n.labels.entry(REGISTRATION_STATUS, registration.status as string).tone}
                        >
                          {i18n.labels.label(REGISTRATION_STATUS, registration.status as string)}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {registration.is_eligible === null
                          ? i18n.t("Non verifiee")
                          : registration.is_eligible
                            ? i18n.t("Eligible")
                            : i18n.t("Non eligible")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {i18n.format.formatDate(registration.registered_at as string)}
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
async function DocumentPreview({
  bucket,
  path,
  title,
}: {
  bucket: string;
  path: string | null;
  title: string;
}) {
  const i18n = await getAdminI18n();

  const url = privateStorageUrl(bucket, path);
  if (!url) return <span className="text-xs text-muted-foreground">{title}  {i18n.t("(aucun fichier)")}</span>;
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
