-- =====================================================================
-- IFRIQIYA STAR — Back-office : le role `editeur` perd `dashboard.read`.
--
-- CONTEXTE. `202609230004_admin_editor_role.sql` attribuait `dashboard.read`
-- + `blog.manage` a `editeur`, `dashboard.read` uniquement pour que la
-- redirection post-connexion (codee en dur vers `/admin` dans
-- `sign-in-form.tsx`) ne heurte pas un refus d'acces. Demande du client :
-- un editeur ne doit voir que le Blog, pas le tableau de bord (chiffres,
-- finances, files de validation).
--
-- Ce qui rend ce retrait sans danger maintenant : `app/[locale]/admin/page.tsx`
-- ne repose plus sur `requirePermission("dashboard.read")` (qui renvoyait
-- vers `/admin/acces-refuse`) mais redirige silencieusement vers la premiere
-- section que les permissions du compte ouvrent
-- (`firstAccessiblePath()`, `components/admin/nav-items.ts`) — pour un
-- editeur, `/admin/blog`. Retirer la permission sans ce changement de code
-- aurait renvoye tout editeur droit sur l'ecran de refus a chaque connexion.
--
-- Idempotent.
-- =====================================================================

delete from public.admin_role_permissions
using public.admin_roles r, public.admin_permissions p
where admin_role_permissions.role_id = r.id
  and admin_role_permissions.permission_id = p.id
  and r.code = 'editeur'
  and p.code = 'dashboard.read';

notify pgrst, 'reload schema';
