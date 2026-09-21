-- =====================================================================
-- IFRIQIYA STAR — Back-office : nom d'auteur affichable sur un article de
-- blog.
--
-- `blog_posts.author_id` (202609210001) identifie deja l'administrateur qui
-- a cree l'article, mais rien ne peut l'afficher sur le site public : la
-- table `profiles` (email, telephone...) n'est pas lisible par une session
-- anonyme, et ne doit pas le devenir juste pour un nom d'auteur. Ce script
-- ajoute une copie **figee** du nom, ecrite une seule fois a la creation
-- (`lib/actions/blog.ts`), lisible partout ou l'article lui-meme l'est deja —
-- aucune nouvelle regle d'acces necessaire.
--
-- Idempotent.
-- =====================================================================

alter table public.blog_posts add column if not exists author_name text;

notify pgrst, 'reload schema';
