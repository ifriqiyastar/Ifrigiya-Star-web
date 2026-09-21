-- =====================================================================
-- IFRIQIYA STAR — Back-office : systeme de blog (articles rediges depuis
-- l'administration, editeur Tiptap, publies sur le site public a /blog).
--
-- Table entierement nouvelle et propre a ce depot (elle ne fait pas partie
-- du schema mobile) : `blog_posts` n'existe nulle part ailleurs, donc rien
-- ici ne redefinit une table `~/ifriqiyastar`.
--
-- Le contenu est stocke en JSON (document Tiptap/ProseMirror), pas en HTML
-- deja rendu : c'est la seule source de verite, rechargeable dans l'editeur
-- pour une modification future, et le site public le transforme en HTML a
-- la demande (`@tiptap/html`, memes extensions que l'editeur) — aucune copie
-- HTML a garder synchronisee.
--
-- Idempotent.
-- =====================================================================

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  cover_image_path text,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'brouillon' check (status in ('brouillon', 'publie')),
  author_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_posts enable row level security;

-- Administration : toute session dont le role RBAC porte `blog.manage` lit
-- et ecrit sans restriction (brouillons compris).
drop policy if exists blog_posts_admin_all on public.blog_posts;
create policy blog_posts_admin_all
on public.blog_posts for all
to authenticated
using (public.admin_has_permission('blog.manage'))
with check (public.admin_has_permission('blog.manage'));

-- Site public : seuls les articles publies sont lisibles, et par n'importe
-- qui (anonyme compris) — c'est la seule barriere entre un brouillon et un
-- visiteur, la page /blog ne filtre pas cote application.
drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read
on public.blog_posts for select
to anon, authenticated
using (status = 'publie');

-- Bucket public pour les images d'articles (couverture + images inserees
-- dans le corps du texte) : servi en URL publique directe, comme `avatars`,
-- `player-videos` et `post-media` (cf. lib/supabase/config.ts).
insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', true)
on conflict (id) do nothing;

drop policy if exists blog_media_admin_write on storage.objects;
create policy blog_media_admin_write
on storage.objects for insert
to authenticated
with check (bucket_id = 'blog-media' and public.admin_has_permission('blog.manage'));

drop policy if exists blog_media_admin_delete on storage.objects;
create policy blog_media_admin_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'blog-media' and public.admin_has_permission('blog.manage'));

drop policy if exists blog_media_public_read on storage.objects;
create policy blog_media_public_read
on storage.objects for select
to anon, authenticated
using (bucket_id = 'blog-media');

-- Permission RBAC. Contrairement a `events.validate` (202608240003, reservee
-- au super administrateur), `blog.manage` est accordee a tous les roles
-- existants : gerer le blog est moins sensible que publier un Scout Day ou
-- suspendre un compte, et rien dans le cahier des charges ne demande de
-- separer redaction et publication ici.
insert into public.admin_permissions (code, description) values
  ('blog.manage', 'Gerer les articles du blog')
on conflict (code) do update set description = excluded.description;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
cross join public.admin_permissions p
where p.code = 'blog.manage'
on conflict do nothing;

notify pgrst, 'reload schema';
