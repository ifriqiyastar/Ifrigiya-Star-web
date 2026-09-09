-- =====================================================================
-- IFRIQIYA STAR — Back-office : permission de validation des Scout Days.
--
-- CONTEXTE. La migration 0040 du depot mobile (~/ifriqiyastar) impose que
-- seul un **super administrateur** puisse faire passer un Scout Day a
-- `publie` — c'est `public.is_super_admin()` qui le dit, et Postgres a le
-- dernier mot. Ce script pose l'equivalent applicatif : la permission fine
-- que `requirePermission("events.validate")` interroge, pour que le
-- back-office cache le geste au lieu de laisser l'administrateur se prendre
-- un refus a l'ecran.
--
-- POURQUOI UNE PERMISSION DE PLUS PLUTOT QUE `events.manage`. `events.manage`
-- est deja detenue par le role « Responsable evenements », qui doit continuer
-- a annuler, cloturer et modifier un evenement. La validation est le seul
-- geste demande en super administrateur : elle a donc son propre code, et
-- n'est attribuee qu'a `super_admin`.
--
-- DEPENDANCE : `202608240001_admin_platform.sql` (tables RBAC).
-- Idempotent.
-- =====================================================================

insert into public.admin_permissions (code, description) values
  ('events.validate', 'Valider ou refuser la publication d''un Scout Day')
on conflict (code) do update set description = excluded.description;

-- Attribuee au seul super administrateur. Le cross join de 202608240001 n'a
-- pas pu la donner : elle n'existait pas encore.
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
  from public.admin_roles r
  cross join public.admin_permissions p
 where r.code = 'super_admin'
   and p.code = 'events.validate'
on conflict do nothing;

-- Garde-fou : si un deploiement anterieur l'avait accordee a un autre role,
-- on la retire. La regle « super admin uniquement » vient du client.
delete from public.admin_role_permissions rp
 using public.admin_roles r, public.admin_permissions p
 where rp.role_id = r.id
   and rp.permission_id = p.id
   and p.code = 'events.validate'
   and r.code <> 'super_admin';

notify pgrst, 'reload schema';
