-- =====================================================================
-- IFRIQIYA STAR — Back-office : role RBAC "Editeur", limite au blog.
--
-- Reprend le modele de 202608240001_admin_platform.sql (roles/permissions
-- deja en place : super_admin, validator, moderator, event_manager,
-- finance_admin, support) et y ajoute un role destine a une personne qui ne
-- doit gerer que les articles — pas les validations, la moderation, les
-- Scout Days ni les finances.
--
-- Deux permissions, pas une seule : `dashboard.read` est necessaire en plus
-- de `blog.manage`, sans quoi la connexion echoue des la redirection
-- post-connexion vers `/admin` (qui exige `dashboard.read`, voir
-- `lib/auth.ts`) avant meme d'atteindre `/admin/blog`.
--
-- L'attribution effective d'un compte a ce role reste par l'editeur SQL de
-- Supabase (`admin_user_roles`), comme tous les autres roles — voir le
-- commentaire de 202608240001 : aucune ecriture n'est autorisee sur cette
-- table depuis le back-office lui-meme. Voir le README pour la requete
-- d'attribution.
--
-- Idempotent.
-- =====================================================================

insert into public.admin_roles (code, label, description) values
  ('editeur', 'Editeur', 'Redaction et publication des articles du blog, rien d''autre.')
on conflict (code) do update set label = excluded.label, description = excluded.description;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p
  on r.code = 'editeur' and p.code in ('dashboard.read', 'blog.manage')
on conflict do nothing;
