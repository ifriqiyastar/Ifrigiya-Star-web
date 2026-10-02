import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2Icon,
  CopyIcon,
  LanguagesIcon,
  LockIcon,
  MailIcon,
  PencilIcon,
  ShieldIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { NewTemplateDialog, RenameTemplateDialog } from "@/components/admin/email-template-dialogs";
import { NoteCards } from "@/components/admin/note-cards";
import { HeaderMeta, PageHeader } from "@/components/admin/page-header";
import { TemplateThumb } from "@/components/admin/email-template-thumb";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  duplicateEmailTemplate,
  renameEmailTemplate,
  setDefaultEmailTemplate,
} from "@/lib/actions/email-template";
import { isSuperAdmin, requirePermission } from "@/lib/auth";
import { renderCampaignPreview } from "@/lib/email/preview";
import { getAdminI18n } from "@/lib/i18n/admin";
import { LOCALES } from "@/lib/i18n/config";
import { fetchEmailTemplates, SHIPPED_TEMPLATE } from "@/lib/queries/email-template";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Modeles d'e-mail") };
}

export default async function EmailTemplatesPage() {
  const i18n = await getAdminI18n();

  await requirePermission("notifications.manage");
  const canEdit = await isSuperAdmin();
  const catalogue = await fetchEmailTemplates();

  // Une vignette par modele : le meme rendu que l'envoi, reduit. Trois ou
  // quatre rendus par ouverture d'ecran, c'est le prix d'une galerie qui
  // montre les modeles au lieu de les nommer.
  // En parallele : les rendus sont independants, et les enchainer ajoutait
  // leurs durees pour rien.
  const thumbs = new Map<string, string>(
    await Promise.all(
      catalogue.templates.map(async (template) => {
        const detail = catalogue.details.get(template.id);
        const html = detail ? await renderCampaignPreview("fr", detail.resolved.fr) : "";
        return [template.id, html] as const;
      }),
    ),
  );
  const shipped = catalogue.templates.length
    ? null
    : await renderCampaignPreview("fr", SHIPPED_TEMPLATE.resolved.fr);

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: i18n.t("Communication"), href: i18n.path("/admin/notifications") },
          { label: i18n.t("Modeles d'e-mail") },
        ]}
        title={i18n.t("Modeles d'e-mail")}
        meta={
          <HeaderMeta tone={canEdit ? "brand" : "neutral"} dot={canEdit}>
            {canEdit ? i18n.t("Super administrateur") : i18n.t("Lecture seule")}
          </HeaderMeta>
        }
        description={i18n.t("Chaque modele est un habillage : l'accueil, le bouton, la signature et le pied de page. Le titre et le texte s'ecrivent a chaque envoi, et la diffusion choisit le modele a employer.")}
        actions={
          canEdit && catalogue.available ? (
            <NewTemplateDialog action={createEmailTemplate} />
          ) : null
        }
      />

      {!catalogue.available ? (
        <section className="rounded-xl border border-warning/40 bg-card p-4">
          <p className="text-sm text-warning">
            {i18n.t("Appliquez la migration du modele d'e-mail pour personnaliser ces textes. En attendant, les courriels partent avec les textes livres, affiches ci-dessous.")}
          </p>
        </section>
      ) : null}

      {catalogue.templates.length ? (
        // Une galerie, pas un tableau : un modele se reconnait a ce qu'il a
        // l'air, et un nom dans une ligne ne dit rien de ce qui part.
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {catalogue.templates.map((template) => {
            const detail = catalogue.details.get(template.id);
            const customised = LOCALES.filter((locale) => detail?.rows[locale]);
            return (
              <article
                key={template.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card"
              >
                <TemplateThumb
                  html={thumbs.get(template.id) ?? ""}
                  label={i18n.t("Apercu du modele {0}", { "0": template.name })}
                />

                <div className="flex flex-1 flex-col gap-3 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">{template.name}</h2>
                      <p className="mt-0.5 line-clamp-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
                        {template.description || i18n.t("Aucune description")}
                      </p>
                    </div>
                    {template.is_default ? (
                      <span className="micro-label inline-flex shrink-0 items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-brand">
                        <CheckCircle2Icon className="size-3" />
                        {i18n.t("Par defaut")}
                      </span>
                    ) : null}
                  </div>

                  {/* Quelles langues sont personnalisees : les autres suivent
                      les textes livres, ce qui est une reponse et non un
                      manque — la pastille eteinte le dit sans le cacher. */}
                  <div className="flex flex-wrap items-center gap-1">
                    {LOCALES.map((locale) => (
                      <span
                        key={locale}
                        title={
                          customised.includes(locale)
                            ? i18n.t("Textes personnalises")
                            : i18n.t("Textes livres")
                        }
                        className={
                          customised.includes(locale)
                            ? "micro-label rounded bg-brand/12 px-1.5 py-0.5 text-brand"
                            : "micro-label rounded bg-secondary px-1.5 py-0.5 text-muted-foreground"
                        }
                      >
                        {locale}
                      </span>
                    ))}
                    {template.updated_at ? (
                      <span className="ml-auto text-[0.625rem] text-muted-foreground">
                        {i18n.format.formatDate(template.updated_at)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2.5">
                    <Link
                      href={i18n.path(`/admin/notifications/modele/${template.id}`)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-xs font-semibold hover:bg-accent/70"
                    >
                      <PencilIcon className="size-3.5" />
                      {canEdit ? i18n.t("Modifier") : i18n.t("Consulter")}
                    </Link>
                    {canEdit ? (
                      <>
                        <RenameTemplateDialog
                          action={renameEmailTemplate.bind(null, template.id)}
                          name={template.name}
                          description={template.description}
                        />
                        <ActionButton
                          action={duplicateEmailTemplate.bind(null, template.id)}
                          variant="ghost"
                        >
                          <CopyIcon />
                          {i18n.t("Dupliquer")}
                        </ActionButton>
                        {!template.is_default ? (
                          <>
                            <ActionButton
                              action={setDefaultEmailTemplate.bind(null, template.id)}
                              variant="ghost"
                            >
                              <StarIcon />
                              {i18n.t("Par defaut")}
                            </ActionButton>
                            <ActionButton
                              action={deleteEmailTemplate.bind(null, template.id)}
                              variant="ghost"
                              className="ml-auto text-destructive hover:text-destructive"
                              confirm={{
                                title: i18n.t("Supprimer ce modele ?"),
                                description: i18n.t("Ses textes sont supprimes avec lui. Les campagnes deja envoyees gardent leur trace."),
                                actionLabel: i18n.t("Supprimer"),
                              }}
                            >
                              <Trash2Icon />
                            </ActionButton>
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : catalogue.available ? (
        <EmptyState
          icon={MailIcon}
          title={i18n.t("Aucun modele")}
          description={i18n.t("Creez-en un pour personnaliser l'habillage des courriels. En attendant, les envois utilisent les textes livres.")}
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <p className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
            {i18n.t("Les textes livres, tels qu'ils partent aujourd'hui.")}
          </p>
          <TemplateThumb html={shipped ?? ""} label={i18n.t("Textes livres")} />
        </section>
      )}

      <NoteCards
        notes={[
          {
            icon: ShieldIcon,
            title: i18n.t("Du texte, jamais du HTML"),
            body: i18n.t("Chaque champ est insere comme du texte et echappe au rendu. C'est pourquoi l'ecran propose des champs nommes plutot qu'un editeur libre : une balise mal fermee casse la mise en page chez certains clients de messagerie, et un courriel part chez des milliers de personnes."),
          },
          {
            icon: LanguagesIcon,
            title: i18n.t("Une langue par destinataire"),
            body: i18n.t("Chaque compte recoit l'habillage de sa propre langue. L'arabe se lit de droite a gauche, et ce sens n'est pas modifiable : il decoule de la langue, pas d'une preference."),
          },
          {
            icon: LockIcon,
            title: i18n.t("Ce qui reste dans le code"),
            body: i18n.t("Les couleurs, les polices, le logo et la structure suivent la charte graphique du client : ce sont des contraintes, pas des reglages. L'adresse d'expedition reste sur le domaine verifie, sans quoi l'envoi serait refuse."),
          },
        ]}
      />
    </>
  );
}
