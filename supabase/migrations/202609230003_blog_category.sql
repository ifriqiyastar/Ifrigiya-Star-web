-- =====================================================================
-- IFRIQIYA STAR — Back-office : categorie editoriale des articles de blog.
--
-- Texte libre, comme `author_name` (202609230001) et non une colonne enum ou
-- une table separee : le client choisit ses propres intitules ("Actualites",
-- "Coulisses", "Transferts"...) au fil des articles plutot que de suivre une
-- liste figee decidee a l'avance. La page publique (/blog) agrege les
-- valeurs reellement utilisees pour batir son filtre "Categories" — voir
-- `fetchBlogFacets()` dans lib/queries/site-blog.ts.
--
-- Idempotent.
-- =====================================================================

alter table public.blog_posts add column if not exists category text;

notify pgrst, 'reload schema';
