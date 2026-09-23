"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction, requirePermission } from "@/lib/auth";
import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { createClient } from "@/lib/supabase/server";
import { makeErrors, fail, ok, type ActionResult } from "@/lib/actions/result";
import { DEFAULT_BLOG_AUTHOR_NAME } from "@/lib/queries/blog";
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

  // Convertie cote client (voir `PostEditor`) : le `<input type="datetime-local">`
  // n'a pas de fuseau, et le resoudre ici prendrait le fuseau du serveur
  // (UTC sur Vercel) plutot que celui de l'administrateur. Le champ soumis
  // est donc deja un ISO 8601 complet, ou vide.
  const scheduledAtRaw = text(formData, "scheduled_at");
  const scheduledAt = scheduledAtRaw && !Number.isNaN(Date.parse(scheduledAtRaw)) ? scheduledAtRaw : null;
  const now = new Date();
  const isFutureSchedule = intent === "publie" && scheduledAt !== null && new Date(scheduledAt) > now;

  const payload = {
    title,
    slug,
    excerpt: text(formData, "excerpt"),
    meta_title: text(formData, "meta_title"),
    meta_description: text(formData, "meta_description"),
    cover_image_path: text(formData, "cover_image_path"),
    // Repli fixe a la demande du client, pas l'identite de l'administrateur
    // connecte (`profiles.full_name` et l'e-mail restent modifiables dans le
    // champ pour qui veut vraiment signer sous son nom) : un champ laisse
    // vide publie sous "Administrateur Ifriqiya Soccer Star".
    author_name: text(formData, "author_name") || DEFAULT_BLOG_AUTHOR_NAME,
    category: text(formData, "category"),
    content,
    // La date programmee est conservee meme en brouillon, pour ne pas faire
    // perdre le choix d'une date pas encore confirmee par un "Publier".
    scheduled_at: scheduledAt,
    updated_at: now.toISOString(),
  };

  if (id) {
    const { data: previous } = await supabase
      .from("blog_posts")
      .select("title, status, published_at, scheduled_at")
      .eq("id", id)
      .maybeSingle();

    // Deja visible du public au moment de cette ecriture — soit franchement
    // `publie`, soit `programme` mais echu (cf. `effectiveBlogStatus()`,
    // `lib/queries/blog.ts`). Dans les deux cas, republier ne doit pas
    // avancer sa date de publication.
    const wasEffectivelyPublished =
      previous?.status === "publie" ||
      (previous?.status === "programme" && Boolean(previous.published_at) && new Date(previous.published_at!) <= now);

    const nextStatus = intent === "brouillon" ? "brouillon" : isFutureSchedule ? "programme" : "publie";
    const nextPublishedAt =
      intent === "brouillon"
        ? (previous?.published_at ?? null)
        : isFutureSchedule
          ? scheduledAt
          : wasEffectivelyPublished && previous?.published_at
            ? previous.published_at
            : now.toISOString();

    const { data: updated, error } = await supabase
      .from("blog_posts")
      .update({ ...payload, status: nextStatus, published_at: nextPublishedAt })
      .eq("id", id)
      .select("id");
    if (error) {
      if (error.code === "23505") return fail(i18n.t("Cette adresse est deja utilisee par un autre article."));
      return fail(makeErrors(i18n.locale).describeError(error));
    }
    if (!touched(updated)) {
      return fail(i18n.t("Aucune ligne modifiee : l'article n'existe plus, ou le RLS ne vous laisse pas l'ecrire."));
    }
    await logAdminAction("update_blog_post", "blog_post", id, { previous, next: { ...payload, status: nextStatus, published_at: nextPublishedAt } });
    REFRESH();
    return ok(
      nextStatus === "programme"
        ? i18n.t("Article programme.")
        : nextStatus === "publie"
          ? i18n.t("Article publie.")
          : i18n.t("Brouillon enregistre."),
    );
  }

  const status = intent === "brouillon" ? "brouillon" : isFutureSchedule ? "programme" : "publie";
  const published_at = intent === "brouillon" ? null : isFutureSchedule ? scheduledAt : now.toISOString();

  const { data, error } = await supabase
    .from("blog_posts")
    .insert({ ...payload, status, published_at, author_id: admin.userId })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return fail(i18n.t("Cette adresse est deja utilisee par un autre article."));
    return fail(makeErrors(i18n.locale).describeError(error));
  }
  await logAdminAction("create_blog_post", "blog_post", data.id, { ...payload, status, published_at, createdByAdmin: admin.userId });
  REFRESH();
  return ok(
    status === "programme"
      ? i18n.t("Article programme.")
      : status === "publie"
        ? i18n.t("Article publie.")
        : i18n.t("Brouillon enregistre."),
  );
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

/**
 * Depublier : retour en brouillon sans toucher au contenu. Sert aussi a
 * annuler une publication programmee (`status = 'programme'`) — dans ce cas,
 * `published_at` n'a jamais ete reel : on l'efface avec `scheduled_at`
 * plutot que de laisser une date de publication qui n'a jamais eu lieu. Un
 * article deja effectivement publie garde la sienne, comme avant.
 */
export async function unpublishBlogPost(id: string): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  await requirePermission("blog.manage");
  const supabase = await createClient();

  const { data: previous } = await supabase
    .from("blog_posts")
    .select("status, published_at")
    .eq("id", id)
    .maybeSingle();
  const wasEffectivelyPublished =
    previous?.status === "publie" ||
    (previous?.status === "programme" && Boolean(previous.published_at) && new Date(previous.published_at!) <= new Date());

  const { data: updated, error } = await supabase
    .from("blog_posts")
    .update({
      status: "brouillon",
      scheduled_at: null,
      published_at: wasEffectivelyPublished ? previous!.published_at : null,
      updated_at: new Date().toISOString(),
    })
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
