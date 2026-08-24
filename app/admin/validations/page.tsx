import type { Metadata } from "next";
import {
  CheckIcon,
  FileTextIcon,
  MessageSquareWarningIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  XIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { DocumentPreviewDialog } from "@/components/admin/document-preview-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { SegmentedNav } from "@/components/admin/segmented-nav";
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
import {
  setDocumentStatus,
  setIdentityStatus,
  setPlayerStatus,
  setProfessionalStatus,
} from "@/lib/actions/users";
import { ageFromBirthDate, formatDateTime, timeAgo } from "@/lib/format";
import {
  DOCUMENT_STATUS,
  IDENTITY_STATUS,
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

export default async function ValidationsPage({
  searchParams,
}: PageProps<"/admin/validations">) {
  await requirePermission("verifications.review");
  const resolved = await searchParams;
  const requested = typeof resolved.vue === "string" ? resolved.vue : "joueurs";
  const vue: Segment = (SEGMENTS as readonly string[]).includes(requested)
    ? (requested as Segment)
    : "joueurs";

  const supabase = await createClient();

  // Compteurs des quatre files, toujours affiches pour qu'on voie ce qui reste
  // a traiter ailleurs sans changer d'onglet.
  const [playersCount, prosCount, docsCount, kycCount] = await Promise.all([
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
  ]);

  return (
    <>
      <PageHeader
        kicker="Utilisateurs et validations"
        title="Files de validation"
        description="Les comptes en attente, dans l'ordre d'arrivee. Valider un profil joueur ou professionnel debloque l'acces a l'application : c'est le statut du profil metier que lit le resolveur d'onboarding mobile, pas celui du document d'identite."
      />

      <SegmentedNav
        basePath="/admin/validations"
        active={vue}
        segments={[
          { value: "joueurs", label: "Profils joueurs", count: playersCount.count ?? 0 },
          {
            value: "professionnels",
            label: "Comptes professionnels",
            count: prosCount.count ?? 0,
          },
          { value: "justificatifs", label: "Justificatifs pro", count: docsCount.count ?? 0 },
          { value: "identite", label: "Pieces d'identite", count: kycCount.count ?? 0 },
        ]}
      />

      {vue === "joueurs" ? <PlayersQueue /> : null}
      {vue === "professionnels" ? <ProfessionalsQueue /> : null}
      {vue === "justificatifs" ? <DocumentsQueue /> : null}
      {vue === "identite" ? <IdentityQueue /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ joueurs */

async function PlayersQueue() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_profiles")
    .select(
      "id, first_name, last_name, birth_date, country, city, main_position, level, created_at, updated_at",
    )
    .eq("status", "en_attente_validation")
    .order("updated_at", { ascending: true })
    .limit(100);

  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(rows.map((row) => row.id));

  // Etat du dossier KYC associe : sans lui, l'administrateur validerait a
  // l'aveugle un compte dont la piece d'identite est peut-etre refusee.
  const { data: verifications } = await supabase
    .from("identity_verifications")
    .select("id, player_id, status, document_type, storage_path, created_at")
    .in("player_id", rows.length ? rows.map((row) => row.id) : ["00000000-0000-0000-0000-000000000000"]);

  const kycByPlayer = new Map<string, NonNullable<typeof verifications>[number]>();
  for (const verification of verifications ?? []) {
    const current = kycByPlayer.get(verification.player_id);
    if (!current || verification.created_at > current.created_at) {
      kycByPlayer.set(verification.player_id, verification);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Profils joueurs en attente"
        description="Valider passe player_profiles.status a « valide » et ouvre l'acces a l'application."
      />
      {error ? <QueueError message={error.message} /> : null}
      {!rows.length && !error ? (
        <EmptyState
          icon={UserCheckIcon}
          title="Aucun profil joueur en attente"
          description="Les nouveaux dossiers apparaitront ici des qu'un joueur aura termine son etape KYC."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Joueur</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Localisation</TableHead>
              <TableHead>Poste</TableHead>
              <TableHead>Piece d&apos;identite</TableHead>
              <TableHead>Depose</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const profile = profiles.get(row.id);
              const kyc = kycByPlayer.get(row.id);
              const age = ageFromBirthDate(row.birth_date);

              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={displayName(profile, [row.first_name, row.last_name])}
                      secondary={profile?.email}
                      avatarUrl={profile?.avatar_url}
                      href={`/admin/utilisateurs/${row.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="tabular-nums">{age ?? "—"}</span>
                    {profile?.is_minor ? (
                      <StatusPill tone="warning" className="ml-2">
                        Mineur
                      </StatusPill>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[row.city, row.country].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.main_position ?? "—"}
                  </TableCell>
                  <TableCell>
                    {kyc ? (
                      <div className="flex items-center gap-2">
                        <StatusPill tone={entry(IDENTITY_STATUS, kyc.status).tone}>
                          {label(IDENTITY_STATUS, kyc.status)}
                        </StatusPill>
                        {kyc.storage_path ? (
                          <DocumentPreviewDialog
                            url={`/admin/documents?bucket=identity-documents&path=${encodeURIComponent(kyc.storage_path)}`}
                            label="Piece d'identite"
                            compact
                          />
                        ) : null}
                      </div>
                    ) : (
                      <StatusPill tone="neutral">Aucun dossier</StatusPill>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(row.updated_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <ActionButton action={setPlayerStatus.bind(null, row.id, "valide", undefined)}>
                        <CheckIcon />
                        Valider
                      </ActionButton>
                      <ReasonDialog
                        action={(reason) => setPlayerStatus(row.id, "incomplet", reason)}
                        trigger={<Button variant="outline" size="xs"><MessageSquareWarningIcon /> Demander une correction</Button>}
                        title="Demander des modifications"
                        description="Le profil repasse au statut incomplet et le joueur recoit le motif a corriger."
                        placeholder="Informations ou documents a corriger..."
                        submitLabel="Envoyer la demande"
                        destructive={false}
                      />
                      <ReasonDialog
                        action={(reason) => setPlayerStatus(row.id, "refuse", reason)}
                        trigger={
                          <Button variant="destructive" size="xs">
                            <XIcon />
                            Refuser
                          </Button>
                        }
                        title="Refuser ce profil joueur"
                        description="Le motif est enregistre dans player_profiles.status_reason et sert d'explication au joueur."
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
    </Panel>
  );
}

/* ----------------------------------------------------------- professionnels */

async function ProfessionalsQueue() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professional_profiles")
    .select(
      "id, professional_type, organization_name, contact_full_name, position_title, country, city, created_at, updated_at",
    )
    .eq("status", "en_attente_validation")
    .order("updated_at", { ascending: true })
    .limit(100);

  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(rows.map((row) => row.id));

  const { data: documents } = await supabase
    .from("professional_documents")
    .select("id, professional_id, document_label, storage_path, status")
    .in(
      "professional_id",
      rows.length ? rows.map((row) => row.id) : ["00000000-0000-0000-0000-000000000000"],
    );

  const docsByPro = new Map<string, NonNullable<typeof documents>>();
  for (const document of documents ?? []) {
    const list = docsByPro.get(document.professional_id) ?? [];
    list.push(document);
    docsByPro.set(document.professional_id, list);
  }

  return (
    <Panel>
      <PanelHeader
        title="Comptes professionnels en attente"
        description="Verifier les justificatifs avant de valider : un compte valide accede a la base joueurs."
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
              <TableHead>Type</TableHead>
              <TableHead>Organisation</TableHead>
              <TableHead>Localisation</TableHead>
              <TableHead>Justificatifs</TableHead>
              <TableHead>Depose</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const profile = profiles.get(row.id);
              const docs = docsByPro.get(row.id) ?? [];

              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={displayName(profile, [row.contact_full_name])}
                      secondary={profile?.email}
                      avatarUrl={profile?.avatar_url}
                      href={`/admin/utilisateurs/${row.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusPill tone="info">{label(PROFESSIONAL_TYPE, row.professional_type)}</StatusPill>
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {row.organization_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[row.city, row.country].filter(Boolean).join(", ") || "—"}
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
                  <TableCell className="text-muted-foreground">{timeAgo(row.updated_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <ActionButton
                        action={setProfessionalStatus.bind(null, row.id, "valide", undefined)}
                      >
                        <CheckIcon />
                        Valider
                      </ActionButton>
                      <ReasonDialog
                        action={(reason) => setProfessionalStatus(row.id, "incomplet", reason)}
                        trigger={<Button variant="outline" size="xs"><MessageSquareWarningIcon /> Demander une correction</Button>}
                        title="Demander des modifications"
                        description="Le compte repasse au statut incomplet et le professionnel recoit le motif a corriger."
                        placeholder="Justificatif ou information a corriger..."
                        submitLabel="Envoyer la demande"
                        destructive={false}
                      />
                      <ReasonDialog
                        action={(reason) => setProfessionalStatus(row.id, "refuse", reason)}
                        trigger={
                          <Button variant="destructive" size="xs">
                            <XIcon />
                            Refuser
                          </Button>
                        }
                        title="Refuser ce compte professionnel"
                        description="Le motif est enregistre dans professional_profiles.status_reason."
                        placeholder="Justificatif manquant, licence expiree…"
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
    </Panel>
  );
}

/* ------------------------------------------------------------ justificatifs */

async function DocumentsQueue() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professional_documents")
    .select("id, professional_id, document_label, storage_path, status, created_at")
    .eq("status", "en_attente")
    .order("created_at", { ascending: true })
    .limit(100);

  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(rows.map((row) => row.professional_id));

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
    </Panel>
  );
}

/* ----------------------------------------------------------------- identite */

async function IdentityQueue() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("identity_verifications")
    .select(
      "id, player_id, document_type, storage_path, status, facial_check_provider, facial_check_passed, created_at",
    )
    .eq("status", "en_attente")
    .order("created_at", { ascending: true })
    .limit(100);

  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(rows.map((row) => row.player_id));

  return (
    <Panel>
      <PanelHeader
        title="Pieces d'identite a examiner"
        description="Attention : cette file porte sur identity_verifications.status, un enum distinct du statut du profil joueur. Valider ici ne valide pas le compte — il faut aussi valider le profil dans la file « Profils joueurs »."
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
                      <ActionButton action={setIdentityStatus.bind(null, row.id, "valide", undefined)}>
                        <CheckIcon />
                        Valider la piece
                      </ActionButton>
                      <ReasonDialog
                        action={(reason) => setIdentityStatus(row.id, "refuse", reason)}
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
