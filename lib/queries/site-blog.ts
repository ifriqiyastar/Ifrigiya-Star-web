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

/**
 * `.or()` de supabase-js ne pose qu'un seul parametre `or=` : impossible de
 * l'appeler deux fois pour dire "(statut publie) ET (titre OU extrait
 * correspond)". La recherche s'imbrique donc dans le meme filtre via `and()` —
 * PostgREST accepte un `or()` imbrique comme operande d'un `and()`. Sans
 * recherche, on retombe sur la liste plate d'origine (equivalente a un `or`
 * a plat, PostgREST ne fait pas de difference).
 */
function statusAndSearchFilter(search?: string): string {
  const statusOnly = PUBLIC_STATUS_FILTER();
  if (!search) return statusOnly;
  // `*` est le joker de PostgREST a l'interieur d'un `or()`/`and()` imbrique
  // (`%` normalement) ; virgules et parentheses casseraient la syntaxe du
  // filtre. Un simple nettoyage suffit, ceci n'etant pas une recherche plein
  // texte mais un ILIKE sur deux colonnes.
  const term = search.trim().replace(/[,()*]/g, " ").slice(0, 100);
  if (!term) return statusOnly;
  return `and(or(${statusOnly}),or(title.ilike.*${term}*,excerpt.ilike.*${term}*))`;
}

export type PublicBlogPostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_path: string | null;
  published_at: string | null;
  /** Copie figee au moment de la creation (migration 202609230001) — jamais lue depuis `profiles`, inaccessible a une session anonyme. */
  author_name: string | null;
  /** Texte libre choisi par l'administration (migration 202609230003) — pas une liste fermee. */
  category: string | null;
};

/**
 * Pagine : 6 articles par page sur telephone, 9 sur ordinateur
 * (`lib/server-device.ts` decide laquelle, avant la requete — la taille de
 * page change le nombre de lignes ramenees, pas seulement leur mise en page).
 *
 * `category`/`month` filtrent sur des colonnes reelles. Un filtre par auteur
 * a existe un temps (colonne `author_name` reelle) mais a ete retire a la
 * demande du client.
 */
export async function listPublishedBlogPosts(params: {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  /** "YYYY-MM" */
  month?: string;
}): Promise<{ rows: PublicBlogPostSummary[]; count: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page);
  const from = (page - 1) * params.pageSize;

  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, cover_image_path, published_at, author_name, category", { count: "exact" })
    .or(statusAndSearchFilter(params.search));

  if (params.category) query = query.eq("category", params.category);
  if (params.month) {
    const [year, month] = params.month.split("-").map(Number);
    if (year && month) {
      // `Date.UTC` prend un mois 0-indexe : passer `month` (1-12) tel quel
      // designe donc deja le premier jour du mois *suivant*, la borne
      // superieure exclusive qu'il faut ici.
      query = query
        .gte("published_at", new Date(Date.UTC(year, month - 1, 1)).toISOString())
        .lt("published_at", new Date(Date.UTC(year, month, 1)).toISOString());
    }
  }

  const { data, count } = await query
    .order("published_at", { ascending: false })
    .range(from, from + params.pageSize - 1);
  return { rows: data ?? [], count: count ?? 0 };
}

export type BlogFacet = { value: string; label: string; count: number };

/**
 * Les valeurs disponibles pour les filtres "Categories" et "Dates" de la
 * barre laterale (`/blog`), avec leur nombre d'articles. Agrege cote
 * application plutot que via une RPC dediee : le blog compte une poignee
 * d'articles, pas des milliers — un `GROUP BY` SQL serait de la prevoyance
 * inutile pour ce volume.
 */
export async function fetchBlogFacets(): Promise<{ categories: BlogFacet[]; months: BlogFacet[] }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("category, published_at")
    .or(statusAndSearchFilter());

  const categoryCounts = new Map<string, number>();
  const monthCounts = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.category) {
      categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
    }
    if (row.published_at) {
      const d = new Date(row.published_at);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }
  }

  const monthLabel = (key: string) => {
    const [year, month] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month - 1, 1)),
    );
  };

  return {
    categories: [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, label: value, count })),
    // Les mois les plus recents en tete : la cle "YYYY-MM" se trie deja
    // correctement en ordre alphabetique inverse.
    months: [...monthCounts.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([value, count]) => ({ value, label: monthLabel(value), count })),
  };
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
    .select("id, title, slug, excerpt, meta_title, meta_description, cover_image_path, published_at, author_name, category, content")
    .eq("slug", slug)
    .or(PUBLIC_STATUS_FILTER())
    .maybeSingle();
  return data ?? null;
}
