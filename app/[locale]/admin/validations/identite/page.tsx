import type { Metadata } from "next";
import {
  CheckIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { DetailDialog } from "@/components/admin/detail-dialog";
import { DocumentPreviewDialog } from "@/components/admin/document-preview-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { IdentityDossier } from "@/components/admin/validation-dossier";
import { QueueError, ValidationFilter, ValidationMetrics, ValidationNotes, validationStatus } from "@/components/admin/validations/pieces";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setIdentityStatus } from "@/lib/actions/users";
import { requirePermission } from "@/lib/auth";
import { getAdminI18n } from "@/lib/i18n/admin";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { EMPTY_ID, PAGE_SIZE } from "@/lib/queries/validations-shared";
import { createClient } from "@/lib/supabase/server";
import type { GuardianRow, IdentityRow } from "@/components/admin/validation-dossier";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Pieces d'identite") };
}

export default async function ValidationsIdentityPage({
  searchParams,
}: PageProps<"/[locale]/admin/validations/identite">) {
  const i18n = await getAdminI18n();
  await requirePermission("verifications.review");

  const resolved = await searchParams;
  const page = Math.max(1, Number(resolved.page ?? 1) || 1);
  const search =
    typeof resolved.q === "string" && resolved.q.trim() ? resolved.q.trim() : undefined;
  // L'etat demande, ramene a une valeur que la table connait — « en attente »
  // par defaut : c'est une file de travail, elle s'ouvre sur ce qui attend.
  const etat = validationStatus(
    "document",
    typeof resolved.etat === "string" ? resolved.etat : undefined,
  );
  const path = i18n.path("/admin/validations/identite");

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: i18n.t("Validations"), href: i18n.path("/admin/validations/joueurs") },
          { label: i18n.t("Pieces d'identite") },
        ]}
        title={i18n.t("Pieces d'identite a controler")}
        description={i18n.t("Le controle KYC, distinct de la validation du compte. Accepter une piece ne donne pas l'acces a l'application, et la refuser demande un motif transmis a l'interesse.")}
      />

      <ValidationMetrics />

      <ValidationFilter search={search} path={path} scope="document" etat={etat} />

      <IdentityQueue page={page} etat={etat} />

      <ValidationNotes />
    </>
  );
}

async function IdentityQueue({ page, etat }: { page: number; etat: string }) {
  const i18n = await getAdminI18n();

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("identity_verifications")
    .select(
      "id, player_id, document_type, storage_path, status, facial_check_provider, facial_check_passed, rejection_reason, created_at",
      { count: "exact" },
    )
    .eq("status", etat)
    .order("created_at", { ascending: false })
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
        title={i18n.t("Pieces d'identite a examiner")}
        description={i18n.t("Attention : cette file porte sur la revue des pieces d'identite, distincte du statut du profil joueur. Valider ici ne valide pas le compte — il faut aussi valider le profil dans la file « Profils joueurs ».")}
      />
      {error ? <QueueError message={error.message} /> : null}
      {!rows.length && !error ? (
        <EmptyState
          icon={ShieldCheckIcon}
          title={
            etat === "en_attente"
              ? i18n.t("Aucune piece d'identite en attente")
              : i18n.t("Aucun dossier dans cet etat")
          }
          description={
            etat === "en_attente"
              ? i18n.t("Les dossiers KYC deposes depuis l'application arriveront ici.")
              : i18n.t("Changez l'etat demande dans le bandeau ci-dessus pour retrouver les dossiers deja tranches.")
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t("Joueur")}</TableHead>
              <TableHead>{i18n.t("Type de piece")}</TableHead>
              <TableHead>{i18n.t("Controle facial")}</TableHead>
              <TableHead>{i18n.t("Depose")}</TableHead>
              <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const profile = profiles.get(row.player_id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={displayName(profile, undefined, i18n.locale)}
                      secondary={profile?.email}
                      avatarUrl={profile?.avatar_url}
                      href={i18n.path(`/admin/utilisateurs/${row.player_id}`)}
                    />
                  </TableCell>
                  <TableCell>
                    <DocumentPreviewDialog
                      url={i18n.path(`/admin/documents?bucket=identity-documents&path=${encodeURIComponent(row.storage_path)}`)}
                      label={row.document_type.toUpperCase()}
                    />
                  </TableCell>
                  <TableCell>
                    {row.facial_check_provider ? (
                      <StatusPill tone={row.facial_check_passed ? "success" : "danger"}>
                        {row.facial_check_passed ? i18n.t("Reussi") : i18n.t("Echoue")}
                      </StatusPill>
                    ) : (
                      <span className="text-xs text-muted-foreground">{i18n.t("Non realise")}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i18n.format.formatDateTime(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <DetailDialog
                        label={i18n.t("Dossier")}
                        title={i18n.t("Piece d'identite — {0}", { "0": displayName(profile, undefined, i18n.locale) })}
                        description={i18n.t("Le document et les informations declarees avec lesquelles il doit concorder.")}
                      >
                        <IdentityDossier
                          identity={row as IdentityRow}
                          profile={profile}
                          player={playerById.get(row.player_id)}
                          guardian={guardianByPlayer.get(row.player_id)}
                        />
                      </DetailDialog>
                      {/* Un geste qui ne peut rien changer n'est pas propose
                          — voir la file des joueurs. */}
                      {row.status === "valide" ? null : (
                        <ActionButton action={setIdentityStatus.bind(null, row.id, "valide", undefined)}>
                          <CheckIcon />
                          {i18n.t("Valider la piece")}
                        </ActionButton>
                      )}
                      {row.status === "refuse" ? null : (
                      <ReasonDialog
                        action={setIdentityStatus.bind(null, row.id, "refuse")}
                        trigger={
                          <Button variant="destructive" size="xs">
                            <XIcon />
                            {i18n.t("Refuser")}</Button>
                        }
                        title={i18n.t("Refuser cette piece d'identite")}
                        description={i18n.t("Le motif est enregistre dans identity_verifications.rejection_reason.")}
                        placeholder={i18n.t("Document expire, photo floue…")}
                        submitLabel={i18n.t("Refuser la piece")}
                      />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Pagination basePath={i18n.path("/admin/validations/identite")} params={{ vue: "identite", etat, page: String(page) }} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </Panel>
  );
}

