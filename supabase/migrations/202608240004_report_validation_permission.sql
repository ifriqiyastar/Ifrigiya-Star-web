-- =====================================================================
-- IFRIQIYA STAR — Back-office : permission de validation des retraits.
--
-- CONTEXTE. La migration 0041 du depot mobile (~/ifriqiyastar) impose que le
-- retrait d'un contenu signale soit propose par un moderateur puis valide par
-- un **super administrateur** — c'est `public.is_super_admin()` qui le dit,
-- dans `trg_enforce_report_workflow` et dans les trois garde-fous de
-- suppression. Ce script pose l'equivalent applicatif : la permission fine
-- que `requirePermission("moderation.validate")` interroge, pour que le
-- back-office cache le geste au lieu de laisser le moderateur decouvrir la
-- regle par un refus Postgres.
--
-- POURQUOI PAS `moderation.manage`. Elle appartient au role « Moderateur »,
-- qui doit continuer a instruire les signalements, masquer un contenu
-- litigieux et proposer son retrait. Seule la decision finale remonte au
-- super administrateur : elle a donc son propre code.
--
-- DEPENDANCE : `202608240001_admin_platform.sql` (tables RBAC).
-- Idempotent.
-- =====================================================================

insert into public.admin_permissions (code, description) values
  ('moderation.validate', 'Valider ou refuser le retrait d''un contenu signale')
on conflict (code) do update set description = excluded.description;

-- Attribuee au seul super administrateur. Le cross join de 202608240001 n'a
-- pas pu la donner : elle n'existait pas encore.
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
  from public.admin_roles r
  cross join public.admin_permissions p
 where r.code = 'super_admin'
   and p.code = 'moderation.validate'
on conflict do nothing;

-- Garde-fou : si un deploiement anterieur l'avait accordee a un autre role,
-- on la retire. La regle « super admin uniquement » vient du client.
delete from public.admin_role_permissions rp
 using public.admin_roles r, public.admin_permissions p
 where rp.role_id = r.id
   and rp.permission_id = p.id
   and p.code = 'moderation.validate'
   and r.code <> 'super_admin';

notify pgrst, 'reload schema';
