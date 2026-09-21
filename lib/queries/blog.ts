import { createClient } from "@/lib/supabase/server";
import type { BlogPostStatus } from "@/lib/labels";

export const BLOG_PAGE_SIZE = 20;

export type BlogPostListRow = {
  id: string;
  title: string;
  slug: string;
  status: BlogPostStatus;
  cover_image_path: string | null;
  published_at: string | null;
  updated_at: string;
};

/** Liste des articles pour l'ecran d'administration, avec recherche, filtre de statut et pagination. */
export async function listBlogPosts(params: { q?: string; statut?: string; page?: number }) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);

  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, status, cover_image_path, published_at, updated_at", {
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
  cover_image_path: string | null;
  content: object;
  status: BlogPostStatus;
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Un article par id, pour l'ecran d'edition — brouillon ou publie, l'administration voit tout. */
export async function getBlogPostById(id: string): Promise<BlogPostRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
  return (data as BlogPostRecord | null) ?? null;
}
