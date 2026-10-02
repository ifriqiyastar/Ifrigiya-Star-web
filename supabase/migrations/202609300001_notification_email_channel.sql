-- =====================================================================
-- IFRIQIYA STAR — Back-office : le canal email des campagnes (§11, §12).
--
-- CE QUE CE FICHIER AJOUTE, ET POURQUOI IL EST ICI PLUTOT QUE DANS LE DEPOT
-- MOBILE. Le canal email n'existe que dans le back-office : l'application
-- mobile n'envoie pas de courriel et n'en lit pas la preference. Les deux
-- objets ci-dessous sont donc des ajouts **specifiques a l'administration**,
-- au meme titre que les tables RBAC de 202608240001. Aucune table mobile
-- n'est redefinie.
--
-- 1. `admin_email_optouts` — qui a demande a ne plus recevoir d'annonce.
-- 2. `admin_broadcast_recipients()` — qui doit recevoir une campagne donnee.
--
-- ⚠️ POURQUOI UNE FONCTION PLUTOT QU'UNE REQUETE DANS LE CODE WEB. La regle
-- de ciblage (« tous », « un role », « un compte », « les inscrits d'un Scout
-- Day, annulations exclues ») vit deja dans `admin_broadcast_notification()`
-- (migration mobile 0046), qui ne renvoie qu'un **compte**. Pour envoyer un
-- courriel il faut les adresses, et recopier la clause `where` en TypeScript
-- ferait exister deux definitions de « qui recoit » : le jour ou elles
-- divergent, une partie des destinataires recoit la notification sans le
-- courriel, ou l'inverse. La clause est donc ecrite une seconde fois ici,
-- **dans le meme langage et a cote de son jumeau**, ou une divergence se lit.
--
-- Idempotent : relancable sans erreur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Les desabonnements
--
-- La table porte `profile_id` **et** l'adresse : un compte qui change
-- d'adresse ne doit pas voir son desabonnement s'evaporer, et une adresse
-- desabonnee ne doit pas revenir parce que le compte a ete recree. Les deux
-- sont verifies a l'envoi.
--
-- Il n'y a **pas** de geste d'administration pour desabonner quelqu'un a sa
-- place, ni pour le reabonner : c'est la decision du destinataire, comme
-- `user_blocks` est celle de l'utilisateur. L'administration la lit.
-- ---------------------------------------------------------------------
create table if not exists public.admin_email_optouts (
  profile_id      uuid primary key references public.profiles(id) on delete cascade,
  email           text not null,
  unsubscribed_at timestamptz not null default now(),
  source          text not null default 'lien_email'
);

comment on table public.admin_email_optouts is
  'Comptes ayant demande a ne plus recevoir les campagnes email du back-office. Ecrit par le lien de desabonnement (service_role, sans session), lu par admin_broadcast_recipients().';

create index if not exists idx_admin_email_optouts_email
  on public.admin_email_optouts (lower(email));

alter table public.admin_email_optouts enable row level security;

-- Lecture seule pour l'administration : le desabonnement se constate, il ne
-- s'impose pas. L'ecriture passe par `service_role` — le lien de
-- desabonnement est clique depuis une boite mail, sans session Supabase.
drop policy if exists admin_email_optouts_read on public.admin_email_optouts;
create policy admin_email_optouts_read on public.admin_email_optouts for select to authenticated
using (public.admin_has_permission('notifications.manage'));

grant select on public.admin_email_optouts to authenticated;

-- ---------------------------------------------------------------------
-- 2. Les destinataires d'une campagne
--
-- Meme clause `where` que `admin_broadcast_notification()` (0046), plus deux
-- exclusions qui n'ont de sens que pour le courriel :
--   * une adresse vide — le compte existe, la notification in-app lui arrive,
--     mais il n'y a rien a qui ecrire ;
--   * un desabonnement.
--
-- `security definer` pour la meme raison que 0046 : la fonction verifie
-- `is_admin()` elle-meme.
-- ---------------------------------------------------------------------
create or replace function public.admin_broadcast_recipients(
  p_target_type  text,
  p_target_value text default null
)
returns table (id uuid, email text, locale text, full_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'La diffusion est reservee a l''administration.'
      using errcode = '42501', hint = 'admin_only';
  end if;

  if p_target_type not in ('all', 'role', 'user', 'scout_day') then
    raise exception 'Cible inconnue : %.', p_target_type
      using errcode = '22023', hint = 'unknown_target';
  end if;

  if p_target_type <> 'all' and coalesce(btrim(p_target_value), '') = '' then
    raise exception 'Cette cible demande une valeur (role, compte ou evenement).'
      using errcode = '22023', hint = 'target_value_required';
  end if;

  return query
  select p.id,
         p.email::text,
         -- Le courriel est redige dans la langue du **destinataire**, pas
         -- dans celle de l'administrateur qui le compose.
         coalesce(nullif(btrim(p.locale::text), ''), 'fr') as locale,
         p.full_name::text
    from public.profiles p
   where p.is_active
     and coalesce(btrim(p.email), '') <> ''
     and not exists (
       select 1 from public.admin_email_optouts o
        where o.profile_id = p.id or lower(o.email) = lower(p.email)
     )
     and (
       p_target_type = 'all'
       or (p_target_type = 'role' and p.role::text = p_target_value)
       or (p_target_type = 'user' and p.id = p_target_value::uuid)
       or (
         p_target_type = 'scout_day'
         and exists (
           select 1
             from public.scout_day_registrations r
            where r.scout_day_id = p_target_value::uuid
              and r.player_id = p.id
              and r.status::text not in ('annule', 'refuse')
         )
       )
     );
end;
$$;

comment on function public.admin_broadcast_recipients(text, text) is
  'Adresses des destinataires d''une campagne email du back-office. Meme ciblage que admin_broadcast_notification() (0046), moins les adresses vides et les desabonnements.';

revoke all on function public.admin_broadcast_recipients(text, text) from public;
grant execute on function public.admin_broadcast_recipients(text, text) to authenticated;

notify pgrst, 'reload schema';
