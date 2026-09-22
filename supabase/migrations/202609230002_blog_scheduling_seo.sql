-- =====================================================================
-- IFRIQIYA STAR — Back-office : referencement dedie et publication
-- programmee pour les articles de blog.
--
-- Trois colonnes ajoutees a `blog_posts` (202609210001) :
--
-- - `meta_title` / `meta_description` : jusqu'ici le site public utilisait
--   `title` et `excerpt` pour la balise <title> et la meta description
--   (`app/[locale]/blog/[slug]/page.tsx`). Ces deux champs redigent souvent
--   un titre accrocheur et un resume pour le lecteur, pas un extrait
--   optimise pour un moteur de recherche — d'ou des champs distincts,
--   facultatifs : vides, le site continue de retomber sur `title`/`excerpt`
--   comme avant (`lib/queries/site-blog.ts` selectionne les deux paires).
-- - `scheduled_at` : date de publication programmee. Un article publie avec
--   une date future prend le statut `programme` plutot que `publie` — voir
--   ci-dessous pour ce que ce troisieme statut change reellement.
--
-- **La programmation est reelle, pas juste indicative.** Les deux pages
-- publiques du blog sont deja `force-dynamic` (rendues a chaque requete,
-- jamais mises en cache) : la regle RLS ci-dessous suffit donc a rendre un
-- article visible au bon moment sans tache planifiee (pg_cron, route de
-- webhook...) et sans jamais reecrire `status` depuis un job externe. Le
-- champ colonne `status` d'un article programme et deja echu reste donc
-- litteralement `programme` en base jusqu'a la prochaine ecriture — c'est
-- `saveBlogPost()` (lib/actions/blog.ts) qui le fait basculer a `publie` des
-- que l'article est de nouveau enregistre, et l'ecran de liste
-- (app/[locale]/admin/blog/page.tsx) calcule un statut affiche a la volee
-- pour ne jamais montrer « Programme » a un article deja visible du public.
--
-- Idempotent.
-- =====================================================================

alter table public.blog_posts
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists scheduled_at timestamptz;

alter table public.blog_posts drop constraint if exists blog_posts_status_check;
alter table public.blog_posts add constraint blog_posts_status_check
  check (status in ('brouillon', 'publie', 'programme'));

-- Remplace la policy de 202609210001 : un article `programme` devient lisible
-- des que sa date est atteinte, sans intervention manuelle.
drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read
on public.blog_posts for select
to anon, authenticated
using (status = 'publie' or (status = 'programme' and scheduled_at <= now()));

notify pgrst, 'reload schema';
