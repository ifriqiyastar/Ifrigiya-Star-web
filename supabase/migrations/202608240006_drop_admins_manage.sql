-- =====================================================================
-- IFRIQIYA STAR — Back-office : retrait de la permission `admins.manage`.
--
-- CONTEXTE. L'ecran « Acces administrateurs » (`/admin/acces`) ne figure pas
-- au cahier des charges : il a ete retire, avec son action serveur
-- `assignAdminRole`. La permission fine qui le gardait n'a donc plus de
-- geste a garder, et la policy d'ecriture sur `admin_user_roles` plus
-- d'appelant.
--
-- POURQUOI UNE MIGRATION SEPAREE ALORS QUE 202608240001 A ETE CORRIGE.
-- Corriger 202608240001 suffit a un projet neuf, pas a un projet ou il a deja
-- tourne : ses `insert` sont idempotents, ils ne desemencent rien. Ce script
-- est ce qui retire la ligne d'un projet deja migre. Les deux sont
-- necessaires.
--
-- L'ATTRIBUTION DES ROLES SE FAIT DESORMAIS EN SQL. Sans policy d'ecriture,
-- `admin_user_roles` n'est plus accessible en ecriture par une session
-- `authenticated` — y compris administrateur. L'editeur SQL de Supabase et la
-- cle `service_role` passent outre RLS ; c'est par la qu'on attribue un role.
--
-- `admin_role_permissions` porte `on delete cascade` vers
-- `admin_permissions`, donc supprimer le code retire du meme coup son
-- attribution a `super_admin`.
--
-- DEPENDANCE : `202608240001_admin_platform.sql`.
-- Idempotent.
-- =====================================================================

drop policy if exists admin_user_roles_manage on public.admin_user_roles;

delete from public.admin_permissions where code = 'admins.manage';

notify pgrst, 'reload schema';
