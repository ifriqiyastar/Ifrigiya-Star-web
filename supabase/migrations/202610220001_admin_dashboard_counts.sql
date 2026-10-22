-- =====================================================================
-- IFRIQIYA STAR — Back-office : les chiffres du tableau de bord en un
-- seul aller-retour.
--
-- POURQUOI. Rien ici n'est nouveau. `getDashboard()` appelait deja
-- `public.get_admin_dashboard()` (migration mobile 0011) pour ses
-- agregats, puis posait TREIZE lectures de plus a cote — onze comptages
-- `count exact`, les deux cents derniers profils valides pour en moyenner
-- le delai d'approbation, et la table `subscriptions` entiere pour
-- compter les souscriptions actives par offre en JavaScript —, plus une
-- quatorzieme en seconde vague : les inscriptions du prochain evenement,
-- qui dependaient de l'evenement trouve par la treizieme.
--
-- Les treize partaient ensemble, donc un aller-retour de latence et non
-- treize ; mais c'etaient treize connexions ouvertes sur une base
-- distante, deux lectures de table ramenees en entier pour en tirer un
-- nombre, et une vague supplementaire que rien n'obligeait. La regle du
-- depot est de regrouper plutot que d'ajouter une vague : c'est ce
-- qu'ont fait `admin_queue_counts()`, `admin_access()` puis
-- `admin_guard()`.
--
-- Cette fonction rend exactement les memes valeurs, calculees la ou sont
-- les donnees. Le tableau de bord n'affiche rien de plus et rien de
-- moins qu'avant : chaque nombre vient toujours d'une requete.
--
-- ⚠️ ELLE N'EST PAS OBLIGATOIRE. `getDashboard()` retombe sur ses
-- treize lectures d'origine si la fonction est absente (`PGRST202`),
-- comme le reste du back-office degrade a l'ouverture quand une
-- migration n'est pas appliquee. Ce script accelere, il ne conditionne
-- rien.
--
-- `security definer` pour la meme raison que `admin_queue_counts` : un
-- comptage doit voir les lignes que le RLS montrerait de toute facon a
-- un administrateur, et la question « est-ce un administrateur ? » est
-- posee une fois, en premiere ligne, au lieu d'une fois par table.
--
-- `grant execute ... to authenticated` : le back-office appelle en
-- **session utilisateur**, jamais en `service_role` (lecon des
-- migrations mobiles 0073 / 0079, « permission denied for function
-- get_admin_dashboard »).
--
-- Colonnes verifiees contre la base reelle le 2026-10-22 : une sonde
-- PostgREST anonyme repond `42703` pour une colonne inexistante et
-- `42501` (« permission denied for function is_admin ») pour une
-- colonne valide — les treize lues ici repondent toutes `42501`.
--
-- Idempotent.
-- =====================================================================

create or replace function public.admin_dashboard_counts(p_period_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'acces refuse' using errcode = '42501';
  end if;

  with next_event as (
    -- Le prochain evenement publie : le bandeau de bas d'ecran. Lu une
    -- fois, et ses inscriptions comptees dans la foulee — c'est la vague
    -- supplementaire que le code applicatif payait.
    select id, title, event_date, start_time, location, capacity
    from public.scout_days
    where status = 'publie'
      and event_date >= current_date
    order by event_date
    limit 1
  ),
  approvals as (
    -- Delai d'approbation : l'ecart entre la creation du profil et la
    -- decision, sur les 200 derniers profils valides. Deux horodatages
    -- reels, aucune moyenne inventee — et la moyenne est faite ici au
    -- lieu de ramener les 200 lignes.
    select created_at, status_updated_at
    from public.player_profiles
    where status = 'valide'
      and status_updated_at is not null
    order by status_updated_at desc
    limit 200
  ),
  plans as (
    select
      pl.id,
      pl.code,
      pl.label,
      pl.target_role,
      pl.price_amount,
      pl.price_currency,
      pl.billing_period_months,
      pl.is_active,
      -- Souscriptions actives de cette offre. Le code comptait cote
      -- JavaScript apres avoir ramene toute la table `subscriptions`.
      (
        select count(*)
        from public.subscriptions s
        where s.plan_id = pl.id
          and s.status = 'active'
      ) as active_count
    from public.subscription_plans pl
  )
  select jsonb_build_object(
    'visible_players', (
      select count(*) from public.player_profiles
      where is_visible and status = 'valide'
    ),
    'active_7d', (
      select count(*) from public.profiles
      where last_login_at >= now() - interval '7 days'
    ),
    'active_30d', (
      select count(*) from public.profiles
      where last_login_at >= now() - interval '30 days'
    ),
    'active_period', (
      select count(*) from public.profiles
      where last_login_at >= now() - make_interval(days => greatest(p_period_days, 1))
    ),
    'pending_reports', (
      select count(*) from public.reports where status = 'en_attente'
    ),
    'pending_payments', (
      select count(*) from public.payments where status = 'en_attente'
    ),
    'docs_pending', (
      select count(*) from public.professional_documents where status = 'en_attente'
    ),
    'payments_total', (select count(*) from public.payments),
    'payments_succeeded', (
      select count(*) from public.payments
      where status in ('reussi', 'active_manuellement')
    ),
    -- En millisecondes, comme le calcul JavaScript qu'elle remplace.
    -- `null` quand aucune ligne n'est exploitable : un « 0 » se lirait
    -- comme une decision instantanee.
    'approval_delay_ms', (
      select avg(extract(epoch from (a.status_updated_at - a.created_at)) * 1000)
      from approvals a
      where a.status_updated_at >= a.created_at
    ),
    'next_event', (select to_jsonb(n) from next_event n),
    'next_event_registrations', (
      select count(*)
      from public.scout_day_registrations r
      join next_event n on n.id = r.scout_day_id
      where r.status not in ('annule', 'refuse')
    ),
    'plans', (
      select coalesce(jsonb_agg(to_jsonb(p) order by p.price_amount desc), '[]'::jsonb)
      from plans p
    )
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.admin_dashboard_counts(integer) is
  'Les treize lectures du tableau de bord du back-office en une. Facultative : l''appelant retombe sur ses requetes d''origine si elle est absente.';

revoke all on function public.admin_dashboard_counts(integer) from public;
grant execute on function public.admin_dashboard_counts(integer) to authenticated;
