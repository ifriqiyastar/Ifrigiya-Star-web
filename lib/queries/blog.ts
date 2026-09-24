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
  category: string | null;
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

/** Liste des articles pour l'ecran d'administration, avec recherche, filtre de statut, de mois et pagination. */
export async function listBlogPosts(params: { q?: string; statut?: string; mois?: string; page?: number }) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);

  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, status, cover_image_path, published_at, scheduled_at, updated_at, author_name, category", {
      count: "exact",
    })
    .order("updated_at", { ascending: false });

  if (params.statut) query = query.eq("status", params.statut);
  if (params.q) {
    const term = params.q.replace(/[%,()]/g, " ").trim();
    if (term) query = query.ilike("title", `%${term}%`);
  }
  // Filtre sur `created_at`, pas `published_at` : un brouillon ou un article
  // programme n'a pas encore de date de publication, et disparaitrait donc
  // en permanence de ce filtre-la — l'administration doit pouvoir retrouver
  // un article par le mois ou elle l'a redige, quel que soit son statut.
  if (params.mois) {
    const [year, month] = params.mois.split("-").map(Number);
    if (year && month) {
      query = query
        .gte("created_at", new Date(Date.UTC(year, month - 1, 1)).toISOString())
        .lt("created_at", new Date(Date.UTC(year, month, 1)).toISOString());
    }
  }

  const from = (page - 1) * BLOG_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + BLOG_PAGE_SIZE - 1);

  return { rows: (data ?? []) as BlogPostListRow[], count: count ?? 0, error };
}

/**
 * Les mois ayant au moins un article (`created_at`), les plus recents en
 * tete — alimente le filtre "Mois" de `/admin/blog`. Agrege cote application
 * plutot que via un `GROUP BY` SQL : le blog compte une poignee d'articles,
 * pas des milliers (meme raisonnement que `fetchBlogFacets()` cote public).
 */
export async function fetchBlogMonths(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("blog_posts").select("created_at");
  const months = new Set<string>();
  for (const row of data ?? []) {
    if (!row.created_at) continue;
    const d = new Date(row.created_at as string);
    months.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  // La cle "YYYY-MM" se trie deja correctement en ordre alphabetique inverse.
  return [...months].sort((a, b) => b.localeCompare(a));
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
  category: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BlogStats = {
  total: number;
  published: number;
  scheduled: number;
  drafts: number;
};

/**
 * Compteurs du bandeau de KPI de `/admin/blog` — la page d'accueil d'un
 * compte `editeur`, qui n'a pas acces au tableau de bord general. « Publie »
 * compte aussi les articles encore marques `programme` en base dont
 * l'echeance est deja passee, meme regle que `effectiveBlogStatus()` mais
 * portee dans la requete plutot que ligne par ligne.
 */
export async function fetchBlogStats(): Promise<BlogStats> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const head = { count: "exact" as const, head: true };

  const [total, published, duePublish, scheduled, drafts] = await Promise.all([
    supabase.from("blog_posts").select("id", head),
    supabase.from("blog_posts").select("id", head).eq("status", "publie"),
    supabase.from("blog_posts").select("id", head).eq("status", "programme").lte("scheduled_at", nowIso),
    supabase.from("blog_posts").select("id", head).eq("status", "programme").gt("scheduled_at", nowIso),
    supabase.from("blog_posts").select("id", head).eq("status", "brouillon"),
  ]);

  return {
    total: total.count ?? 0,
    published: (published.count ?? 0) + (duePublish.count ?? 0),
    scheduled: scheduled.count ?? 0,
    drafts: drafts.count ?? 0,
  };
}

/** Un article par id, pour l'ecran d'edition — brouillon ou publie, l'administration voit tout. */
export async function getBlogPostById(id: string): Promise<BlogPostRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
  return (data as BlogPostRecord | null) ?? null;
}
