import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Lectures publiques du blog. `status = 'publie'` n'est pas un filtre
 * applicatif de confort : c'est `blog_posts_public_read`
 * (`supabase/migrations/202609210001_blog.sql`) qui l'impose reellement — un
 * visiteur anonyme n'a de toute facon jamais acces aux brouillons, meme si
 * cette clause etait retiree d'ici.
 */

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

export async function listPublishedBlogPosts(): Promise<PublicBlogPostSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, cover_image_path, published_at, author_name")
    .eq("status", "publie")
    .order("published_at", { ascending: false })
    .limit(60);
  return data ?? [];
}

export type PublicBlogPost = PublicBlogPostSummary & { content: object };

export async function getPublishedBlogPostBySlug(slug: string): Promise<PublicBlogPost | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, cover_image_path, published_at, author_name, content")
    .eq("slug", slug)
    .eq("status", "publie")
    .maybeSingle();
  return data ?? null;
}
