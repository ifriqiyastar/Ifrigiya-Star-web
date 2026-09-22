import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Lectures publiques du blog. Le filtre `.or(...)` ci-dessous n'est pas la
 * seule barriere : c'est `blog_posts_public_read`
 * (`supabase/migrations/202609230002_blog_scheduling_seo.sql`) qui l'impose
 * reellement — un visiteur anonyme n'a de toute facon jamais acces a un
 * brouillon ou a un article programme pas encore echu, meme si cette clause
 * etait retiree d'ici. On la reecrit quand meme cote application pour ne pas
 * *demander* des lignes que RLS retiendrait de toute facon.
 */
const PUBLIC_STATUS_FILTER = () =>
  `status.eq.publie,and(status.eq.programme,scheduled_at.lte.${new Date().toISOString()})`;

export type PublicBlogPostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_path: string | null;
  published_at: string | null;
  /** Copie figee au moment de la creation (migration 202609230001) — jamais lue depuis `profiles`, inaccessible a une session anonyme. */
  author_name: string | null;
};

/**
 * Pagine : 6 articles par page sur telephone, 12 sur ordinateur
 * (`lib/server-device.ts` decide laquelle, avant la requete — la taille de
 * page change le nombre de lignes ramenees, pas seulement leur mise en page).
 */
export async function listPublishedBlogPosts(params: {
  page: number;
  pageSize: number;
}): Promise<{ rows: PublicBlogPostSummary[]; count: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page);
  const from = (page - 1) * params.pageSize;
  const { data, count } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, cover_image_path, published_at, author_name", { count: "exact" })
    .or(PUBLIC_STATUS_FILTER())
    .order("published_at", { ascending: false })
    .range(from, from + params.pageSize - 1);
  return { rows: data ?? [], count: count ?? 0 };
}

export type PublicBlogPost = PublicBlogPostSummary & {
  content: object;
  /** Titre/description dedies au referencement — retombent sur `title`/`excerpt` cote appelant quand absents. */
  meta_title: string | null;
  meta_description: string | null;
};

export async function getPublishedBlogPostBySlug(slug: string): Promise<PublicBlogPost | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, meta_title, meta_description, cover_image_path, published_at, author_name, content")
    .eq("slug", slug)
    .or(PUBLIC_STATUS_FILTER())
    .maybeSingle();
  return data ?? null;
}
