-- =====================================================================
-- IFRIQIYA STAR — Back-office : permission de validation des contenus du fil.
--
-- CONTEXTE. La migration 0089 du depot mobile (~/ifriqiyastar) impose qu'une
-- publication et un commentaire passent par la validation d'un **super
-- administrateur** avant d'etre visibles des autres — c'est
-- `public.is_super_admin()` qui le dit, dans un trigger, et Postgres a le
-- dernier mot. Ce script pose l'equivalent applicatif : la permission fine
-- que `requirePermission("content.validate")` interroge, pour que le
-- back-office **cache** le geste au lieu de laisser un moderateur decouvrir
-- la regle par un refus Postgres.
--
-- POURQUOI UNE PERMISSION DE PLUS PLUTOT QUE `moderation.manage`.
-- `moderation.manage` est deja detenue par le role « Moderateur », qui doit
-- continuer a masquer, supprimer et instruire un signalement. La **validation
-- d'un contenu** est le seul geste demande en super administrateur : elle a
-- donc son propre code, et n'est attribuee qu'a `super_admin`. C'est
-- exactement le partage retenu pour `events.validate` (Scout Days,
-- 202608240003) et `moderation.validate` (retraits, 202608240004).
--
-- DEPENDANCE : `202608240001_admin_platform.sql` (tables RBAC).
-- Idempotent.
-- =====================================================================

insert into public.admin_permissions (code, description) values
  ('content.validate', 'Valider ou refuser une publication ou un commentaire du fil')
on conflict (code) do update set description = excluded.description;

-- Attribuee au seul super administrateur. Le cross join de 202608240001 n'a
-- pas pu la donner : elle n'existait pas encore.
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
  from public.admin_roles r
  cross join public.admin_permissions p
 where r.code = 'super_admin'
   and p.code = 'content.validate'
on conflict do nothing;

-- Garde-fou : si un deploiement anterieur l'avait accordee a un autre role, on
-- la retire. La regle « super admin uniquement » vient du client, et le
-- trigger de 0089 la refuserait de toute facon cote Postgres — un bouton
-- visible mais inoperant est pire qu'un bouton absent.
delete from public.admin_role_permissions rp
 using public.admin_roles r, public.admin_permissions p
 where rp.role_id = r.id
   and rp.permission_id = p.id
   and p.code = 'content.validate'
   and r.code <> 'super_admin';

notify pgrst, 'reload schema';
