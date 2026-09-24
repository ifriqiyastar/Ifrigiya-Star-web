-- =====================================================================
-- IFRIQIYA STAR — Back-office : GRANT manquant sur admin_roles /
-- admin_user_roles pour la session `authenticated`.
--
-- CONTEXTE. `202608240001_admin_platform.sql` a active RLS et pose une
-- policy de lecture (`admin_user_roles_read using (public.is_admin())`),
-- mais n'a jamais accorde le GRANT de base necessaire a la session
-- `authenticated` sur ces deux tables. RLS filtre des lignes, il ne
-- remplace pas le GRANT SQL sous-jacent : sans lui, PostgREST renvoie
-- `42501 permission denied` avant meme d'evaluer la policy.
--
-- POURQUOI CA N'AVAIT JAMAIS ETE REMARQUE. Le seul code qui lit ces deux
-- tables directement (pas via la RPC `admin_has_permission`, qui est
-- `security definer` et n'a donc jamais eu besoin de ce GRANT) est la
-- colonne « role RBAC » de `/admin/utilisateurs` — et cette requete
-- ignorait son erreur, retombant silencieusement sur le libelle generique
-- « Administrateur ». Pour l'unique compte qui existait jusqu'ici
-- (super_admin), ce repli est visuellement quasi identique au bon
-- libelle (« Super administrateur » vs « Administrateur »), ce qui a
-- masque le probleme jusqu'a l'ajout du role « editeur », dont le
-- libelle est, lui, bien different.
--
-- `admin_notification_reads` (202608240005) avait deja recu ce meme
-- traitement — ce script applique la meme correction, en retard, aux
-- deux tables RBAC restees sans GRANT explicite.
--
-- Idempotent (GRANT est reexecutable sans effet de bord).
-- =====================================================================

grant select on public.admin_roles to authenticated;
grant select on public.admin_user_roles to authenticated;

notify pgrst, 'reload schema';
