import type { Metadata } from "next";
import {
  CheckIcon,
  MessageSquareWarningIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { DocumentPreviewDialog } from "@/components/admin/document-preview-dialog";
import { ComplianceList, DossierRail } from "@/components/admin/dossier-rail";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { ProfessionalDossier } from "@/components/admin/validation-dossier";
import { QueueError, ValidationFilter, ValidationMetrics, ValidationNotes } from "@/components/admin/validations/pieces";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setProfessionalStatus } from "@/lib/actions/users";
import { requirePermission } from "@/lib/auth";
import { getAdminI18n } from "@/lib/i18n/admin";
import { PROFESSIONAL_TYPE } from "@/lib/labels";
import { displayName, fetchProfilesByIds } from "@/lib/queries/profiles";
import { EMPTY_ID, PAGE_SIZE } from "@/lib/queries/validations-shared";
import { createClient } from "@/lib/supabase/server";
import type { ProDocumentRow } from "@/components/admin/validation-dossier";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Comptes professionnels") };
}

export default async function ValidationsProsPage({
  searchParams,
}: PageProps<"/[locale]/admin/validations/professionnels">) {
  const i18n = await getAdminI18n();
  await requirePermission("verifications.review");

  const resolved = await searchParams;
  const page = Math.max(1, Number(resolved.page ?? 1) || 1);
  const selected = typeof resolved.dossier === "string" ? resolved.dossier : undefined;
  const search =
    typeof resolved.q === "string" && resolved.q.trim() ? resolved.q.trim() : undefined;
  const path = i18n.path("/admin/validations/professionnels");

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: i18n.t("Validations"), href: i18n.path("/admin/validations/joueurs") },
          { label: i18n.t("Comptes professionnels") },
        ]}
        title={i18n.t("Comptes professionnels a valider")}
        description={i18n.t("Les clubs, academies, agents et recruteurs en attente. Un professionnel valide peut organiser des Scout Days et signer des evaluations.")}
      />

      <ValidationMetrics />

      <ValidationFilter search={search} path={path} />

      <ProfessionalsQueue page={page} selected={selected} search={search} />

      <ValidationNotes />
    </>
  );
}

async function ProfessionalsQueue({
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
  let query = supabase
    .from("professional_profiles")
    .select(
      "id, professional_type, organization_name, contact_full_name, position_title, country, city, status, status_reason, created_at, updated_at",
      { count: "exact" },
    )
    .eq("status", "en_attente_validation")
    .order("updated_at", { ascending: false })
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
    i18n.path(`/admin/validations/professionnels?page=${page}${search ? `&q=${encodeURIComponent(search)}` : ""}&dossier=${id}`);

  return (
    // Meme traitement que la file des joueurs : la liste occupe toute la
    // largeur, le dossier se lit dessous.
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader
          icon={ShieldCheckIcon}
          title={i18n.t("Comptes professionnels en attente")}
          description={i18n.t("Verifier les justificatifs avant de valider : un compte valide accede a la base joueurs. Ouvrir une ligne charge son dossier a droite.")}
        />
        {error ? <QueueError message={error.message} /> : null}
        {!rows.length && !error ? (
          <EmptyState
            icon={ShieldCheckIcon}
            title={i18n.t("Aucun compte professionnel en attente")}
            description={i18n.t("Les dossiers arrivent ici apres l'upload des justificatifs professionnels.")}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18n.t("Contact")}</TableHead>
                <TableHead>{i18n.t("Type / organisation")}</TableHead>
                <TableHead>{i18n.t("Justificatifs")}</TableHead>
                <TableHead>{i18n.t("Depose")}</TableHead>
                <TableHead className="text-right">{i18n.t("Decision rapide")}</TableHead>
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
                        name={displayName(profile, [row.contact_full_name], i18n.locale)}
                        secondary={profile?.email}
                        avatarUrl={profile?.avatar_url}
                        href={dossierHref(row.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusPill tone="info">
                        {i18n.labels.label(PROFESSIONAL_TYPE, row.professional_type)}
                      </StatusPill>
                      <span className="mt-1 block max-w-48 truncate text-xs text-muted-foreground">
                        {row.organization_name ?? i18n.t("Organisation non renseignee")}
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
                              url={i18n.path(`/admin/documents?bucket=professional-documents&path=${encodeURIComponent(document.storage_path)}`)}
                              label={document.document_label}
                            />
                          ))}
                        </div>
                      ) : (
                        <StatusPill tone="warning">{i18n.t("Aucun document")}</StatusPill>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i18n.format.timeAgo(row.updated_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <ActionButton
                          action={setProfessionalStatus.bind(null, row.id, "valide", undefined)}
                        >
                          <CheckIcon />
                          {i18n.t("Valider")}</ActionButton>
                        <ReasonDialog
                          action={setProfessionalStatus.bind(null, row.id, "refuse")}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={i18n.t("Refuser ce compte")}>
                              <XIcon className="text-destructive" />
                            </Button>
                          }
                          title={i18n.t("Refuser ce compte professionnel")}
                          description={i18n.t("Le motif est enregistre sur le compte et transmis au professionnel.")}
                          placeholder={i18n.t("Justificatif non conforme, structure non identifiee…")}
                          submitLabel={i18n.t("Refuser le compte")}
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
          basePath={i18n.path("/admin/validations/professionnels")}
          params={{ vue: "professionnels", q: search, page: String(page) }}
          page={page}
          pageSize={PAGE_SIZE}
          total={count ?? 0}
        />
      </Panel>

      {active ? (
        <DossierRail
          reference={i18n.t("Dossier actif · {0}", { "0": active.id.slice(0, 8) })}
          title={active.organization_name ?? displayName(activeProfile, [active.contact_full_name], i18n.locale)}
          status={
            <StatusPill tone={activeDocs.length ? "warning" : "danger"}>
              {activeDocs.length
                ? i18n.t("{0} piece(s) a examiner", { "0": activeDocs.length })
                : i18n.t("Aucune piece deposee")}
            </StatusPill>
          }
          actions={
            <>
              <ActionButton
                className="w-full justify-center"
                action={setProfessionalStatus.bind(null, active.id, "valide", undefined)}
              >
                <CheckIcon />
                {i18n.t("Valider et notifier le compte")}</ActionButton>
              <div className="grid grid-cols-2 gap-2">
                <ReasonDialog
                  action={setProfessionalStatus.bind(null, active.id, "incomplet")}
                  trigger={
                    <Button variant="outline" size="xs" className="w-full">
                      <MessageSquareWarningIcon />
                      {i18n.t("Demander une piece")}</Button>
                  }
                  title={i18n.t("Demander des modifications")}
                  description={i18n.t("Le compte repasse au statut incomplet et le professionnel recoit le motif a corriger.")}
                  placeholder={i18n.t("Justificatif ou information a corriger...")}
                  submitLabel={i18n.t("Envoyer la demande")}
                  destructive={false}
                />
                <ReasonDialog
                  action={setProfessionalStatus.bind(null, active.id, "refuse")}
                  trigger={
                    <Button variant="destructive" size="xs" className="w-full">
                      <XIcon />
                      {i18n.t("Rejeter le compte")}</Button>
                  }
                  title={i18n.t("Refuser ce compte professionnel")}
                  description={i18n.t("Le motif est enregistre sur le compte et transmis au professionnel.")}
                  placeholder={i18n.t("Justificatif non conforme, structure non identifiee…")}
                  submitLabel={i18n.t("Refuser le compte")}
                />
              </div>
            </>
          }
          footnote={i18n.t("Un compte professionnel valide accede a la base joueurs et peut ouvrir un Scout Day. Valider la structure et valider ses pieces sont deux gestes distincts : le statut du compte est celui que lit l'application.")}
        >
          <ComplianceList
            items={[
              {
                label: i18n.t("Justificatifs deposes"),
                verdict: i18n.t("{0} piece(s)", { "0": activeDocs.length }),
                tone: activeDocs.length ? "success" : "danger",
              },
              {
                label: i18n.t("Piece refusee au dossier"),
                verdict: activeDocs.some((doc) => doc.status === "refuse")
                  ? i18n.t("Oui — a reexaminer")
                  : i18n.t("Aucune"),
                tone: activeDocs.some((doc) => doc.status === "refuse") ? "danger" : "success",
              },
              {
                label: i18n.t("Organisation renseignee"),
                verdict: active.organization_name ? i18n.t("Oui") : i18n.t("Manquante"),
                tone: active.organization_name ? "success" : "warning",
              },
              {
                label: i18n.t("Localisation"),
                verdict: [active.city, active.country].filter(Boolean).join(", ") || i18n.t("Non renseignee"),
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

