import { resolveEmailCopy, type EmailTemplateRow, type ResolvedEmailCopy } from "@/emails/copy";
import { DEFAULT_BLOCKS, normalizeBlocks, type EmailBlock } from "@/lib/email/blocks";
import { SITE_URL } from "@/lib/email/campaign";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Les modeles d'e-mail : le catalogue, et les textes de chacun.
 *
 * ⚠️ **Toutes les lectures sont tolerantes a l'absence des tables.** Sur un
 * projet ou `202609300003` / `202609300004` ne sont pas appliquees, PostgREST
 * repond `PGRST205` : les fonctions rendent alors un catalogue vide, et
 * `resolveEmailCopy(locale, null, …)` retombe sur les textes livres. Une
 * diffusion doit partir sur une installation sans ces tables — c'est de la
 * personnalisation, pas une dependance.
 */

export type EmailTemplate = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  updated_at: string | null;
  /** Deja normalise : rien ne doit etre rendu depuis la colonne brute. */
  blocks: EmailBlock[];
};

export type EmailTemplateDetail = {
  template: EmailTemplate;
  /** Une entree par langue : `null` = cette langue suit les textes livres. */
  rows: Record<Locale, EmailTemplateRow | null>;
  resolved: Record<Locale, ResolvedEmailCopy>;
};

const emptyRows = () =>
  Object.fromEntries(LOCALES.map((locale) => [locale, null])) as Record<
    Locale,
    EmailTemplateRow | null
  >;

const resolveAll = (rows: Record<Locale, EmailTemplateRow | null>) =>
  Object.fromEntries(
    LOCALES.map((locale) => [locale, resolveEmailCopy(locale, rows[locale], SITE_URL)]),
  ) as Record<Locale, ResolvedEmailCopy>;

/** Le modele livre, quand aucun n'existe encore en base. */
export const SHIPPED_TEMPLATE: EmailTemplateDetail = {
  template: {
    id: "",
    name: "",
    description: null,
    is_default: true,
    updated_at: null,
    blocks: DEFAULT_BLOCKS,
  },
  rows: emptyRows(),
  resolved: resolveAll(emptyRows()),
};

export type EmailTemplateCatalogue = {
  templates: EmailTemplate[];
  /** Les textes de chaque modele, indexes par identifiant. */
  details: Map<string, EmailTemplateDetail>;
  /** Faux = les tables ne sont pas en place ; l'ecran n'offre pas d'editer. */
  available: boolean;
};

export async function fetchEmailTemplates(): Promise<EmailTemplateCatalogue> {
  const supabase = await createClient();

  const [catalogue, texts] = await Promise.all([
    supabase
      .from("admin_email_templates")
      .select("id, name, description, is_default, updated_at, blocks")
      // Le modele par defaut en tete : c'est celui qu'on regarde en premier.
      .order("is_default", { ascending: false })
      .order("name"),
    supabase.from("admin_email_template").select("*"),
  ]);

  if (catalogue.error) {
    return { templates: [], details: new Map(), available: false };
  }

  const byTemplate = new Map<string, Record<Locale, EmailTemplateRow | null>>();
  for (const row of (texts.data ?? []) as (EmailTemplateRow & { template_id: string })[]) {
    const locale = row.locale as Locale;
    if (!(LOCALES as readonly string[]).includes(locale)) continue;
    const bucket = byTemplate.get(row.template_id) ?? emptyRows();
    bucket[locale] = row;
    byTemplate.set(row.template_id, bucket);
  }

  // ⚠️ Normalise a la lecture, une fois pour toutes : aucun appelant ne doit
  // pouvoir rendre la colonne brute par inadvertance.
  const templates = ((catalogue.data ?? []) as EmailTemplate[]).map((row) => ({
    ...row,
    blocks: normalizeBlocks(row.blocks),
  }));
  const details = new Map<string, EmailTemplateDetail>();
  for (const template of templates) {
    const rows = byTemplate.get(template.id) ?? emptyRows();
    details.set(template.id, { template, rows, resolved: resolveAll(rows) });
  }

  return { templates, details, available: true };
}

export async function fetchEmailTemplate(id: string): Promise<EmailTemplateDetail | null> {
  const supabase = await createClient();

  const [one, texts] = await Promise.all([
    supabase
      .from("admin_email_templates")
      .select("id, name, description, is_default, updated_at, blocks")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("admin_email_template").select("*").eq("template_id", id),
  ]);

  if (one.error || !one.data) return null;

  const rows = emptyRows();
  for (const row of (texts.data ?? []) as EmailTemplateRow[]) {
    const locale = row.locale as Locale;
    if ((LOCALES as readonly string[]).includes(locale)) rows[locale] = row;
  }

  const template = one.data as EmailTemplate;
  return {
    template: { ...template, blocks: normalizeBlocks(template.blocks) },
    rows,
    resolved: resolveAll(rows),
  };
}

/**
 * L'habillage a employer pour une diffusion.
 *
 * ⚠️ `templateId` absent ou introuvable retombe sur le modele par defaut,
 * puis sur les textes livres — jamais sur une erreur. Une campagne ne doit
 * pas echouer parce qu'un modele a ete supprime entre la redaction et
 * l'envoi.
 */
export async function fetchCopyForSend(
  templateId: string | null,
): Promise<{ id: string | null; copy: Record<Locale, ResolvedEmailCopy>; blocks: EmailBlock[] }> {
  const catalogue = await fetchEmailTemplates();
  if (!catalogue.available || !catalogue.templates.length) {
    return { id: null, copy: SHIPPED_TEMPLATE.resolved, blocks: DEFAULT_BLOCKS };
  }
  const chosen =
    (templateId && catalogue.details.get(templateId)) ||
    catalogue.details.get(
      (catalogue.templates.find((row) => row.is_default) ?? catalogue.templates[0]).id,
    );
  return chosen
    ? { id: chosen.template.id, copy: chosen.resolved, blocks: chosen.template.blocks }
    : { id: null, copy: SHIPPED_TEMPLATE.resolved, blocks: DEFAULT_BLOCKS };
}
