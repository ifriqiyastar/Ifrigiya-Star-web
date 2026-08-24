import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeftIcon,
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ImageIcon,
  MessageSquareIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import { AccountActions } from "@/components/admin/account-actions";
import { ActionButton } from "@/components/admin/action-button";
import { DefinitionList } from "@/components/admin/definition-list";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { SegmentedNav } from "@/components/admin/segmented-nav";
import { StatCard } from "@/components/admin/stat-card";
import { StatusPill } from "@/components/admin/status-pill";
import { ProfileCoreForm } from "@/components/admin/forms/profile-core-form";
import { PlayerProfileForm } from "@/components/admin/forms/player-profile-form";
import { ProfessionalProfileForm } from "@/components/admin/forms/professional-profile-form";
import { Button, buttonVariants } from "@/components/ui/button";
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
  setCommentDeleted,
  setCommentHidden,
  setPostDeleted,
  setPostHidden,
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
  REPORTABLE_TYPE,
  REPORT_STATUS,
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
import { publicStorageUrl } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Fiche compte" };

const VUES = ["fiche", "dossier", "contenus", "finances"] as const;
type Vue = (typeof VUES)[number];

export default async function UserDetailPage({
  params,
  searchParams,
}: PageProps<"/admin/utilisateurs/[id]">) {
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
  const displayName =
    profile.full_name?.trim() ||
    [player?.first_name, player?.last_name].filter(Boolean).join(" ") ||
    (professional?.contact_full_name as string | undefined) ||
    profile.email ||
    "Compte sans nom";

  return (
    <>
      <div>
        <Link
          href="/admin/utilisateurs"
          className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "mb-3 -ml-3")}
        >
          <ArrowLeftIcon />
          Tous les comptes
        </Link>
        <PageHeader
          kicker={label(ROLE, profile.role)}
          title={displayName}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <StatusPill tone={entry(ROLE, profile.role).tone}>
                {label(ROLE, profile.role)}
              </StatusPill>
              {businessStatus ? (
                <StatusPill tone={entry(ACCOUNT_STATUS, businessStatus).tone}>
                  {label(ACCOUNT_STATUS, businessStatus)}
                </StatusPill>
              ) : null}
              {profile.is_active ? (
                <StatusPill tone="success">Actif</StatusPill>
              ) : (
                <StatusPill tone="neutral">Desactive</StatusPill>
              )}
              {profile.is_minor ? <StatusPill tone="warning">Mineur</StatusPill> : null}
              {profile.deletion_requested_at ? (
                <StatusPill tone="danger">Suppression demandee</StatusPill>
              ) : null}
              {player?.is_visible === false ? (
                <StatusPill tone="neutral">Hors recherche</StatusPill>
              ) : null}
            </span>
          }
        />
      </div>

      <Panel className="p-4 sm:p-5">
        <AccountActions
          profileId={profile.id}
          role={profile.role}
          isActive={profile.is_active}
          businessStatus={businessStatus}
          isVisible={(player?.is_visible as boolean | undefined) ?? null}
          self={profile.id === admin.userId}
        />
        {statusReason ? (
          <p className="mt-3 rounded-xl bg-accent px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Motif enregistre :</span>{" "}
            {statusReason}
          </p>
        ) : null}
      </Panel>

      <SegmentedNav
        basePath={`/admin/utilisateurs/${profile.id}`}
        active={vue}
        segments={[
          { value: "fiche", label: "Fiche & modification" },
          { value: "dossier", label: "Dossier de validation" },
          { value: "contenus", label: "Contenus & signalements" },
          { value: "finances", label: "Abonnements & paiements" },
        ]}
      />

      {vue === "fiche" ? (
        <>
          <Panel>
            <PanelHeader
              title="Recapitulatif"
              description="Donnees non modifiables directement : elles proviennent de l'inscription ou sont mises a jour par l'application."
            />
            <div className="px-4 py-5 sm:px-5">
              <DefinitionList
                items={[
                  { label: "Identifiant", value: <code className="text-xs">{profile.id}</code> },
                  { label: "Inscrit le", value: formatDateTime(profile.created_at) },
                  { label: "Derniere connexion", value: formatDateTime(profile.last_login_at) },
                  { label: "Derniere mise a jour", value: formatDateTime(profile.updated_at) },
                  { label: "CGU acceptees le", value: formatDateTime(profile.cgu_accepted_at) },
                  {
                    label: "Confidentialite acceptee le",
                    value: formatDateTime(profile.privacy_accepted_at),
                  },
                  { label: "Desactive le", value: formatDateTime(profile.deactivated_at) },
                  {
                    label: "Suppression demandee le",
                    value: formatDateTime(profile.deletion_requested_at),
                  },
                ]}
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Fiche compte"
              description="Nom, contact, langue et role. Le role commande les droits dans toute l'application."
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
                title="Profil sportif"
                description={`Age calcule : ${ageFromBirthDate(player.birth_date as string) ?? "—"} ans · Score de classement : ${player.ranking_score ?? 0}`}
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

          {player ? <PlayerFacts player={player} /> : null}
        </>
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
      {role === "player" ? (
        <Panel>
          <PanelHeader
            title="Verifications d'identite (KYC)"
            description="identity_verifications.status est un enum distinct du statut du profil : le valider ne valide pas le compte."
          />
          {!identity.length ? (
            <EmptyState
              icon={FileTextIcon}
              title="Aucun dossier d'identite"
              description="Le joueur n'a pas encore soumis de piece d'identite."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Piece</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Controle facial</TableHead>
                  <TableHead>Motif de refus</TableHead>
                  <TableHead>Depose</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {identity.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>
                      <DocumentLink
                        bucket="identity-documents"
                        path={row.storage_path as string}
                        title={String(row.document_type ?? "Document").toUpperCase()}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={entry(IDENTITY_STATUS, row.status as string).tone}>
                        {label(IDENTITY_STATUS, row.status as string)}
                      </StatusPill>
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
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {(row.rejection_reason as string) ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.created_at as string)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <ActionButton
                          action={setIdentityStatus.bind(
                            null,
                            String(row.id),
                            "valide",
                            undefined,
                          )}
                        >
                          <CheckIcon />
                          Valider
                        </ActionButton>
                        <ReasonDialog
                          action={(reason) => setIdentityStatus(String(row.id), "refuse", reason)}
                          trigger={
                            <Button variant="destructive" size="xs">
                              <XIcon />
                              Refuser
                            </Button>
                          }
                          title="Refuser cette piece d'identite"
                          submitLabel="Refuser la piece"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      ) : null}

      {role === "player" ? (
        <Panel>
          <PanelHeader
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
                      <DocumentLink
                        bucket="guardian-documents"
                        path={guardian.id_document_storage_path as string}
                        title="Piece d'identite du representant"
                      />
                    ) : null}
                    {guardian.consent_document_storage_path ? (
                      <DocumentLink
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
                      <DocumentLink
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
                      <div className="flex items-center justify-end gap-2">
                        <ActionButton action={setDocumentStatus.bind(null, String(row.id), "valide")}>
                          <CheckIcon />
                          Valider
                        </ActionButton>
                        <ActionButton
                          variant="destructive"
                          action={setDocumentStatus.bind(null, String(row.id), "refuse")}
                        >
                          <XIcon />
                          Refuser
                        </ActionButton>
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

async function ContentView({ profileId, role }: { profileId: string; role: string }) {
  const content = await getUserContent(profileId, role);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Videos" value={formatNumber(content.videos.length)} icon={VideoIcon} />
        <StatCard label="Photos" value={formatNumber(content.photos.length)} icon={ImageIcon} />
        <StatCard
          label="Publications"
          value={formatNumber(content.posts.length)}
          icon={MessageSquareIcon}
        />
        <StatCard
          label="Signalements recus"
          value={formatNumber(content.reportsAbout.length)}
          tone={content.reportsAbout.length ? "brand" : "default"}
          icon={FileTextIcon}
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
                    const url =
                      (video.youtube_url as string) ??
                      publicStorageUrl("player-videos", video.storage_path as string);
                    return (
                      <TableRow key={String(video.id)}>
                        <TableCell className="max-w-64 truncate">
                          {url ? (
                            <Link
                              href={url}
                              target="_blank"
                              className="inline-flex items-center gap-1.5 hover:text-brand"
                            >
                              {(video.title as string) ?? "Sans titre"}
                              <ExternalLinkIcon className="size-3 text-muted-foreground" />
                            </Link>
                          ) : (
                            ((video.title as string) ?? "Sans titre")
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
                  const url = publicStorageUrl("player-photos", photo.storage_path);
                  return (
                    <li
                      key={String(photo.id)}
                      className="space-y-2 rounded-xl border border-border bg-background p-2"
                    >
                      {url ? (
                        // Image de moderation : on affiche l'objet du bucket tel quel,
                        // sans passer par next/image (domaine Supabase non configure).
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={(photo.caption as string) ?? "Photo du joueur"}
                          className="aspect-square w-full rounded-lg object-cover"
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
                  const url = publicStorageUrl("player-cv", cv.storage_path as string);
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
                        <Link
                          href={url}
                          target="_blank"
                          className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                        >
                          Ouvrir
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ) : null}
        </>
      ) : null}

      <Panel>
        <PanelHeader
          title="Publications"
          description="Masquer releve de la moderation, supprimer simule le geste de l'auteur. Les deux sont reversibles."
        />
        {!content.posts.length ? (
          <EmptyState icon={MessageSquareIcon} title="Aucune publication" />
        ) : (
          <ul className="divide-y divide-border">
            {content.posts.map((post) => (
              <li key={String(post.id)} className="space-y-2 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDateTime(post.created_at as string)}</span>
                  {post.is_hidden ? <StatusPill tone="warning">Masquee</StatusPill> : null}
                  {post.is_deleted ? <StatusPill tone="danger">Supprimee</StatusPill> : null}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {(post.content as string) ?? "(sans texte)"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    action={setPostHidden.bind(null, String(post.id), !post.is_hidden)}
                  >
                    {post.is_hidden ? "Reafficher" : "Masquer"}
                  </ActionButton>
                  <ActionButton
                    variant={post.is_deleted ? "outline" : "destructive"}
                    action={setPostDeleted.bind(null, String(post.id), !post.is_deleted)}
                  >
                    {post.is_deleted ? "Restaurer" : "Supprimer"}
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Commentaires" />
        {!content.comments.length ? (
          <EmptyState icon={MessageSquareIcon} title="Aucun commentaire" />
        ) : (
          <ul className="divide-y divide-border">
            {content.comments.map((comment) => (
              <li key={String(comment.id)} className="space-y-2 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDateTime(comment.created_at as string)}</span>
                  {comment.is_hidden ? <StatusPill tone="warning">Masque</StatusPill> : null}
                  {comment.is_deleted ? <StatusPill tone="danger">Supprime</StatusPill> : null}
                </div>
                <p className="text-sm leading-relaxed">{comment.content as string}</p>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    action={setCommentHidden.bind(null, String(comment.id), !comment.is_hidden)}
                  >
                    {comment.is_hidden ? "Reafficher" : "Masquer"}
                  </ActionButton>
                  <ActionButton
                    variant={comment.is_deleted ? "outline" : "destructive"}
                    action={setCommentDeleted.bind(null, String(comment.id), !comment.is_deleted)}
                  >
                    {comment.is_deleted ? "Restaurer" : "Supprimer"}
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Signalements recus"
            description="Signalements dont ce compte ou l'un de ses contenus est la cible."
          />
          <ReportsMiniTable rows={content.reportsAbout} />
        </Panel>
        <Panel>
          <PanelHeader title="Signalements emis" description="Signalements deposes par ce compte." />
          <ReportsMiniTable rows={content.reportsBy} />
        </Panel>
      </div>
    </>
  );
}

function ReportsMiniTable({ rows }: { rows: Record<string, string | null>[] }) {
  if (!rows.length) {
    return <EmptyState title="Aucun signalement" />;
  }
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={String(row.id)} className="space-y-1.5 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusPill tone="neutral">{label(REPORTABLE_TYPE, row.target_type)}</StatusPill>
            <StatusPill tone={entry(REPORT_STATUS, row.status).tone}>
              {label(REPORT_STATUS, row.status)}
            </StatusPill>
            <span className="text-muted-foreground">{formatDate(row.created_at)}</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{row.reason}</p>
        </li>
      ))}
    </ul>
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
        <StatCard label="Total encaisse" value={formatAmount(totalPaid)} tone="brand" />
        <StatCard label="Paiements" value={formatNumber(data.payments.length)} />
        {role === "player" ? (
          <>
            <StatCard label="Vues du profil" value={formatNumber(data.viewsCount)} />
            <StatCard label="Mises en favori" value={formatNumber(data.favoritesCount)} />
          </>
        ) : (
          <>
            <StatCard label="Abonnements" value={formatNumber(data.subscriptions.length)} />
            <StatCard
              label="Actions admin tracees"
              value={formatNumber(data.audit.length)}
            />
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

      <Panel>
        <PanelHeader
          title="Actions administrateur sur ce compte"
          description="Extrait de admin_audit_log filtre sur cet identifiant."
        />
        {!data.audit.length ? (
          <EmptyState title="Aucune action tracee" />
        ) : (
          <ul className="divide-y divide-border">
            {data.audit.map((entryRow) => (
              <li
                key={String(entryRow.id)}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs sm:px-5"
              >
                <code className="text-brand">{String(entryRow.action)}</code>
                <span className="text-muted-foreground">
                  {formatDateTime(entryRow.created_at as string)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

/* -------------------------------------------------------------------- utils */

function DocumentLink({
  bucket,
  path,
  title,
}: {
  bucket: string;
  path: string | null;
  title: string;
}) {
  if (!path) return <span className="text-xs text-muted-foreground">{title} (aucun fichier)</span>;
  return (
    <Link
      href={`/admin/documents?bucket=${bucket}&path=${encodeURIComponent(path)}`}
      target="_blank"
      className="inline-flex items-center gap-1.5 text-sm hover:text-brand"
    >
      <FileTextIcon className="size-3.5" />
      {title}
      <ExternalLinkIcon className="size-3 text-muted-foreground" />
    </Link>
  );
}
