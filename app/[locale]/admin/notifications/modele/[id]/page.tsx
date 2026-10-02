import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2Icon, StarIcon } from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmailTemplateForm } from "@/components/admin/email-template-form";
import { HeaderMeta, PageHeader } from "@/components/admin/page-header";
import {
  resetEmailTemplate,
  saveEmailBlocks,
  saveEmailTemplate,
  setDefaultEmailTemplate,
} from "@/lib/actions/email-template";
import { isSuperAdmin, requirePermission } from "@/lib/auth";
import { renderCampaignPreview } from "@/lib/email/preview";
import { getAdminI18n } from "@/lib/i18n/admin";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { fetchEmailTemplate } from "@/lib/queries/email-template";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/notifications/modele/[id]">): Promise<Metadata> {
  const i18n = await getAdminI18n();
  const { id } = await params;
  const detail = await fetchEmailTemplate(id);
  return { title: detail?.template.name ?? i18n.t("Modeles d'e-mail") };
}

export default async function EmailTemplateEditorPage({
  params,
}: PageProps<"/[locale]/admin/notifications/modele/[id]">) {
  const i18n = await getAdminI18n();

  await requirePermission("notifications.manage");
  const canEdit = await isSuperAdmin();
  const { id } = await params;

  const detail = await fetchEmailTemplate(id);
  // ⚠️ `notFound()` ici rend le 404 dans la coque d'administration, derriere
  // `requireAdmin()` — voir `app/[locale]/admin/[...reste]/page.tsx`.
  if (!detail) notFound();

  // Les trois apercus sont rendus d'avance : les onglets de langue sont un
  // etat client, et un aller-retour serveur par onglet rendrait le
  // basculement lent pour trois rendus de quelques millisecondes.
  const previews = Object.fromEntries(
    await Promise.all(
      LOCALES.map(async (locale) => [
        locale,
        await renderCampaignPreview(locale, detail.resolved[locale], detail.template.blocks),
      ]),
    ),
  ) as Record<Locale, string>;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: i18n.t("Communication"), href: i18n.path("/admin/notifications") },
          {
            label: i18n.t("Modeles d'e-mail"),
            href: i18n.path("/admin/notifications/modele"),
          },
          { label: detail.template.name },
        ]}
        title={detail.template.name}
        meta={
          detail.template.is_default ? (
            <HeaderMeta tone="brand" dot>
              {i18n.t("Par defaut")}
            </HeaderMeta>
          ) : canEdit ? null : (
            <HeaderMeta tone="neutral">{i18n.t("Lecture seule")}</HeaderMeta>
          )
        }
        description={
          detail.template.description ||
          i18n.t("Ce qui entoure le message d'une campagne : l'accueil, le bouton, la signature et le pied de page. Le titre et le texte, eux, s'ecrivent a chaque envoi.")
        }
        actions={
          canEdit && !detail.template.is_default ? (
            <ActionButton
              action={setDefaultEmailTemplate.bind(null, detail.template.id)}
              variant="outline"
              confirm={{
                title: i18n.t("Faire de ce modele le defaut ?"),
                description: i18n.t("Les diffusions qui ne choisissent pas de modele emploieront celui-ci."),
                actionLabel: i18n.t("Par defaut"),
              }}
            >
              <StarIcon />
              {i18n.t("Definir par defaut")}
            </ActionButton>
          ) : detail.template.is_default ? (
            <span className="micro-label inline-flex items-center gap-1.5 text-muted-foreground">
              <CheckCircle2Icon className="size-3.5 text-brand" />
              {i18n.t("Employe quand aucun modele n'est choisi")}
            </span>
          ) : null
        }
      />

      <EmailTemplateForm
        action={saveEmailTemplate.bind(null, detail.template.id)}
        resetAction={resetEmailTemplate.bind(null, detail.template.id)}
        blocksAction={saveEmailBlocks.bind(null, detail.template.id)}
        blocks={detail.template.blocks}
        locales={LOCALES}
        rows={detail.rows}
        defaults={detail.resolved}
        previews={previews}
        disabled={!canEdit}
      />
    </>
  );
}
