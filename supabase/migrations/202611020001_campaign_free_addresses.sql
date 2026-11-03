-- =====================================================================
-- IFRIQIYA STAR — Back-office : diffuser vers des adresses saisies.
--
-- CE QUE CE FICHIER OUVRE. Jusqu'ici une campagne ne pouvait viser que des
-- **comptes** : `admin_broadcast_recipients()` lit `public.profiles`, le lien
-- de desabonnement est une signature posee sur un identifiant de compte, et
-- une ligne de journal reference `profiles(id)` en `not null`. Le client veut
-- pouvoir ecrire a des adresses qui n'ont pas de compte — invitations a tester
-- l'application, annonces marketing. Les trois accroches sont donc desserrees,
-- une par une, et **aucune n'est supprimee** : un destinataire reste rattache
-- a son compte quand il en a un.
--
-- ⚠️ CE QUI N'EST PAS FAIT ICI, ET POURQUOI. Rien ne touche
-- `admin_broadcast_notification()` ni `admin_broadcast_recipients()`. Une
-- adresse sans compte **ne peut pas** recevoir de notification in-app ni de
-- push : il n'y a pas de cloche ou la deposer. La cible « adresses saisies »
-- est donc un envoi par courriel seul, et c'est le Server Action qui le force.
--
-- Idempotent : relancable sans erreur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La campagne peut viser une liste d'adresses
--
-- La contrainte enumere les cibles ; en ajouter une passe par un remplacement
-- de contrainte, pas par un `add` (il n'y a qu'une definition possible).
-- ---------------------------------------------------------------------
alter table public.admin_notification_campaigns
  drop constraint if exists admin_notification_campaigns_target_type_check;

alter table public.admin_notification_campaigns
  add constraint admin_notification_campaigns_target_type_check
  check (target_type in ('all','role','user','scout_day','emails'));

comment on column public.admin_notification_campaigns.target_value is
  'Selon target_type : le role, l''identifiant du compte ou de l''evenement, ou — pour ''emails'' — les adresses saisies, separees par des virgules.';

-- ---------------------------------------------------------------------
-- 2. Le journal des remises accepte un destinataire sans compte
--
-- ⚠️ `recipient_id` devient facultatif, et une contrainte garantit qu'il
-- reste **toujours** quelqu'un a nommer : sans elle une ligne pourrait
-- n'identifier personne, et une plainte pour spam serait intracable.
-- ---------------------------------------------------------------------
alter table public.admin_notification_deliveries
  alter column recipient_id drop not null;

alter table public.admin_notification_deliveries
  add column if not exists email text;

comment on column public.admin_notification_deliveries.email is
  'Adresse du destinataire quand il n''a pas de compte. Nulle pour un compte, ou recipient_id fait foi.';

alter table public.admin_notification_deliveries
  drop constraint if exists admin_notification_deliveries_who_check;

alter table public.admin_notification_deliveries
  add constraint admin_notification_deliveries_who_check
  check (recipient_id is not null or email is not null);

-- Le doublon se joue sur l'adresse quand il n'y a pas de compte. Deux
-- contraintes **de colonnes simples** plutot qu'un index d'expression :
-- PostgREST ne sait viser que les premieres dans un `on_conflict`, et c'est
-- par la que `recordDeliveries()` ecrit.
--
-- ⚠️ `unique` traite les NULL comme distincts : la contrainte historique
-- (campaign_id, recipient_id, channel) ne contraint donc plus rien des que
-- `recipient_id` est nul, d'ou celle-ci a cote plutot qu'a sa place.
create unique index if not exists admin_notification_deliveries_email_key
  on public.admin_notification_deliveries (campaign_id, email, channel);

-- ---------------------------------------------------------------------
-- 3. Le desabonnement existe sans compte
--
-- `profile_id` etait la cle primaire : une adresse sans compte n'avait aucune
-- facon d'etre enregistree. Elle devient facultative, et c'est **l'adresse**
-- qui porte l'unicite — ce qui est de toute facon la bonne cle : un
-- desabonnement suit la boite mail, pas le compte qui la declarait.
--
-- ⚠️ L'ordre compte. Les adresses sont d'abord ramenees en minuscules et
-- dedoublonnees, sinon la contrainte d'unicite echoue a la creation et, le
-- script etant execute dans une seule transaction, **tout** serait annule.
-- ---------------------------------------------------------------------
update public.admin_email_optouts set email = lower(btrim(email))
 where email <> lower(btrim(email));

-- ⚠️ `ctid` departage les ex aequo. Sans lui, deux lignes de meme adresse et
-- de meme horodatage survivraient toutes les deux, l'index unique echouerait,
-- et la transaction entiere — donc tout ce fichier — serait annulee.
delete from public.admin_email_optouts a
 using public.admin_email_optouts b
 where a.email = b.email
   and (a.unsubscribed_at, a.ctid) > (b.unsubscribed_at, b.ctid);

alter table public.admin_email_optouts
  drop constraint if exists admin_email_optouts_pkey;

alter table public.admin_email_optouts
  alter column profile_id drop not null;

alter table public.admin_email_optouts
  add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.admin_email_optouts'::regclass and contype = 'p'
  ) then
    alter table public.admin_email_optouts add primary key (id);
  end if;
end $$;

create unique index if not exists admin_email_optouts_email_key
  on public.admin_email_optouts (email);

comment on column public.admin_email_optouts.profile_id is
  'Le compte, quand le desabonne en a un. Nul pour une adresse saisie a la main : c''est l''adresse qui porte l''unicite.';

notify pgrst, 'reload schema';
