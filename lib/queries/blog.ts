import { createClient } from "@/lib/supabase/server";
import type { BlogPostStatus } from "@/lib/labels";

export const BLOG_PAGE_SIZE = 20;

/**
 * Repli final du champ Auteur. `requireAdmin()` renvoie normalement un nom
 * ou, a defaut, un e-mail — mais certains comptes admin (promus a la main en
 * SQL, cf. README) n'ont ni l'un ni l'autre de renseigne de facon lisible.
 * Plutot que de laisser le champ vide sans explication, on propose ce nom
 * generique : l'administrateur reste libre de le remplacer par le sien.
 */
export const DEFAULT_BLOG_AUTHOR_NAME = "Administrateur Ifriqiya Soccer Star";

export type BlogPostListRow = {
  id: string;
  title: string;
  slug: string;
  status: BlogPostStatus;
  cover_image_path: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  updated_at: string;
  author_name: string | null;
};

/**
 * Statut reellement visible du public, calcule a la volee. `status` reste
 * `programme` en base tant que personne ne resauvegarde l'article
 * (`saveBlogPost()` est le seul endroit qui le fait basculer a `publie`) —
 * la regle RLS (202609230002) rend deja l'article visible des que
 * `scheduled_at` est atteinte, donc l'afficher comme « Programme » passe
 * cette echeance montrerait un statut faux. Utilise par l'ecran de liste
 * uniquement : `saveBlogPost()` raisonne directement sur `published_at`,
 * pas sur ce calcul.
 */
export function effectiveBlogStatus(row: { status: BlogPostStatus; scheduled_at: string | null }): BlogPostStatus {
  if (row.status === "programme" && row.scheduled_at && new Date(row.scheduled_at) <= new Date()) {
    return "publie";
  }
  return row.status;
}

/** Liste des articles pour l'ecran d'administration, avec recherche, filtre de statut et pagination. */
export async function listBlogPosts(params: { q?: string; statut?: string; page?: number }) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);

  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, status, cover_image_path, published_at, scheduled_at, updated_at, author_name", {
      count: "exact",
    })
    .order("updated_at", { ascending: false });

  if (params.statut) query = query.eq("status", params.statut);
  if (params.q) {
    const term = params.q.replace(/[%,()]/g, " ").trim();
    if (term) query = query.ilike("title", `%${term}%`);
  }

  const from = (page - 1) * BLOG_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + BLOG_PAGE_SIZE - 1);

  return { rows: (data ?? []) as BlogPostListRow[], count: count ?? 0, error };
}

export type BlogPostRecord = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  cover_image_path: string | null;
  content: object;
  status: BlogPostStatus;
  author_id: string | null;
  author_name: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Un article par id, pour l'ecran d'edition — brouillon ou publie, l'administration voit tout. */
export async function getBlogPostById(id: string): Promise<BlogPostRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
  return (data as BlogPostRecord | null) ?? null;
}
