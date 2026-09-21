"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction, requirePermission } from "@/lib/auth";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { createClient } from "@/lib/supabase/server";
import { makeErrors, fail, ok, type ActionResult } from "@/lib/actions/result";
import { slugify } from "@/lib/slugify";

const REFRESH = () => {
  revalidatePath("/[locale]/admin", "layout");
  // Le blog public lit la meme table : un article publie ou depublie doit se
  // voir immediatement, pas seulement au prochain redeploiement.
  revalidatePath("/[locale]/blog", "layout");
};

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

/**
 * Une ecriture qui ne touche aucune ligne reussit sans rien dire cote
 * PostgREST quand la RLS filtre la ligne visee — meme piege que
 * `lib/actions/scout-days.ts`, meme remede : `.select("id")` force la
 * reponse a nommer les lignes reellement touchees.
 */
const touched = (rows: { id: string }[] | null) => (rows?.length ?? 0) > 0;

/**
 * Cree ou met a jour un article (presence de `id` dans le formulaire), et
 * decide de son statut a partir du bouton effectivement clique
 * (`intent` = `brouillon` ou `publie`) — un seul formulaire, deux
 * destinations, comme `saveScoutDay()`.
 */
export async function saveBlogPost(formData: FormData): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  const admin = await requirePermission("blog.manage");
  const supabase = await createClient();

  const id = text(formData, "id");
  const title = text(formData, "title");
  const intent = text(formData, "intent") === "publie" ? "publie" : "brouillon";
  const contentRaw = text(formData, "content");

  if (!title) return fail(i18n.t("Le titre est obligatoire."));
  if (!contentRaw) return fail(i18n.t("Le corps de l'article est vide."));

  let content: object;
  try {
    content = JSON.parse(contentRaw);
  } catch {
    return fail(i18n.t("Le contenu de l'article est illisible : rechargez la page."));
  }

  let slug = text(formData, "slug") ?? slugify(title);
  slug = slugify(slug);
  if (!slug) return fail(i18n.t("Impossible de generer une adresse pour ce titre."));

  const payload = {
    title,
    slug,
    excerpt: text(formData, "excerpt"),
    cover_image_path: text(formData, "cover_image_path"),
    content,
    status: intent,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data: previous } = await supabase
      .from("blog_posts")
      .select("title, status, published_at")
      .eq("id", id)
      .maybeSingle();

    const { data: updated, error } = await supabase
      .from("blog_posts")
      .update({
        ...payload,
        // `published_at` ne se pose qu'une fois : republier un article deja
        // publie ne doit pas lui donner une date de publication plus recente.
        published_at:
          intent === "publie" && previous?.published_at
            ? previous.published_at
            : intent === "publie"
              ? new Date().toISOString()
              : previous?.published_at ?? null,
      })
      .eq("id", id)
      .select("id");
    if (error) {
      if (error.code === "23505") return fail(i18n.t("Cette adresse est deja utilisee par un autre article."));
      return fail(makeErrors(i18n.locale).describeError(error));
    }
    if (!touched(updated)) {
      return fail(i18n.t("Aucune ligne modifiee : l'article n'existe plus, ou le RLS ne vous laisse pas l'ecrire."));
    }
    await logAdminAction("update_blog_post", "blog_post", id, { previous, next: payload });
    REFRESH();
    return ok(intent === "publie" ? i18n.t("Article publie.") : i18n.t("Brouillon enregistre."));
  }

  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      ...payload,
      author_id: admin.userId,
      // Copie figee au moment de la creation (migration 202609230001) :
      // `requireAdmin()` l'a deja lu, pas besoin d'une requete de plus, et le
      // site public peut l'afficher sans jamais avoir a lire `profiles`.
      author_name: admin.fullName,
      published_at: intent === "publie" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return fail(i18n.t("Cette adresse est deja utilisee par un autre article."));
    return fail(makeErrors(i18n.locale).describeError(error));
  }
  await logAdminAction("create_blog_post", "blog_post", data.id, { ...payload, createdByAdmin: admin.userId });
  REFRESH();
  return ok(intent === "publie" ? i18n.t("Article publie.") : i18n.t("Brouillon enregistre."));
}

export async function deleteBlogPost(id: string): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  await requirePermission("blog.manage");
  const supabase = await createClient();

  const { data: deleted, error } = await supabase.from("blog_posts").delete().eq("id", id).select("id");
  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  if (!touched(deleted)) return fail(i18n.t("Cet article n'existe deja plus."));

  await logAdminAction("delete_blog_post", "blog_post", id, {});
  REFRESH();
  return ok(i18n.t("Article supprime."));
}

/** Depublier : retour en brouillon sans toucher au contenu. */
export async function unpublishBlogPost(id: string): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  await requirePermission("blog.manage");
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("blog_posts")
    .update({ status: "brouillon", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  if (!touched(updated)) {
    return fail(i18n.t("Aucune ligne modifiee : l'article n'existe plus, ou le RLS ne vous laisse pas l'ecrire."));
  }
  await logAdminAction("unpublish_blog_post", "blog_post", id, {});
  REFRESH();
  return ok(i18n.t("Article depublie."));
}
