import type { Metadata } from "next";
import {
  CheckIcon,
  FileTextIcon,
  XIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { DetailDialog } from "@/components/admin/detail-dialog";
import { DocumentPreviewDialog } from "@/components/admin/document-preview-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { DocumentDossier } from "@/components/admin/validation-dossier";
import { QueueError, ValidationFilter, ValidationMetrics, ValidationNotes } from "@/components/admin/validations/pieces";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setDocumentStatus } from "@/lib/actions/users";
import { requirePermission } from "@/lib/auth";
import { getAdminI18n } from "@/lib/i18n/admin";
import { DOCUMENT_STATUS } from "@/lib/labels";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { EMPTY_ID, PAGE_SIZE, groupBy } from "@/lib/queries/validations-shared";
import { createClient } from "@/lib/supabase/server";
import type { ProDocumentRow } from "@/components/admin/validation-dossier";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Justificatifs pro") };
}

export default async function ValidationsDocumentsPage({
  searchParams,
}: PageProps<"/[locale]/admin/validations/justificatifs">) {
  const i18n = await getAdminI18n();
  await requirePermission("verifications.review");

  const resolved = await searchParams;
  const page = Math.max(1, Number(resolved.page ?? 1) || 1);
  const search =
    typeof resolved.q === "string" && resolved.q.trim() ? resolved.q.trim() : undefined;
  const path = i18n.path("/admin/validations/justificatifs");

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: i18n.t("Validations"), href: i18n.path("/admin/validations/joueurs") },
          { label: i18n.t("Justificatifs pro") },
        ]}
        title={i18n.t("Justificatifs professionnels")}
        description={i18n.t("Les pieces deposees a l'appui d'un compte professionnel. Les accepter ne valide pas le compte : les deux gestes sont volontairement separes.")}
      />

      <ValidationMetrics />

      <ValidationFilter search={search} path={path} />

      <DocumentsQueue page={page} />

      <ValidationNotes />
    </>
  );
}

async function DocumentsQueue({ page }: { page: number }) {
  const i18n = await getAdminI18n();

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
        title={i18n.t("Justificatifs professionnels a examiner")}
        description={i18n.t("Statut par piece. Un compte peut rester en attente tant qu'une piece n'est pas tranchee.")}
      />
      {error ? <QueueError message={error.message} /> : null}
      {!rows.length && !error ? (
        <EmptyState
          icon={FileTextIcon}
          title={i18n.t("Aucun justificatif en attente")}
          description={i18n.t("Toutes les pieces deposees ont ete examinees.")}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t("Compte")}</TableHead>
              <TableHead>{i18n.t("Piece")}</TableHead>
              <TableHead>{i18n.t("Statut")}</TableHead>
              <TableHead>{i18n.t("Depose")}</TableHead>
              <TableHead className="text-right">{i18n.t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const profile = profiles.get(row.professional_id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <UserCell
                      name={displayName(profile, undefined, i18n.locale)}
                      secondary={profile?.email}
                      avatarUrl={profile?.avatar_url}
                      href={i18n.path(`/admin/utilisateurs/${row.professional_id}`)}
                    />
                  </TableCell>
                  <TableCell>
                    <DocumentPreviewDialog
                      url={i18n.path(`/admin/documents?bucket=professional-documents&path=${encodeURIComponent(row.storage_path)}`)}
                      label={row.document_label}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={i18n.labels.entry(DOCUMENT_STATUS, row.status).tone}>
                      {i18n.labels.label(DOCUMENT_STATUS, row.status)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{i18n.format.timeAgo(row.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <DetailDialog
                        label={i18n.t("Dossier")}
                        title={i18n.t("Justificatif — {0}", { "0": row.document_label })}
                        description={i18n.t("La piece, le compte qui l'a deposee, et les autres pieces du meme dossier.")}
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
                        {i18n.t("Valider")}</ActionButton>
                      <ActionButton
                        variant="destructive"
                        action={setDocumentStatus.bind(null, row.id, "refuse")}
                      >
                        <XIcon />
                        {i18n.t("Refuser")}</ActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Pagination basePath={i18n.path("/admin/validations/justificatifs")} params={{ vue: "justificatifs", page: String(page) }} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </Panel>
  );
}

/* ----------------------------------------------------------------- identite */

