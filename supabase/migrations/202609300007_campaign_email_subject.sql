-- =====================================================================
-- IFRIQIYA STAR — Back-office : l'e-mail peut porter son propre texte.
--
-- POURQUOI. Une notification et un courriel ne se redigent pas pareil. Le
-- titre d'une notification est lu sur un ecran verrouille, tronque autour de
-- soixante caracteres, et doit tenir en un souffle ; un objet d'e-mail se lit
-- dans une boite de reception, a cote de dix autres, et gagne a etre explicite.
-- Le corps suit la meme logique : un push dit « venez », un courriel explique.
--
-- Jusqu'ici les deux canaux partageaient `title` et `body`, ce qui obligeait a
-- ecrire pour le plus contraint des deux.
--
-- CE QUE CHAQUE COLONNE PORTE, ET C'EST LA LE POINT :
--
--   title / body       le texte **principal** de la campagne. Notification
--                      seule ou « les deux » : celui de la notification.
--                      Courriel seul : celui du courriel — il n'y a pas de
--                      notification dont il pourrait differer.
--   email_subject      l'objet du courriel **quand il differe** de `title`.
--                      Nul = les deux canaux ont porte le meme texte.
--   body_html          le corps mis en forme du courriel.
--
-- ⚠️ `email_subject is null` ne veut donc pas dire « pas de courriel » — il
-- faut lire `channels` pour cela — mais « meme objet que la notification ».
-- Un journal qui l'afficherait comme un manque se tromperait.
--
-- Idempotent : relancable sans erreur.
-- =====================================================================

alter table public.admin_notification_campaigns
  add column if not exists email_subject text;

comment on column public.admin_notification_campaigns.email_subject is
  'Objet du courriel quand il differe du titre de la notification. Nul = les deux canaux ont porte le meme texte (et non : pas de courriel — lire channels pour cela).';

notify pgrst, 'reload schema';
