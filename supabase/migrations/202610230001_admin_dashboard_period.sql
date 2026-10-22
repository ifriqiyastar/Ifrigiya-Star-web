-- =====================================================================
-- IFRIQIYA STAR — Back-office : la periode du tableau de bord atteint
-- enfin les revenus.
--
-- ⚠️⚠️ LE DEFAUT CORRIGE. Le selecteur « 7 / 30 / 90 jours · 12 mois »
-- de `/admin` ne filtrait rien en base. Les revenus venaient de
-- `public.admin_dashboard_revenue` (migration mobile 0011), une vue
-- groupee par `date_trunc('month', paid_at)` : chaque ligne est un
-- MOIS. Le code de la page ecartait ensuite la ligne dont le PREMIER
-- JOUR du mois tombait avant `aujourd'hui - periode`. Le 22 octobre,
-- cela donnait :
--
--   «  7 derniers jours » -> 1er oct. < 15 oct., le mois en cours est
--                            ecarte : « Revenus encaisses » affichait
--                            ZERO, quels que soient les encaissements.
--   « 30 derniers jours » -> le mois en cours seul, soit 22 jours.
--   « 12 derniers mois »  -> 11 mois ; octobre 2025 disparaissait.
--
-- Un chiffre qui dit « 7 derniers jours » et vaut zero parce que le
-- mois a commence il y a trois semaines n'est pas un chiffre : c'est la
-- regle du depot — tout nombre a l'ecran vient d'une requete — prise a
-- revers par un filtre applicatif qui ne connaissait pas la granularite
-- de ce qu'il filtrait. Le fenetrage se fait donc la ou sont les
-- donnees, sur `paid_at`, a la journee.
--
-- CE QUE LA FONCTION REND EN PLUS (memes cles qu'avant, rien de retire) :
--
--   revenue_bucket     'jour' | 'semaine' | 'mois' — le pas de temps
--                      choisi pour la periode demandee, pour que
--                      l'ecran sache etiqueter ses barres.
--   revenue_from       la borne basse REELLE de la fenetre, calee sur un
--                      pas entier. C'est elle que l'ecran affiche
--                      (« depuis le 19/09/2026 ») : la duree cliquee est
--                      une demande, celle-ci est ce qui a ete mesure, et
--                      c'est le seul des deux chiffres qu'on peut
--                      defendre sous une somme d'argent.
--   revenue_series     une ligne PAR PAS DE TEMPS, y compris les pas
--                      sans encaissement (valeur zero) : un graphique
--                      qui saute les jours vides se lit comme un
--                      graphique continu et ment sur le rythme.
--   revenue_previous_total  le meme montant sur la fenetre qui precede
--                      immediatement, pour afficher une evolution.
--   payments_period_total / payments_period_succeeded
--                      le taux de reussite RAMENE A LA PERIODE (meme
--                      fenetre que les revenus et que `active_period` :
--                      un seul `v_from` sert tout l'ecran, sans quoi
--                      deux chiffres voisins mesureraient deux durees
--                      differentes sous le meme intitule). Les
--                      deux cles d'origine (`payments_total`,
--                      `payments_succeeded`) restent, inchangees et
--                      toujours depuis l'origine : elles ne sont plus
--                      affichees sous un intitule « derniers N jours »,
--                      mais les retirer casserait un appelant qui ne
--                      serait pas encore a jour.
--
-- CE QUI DISPARAIT : `pending_payments`. Elle etait calculee, transportee
-- jusqu'au type `DashboardExtras` et affichee nulle part — le tableau de
-- bord ne montrait pas les paiements en attente. Il les montre desormais,
-- mais depuis `admin_queue_counts()`, avec les inscriptions a encaisser qui
-- forment l'autre moitie de la file : un seul comptage pour la tuile, la
-- cloche et la pastille du rail. Aucun appelant ne lit plus cette cle.
--
-- ⚠️ LA DEFINITION DU REVENU NE CHANGE PAS. `admin_dashboard_revenue`
-- somme `amount` pour le seul statut « reussi » ; la serie ci-dessous
-- fait exactement pareil. Y ajouter « active_manuellement » (les
-- reglements hors ligne) changerait la valeur affichee sans que
-- personne ne l'ait demande — c'est une decision produit, pas une
-- correction de fenetre.
--
-- ⚠️ DEGRADE OUVERT, DANS LES DEUX SENS. Un projet dont la base porte
-- la version PRECEDENTE de cette fonction ne rend pas `revenue_series` :
-- `getDashboard()` lit alors `undefined`, pas zero, et l'ecran retombe
-- sur les mois de la vue mobile en l'annoncant (« 12 derniers mois »).
-- La fenetre a la journee disparait ; le tableau de bord, non. C'est la
-- regle du depot : une migration absente retire une fonction, jamais un
-- ecran.
--
-- Colonnes verifiees contre la base reelle le 2026-10-22 par sonde
-- PostgREST anonyme (`42703` pour une colonne absente, `42501` sur
-- `is_admin()` pour une colonne presente) : `payments.amount`,
-- `payments.status`, `payments.payment_type`, `payments.paid_at`,
-- `payments.created_at` repondent toutes `42501`.
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
  v_days   integer := greatest(coalesce(p_period_days, 30), 1);
  -- Le pas de temps suit la fenetre : une barre par jour pour une
  -- semaine, par semaine pour un mois ou un trimestre, par mois au-dela.
  -- Trente barres journalieres dans une liste de barres horizontales
  -- feraient 1 200 px de haut — le graphique cesserait d'etre lisible
  -- d'un coup d'oeil, ce qui est sa seule raison d'etre.
  v_bucket text := case
    when v_days <= 10  then 'jour'
    when v_days <= 100 then 'semaine'
    else 'mois'
  end;
  v_unit text := case v_bucket
    when 'jour'    then 'day'
    when 'semaine' then 'week'
    else 'month'
  end;
  v_step interval := ('1 ' || v_unit)::interval;
  -- Combien de pas entiers couvrent la duree demandee.
  v_buckets integer := case v_bucket
    when 'jour'    then v_days
    when 'semaine' then ceil(v_days / 7.0)::integer
    else                ceil(v_days / 31.0)::integer
  end;
  -- ⚠️ LA FENETRE EST CALEE SUR DES PAS ENTIERS, et c'est la deuxieme
  -- moitie de la correction. Une fenetre glissante brute
  -- (`now() - 7 jours`) coupe le pas le plus ancien en son milieu : la
  -- barre etiquetee « 15 oct. » n'aurait contenu que l'apres-midi du 15,
  -- et se serait lue comme une journee entiere en chute. On part donc du
  -- debut du plus ancien pas, et c'est cette borne — et non la duree
  -- demandee — que la fonction renvoie, pour que l'ecran annonce la
  -- periode qu'il mesure reellement plutot que celle qu'on a cliquee.
  v_from timestamptz := date_trunc(v_unit, now()) - (v_buckets - 1) * v_step;
  -- La fenetre precedente a EXACTEMENT la meme duree ecoulee, de sorte
  -- que l'evolution compare deux durees egales : le pas en cours est
  -- incomplet des deux cotes, donc il ne biaise rien.
  v_previous timestamptz := v_from - (now() - v_from);
begin
  if not public.is_admin() then
    raise exception 'acces refuse' using errcode = '42501';
  end if;

  with next_event as (
    -- Le prochain evenement publie : le bandeau de bas d'ecran. Lu une
    -- fois, et ses inscriptions comptees dans la foulee.
    select id, title, event_date, start_time, location, capacity
    from public.scout_days
    where status = 'publie'
      and event_date >= current_date
    order by event_date
    limit 1
  ),
  approvals as (
    -- Delai d'approbation : l'ecart entre la creation du profil et la
    -- decision, sur les 200 derniers profils valides.
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
      (
        select count(*)
        from public.subscriptions s
        where s.plan_id = pl.id
          and s.status = 'active'
      ) as active_count
    from public.subscription_plans pl
  ),
  -- Les encaissements de la fenetre, groupes au pas choisi. Meme
  -- definition du revenu que `admin_dashboard_revenue` : statut
  -- « reussi », colonne `amount`, horodatage `paid_at`.
  revenue as (
    select
      date_trunc(v_unit, p.paid_at) as bucket,
      p.payment_type,
      sum(p.amount)                 as amount,
      count(*)                      as transactions
    from public.payments p
    where p.status = 'reussi'
      and p.paid_at >= v_from
    group by 1, 2
  ),
  -- ⚠️ LA TRAME DU TEMPS, pas seulement les pas qui ont du revenu. Une
  -- semaine sans encaissement doit apparaitre a zero : sinon le
  -- graphique recolle les barres et une interruption se lit comme une
  -- continuite.
  buckets as (
    select generate_series(
      v_from,
      date_trunc(v_unit, now()),
      v_step
    ) as bucket
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
      where last_login_at >= v_from
    ),
    'pending_reports', (
      select count(*) from public.reports where status = 'en_attente'
    ),
    'docs_pending', (
      select count(*) from public.professional_documents where status = 'en_attente'
    ),
    'payments_total', (select count(*) from public.payments),
    'payments_succeeded', (
      select count(*) from public.payments
      where status in ('reussi', 'active_manuellement')
    ),
    -- Le meme taux, mais sur la fenetre affichee. `created_at` et non
    -- `paid_at` : un paiement qui n'a jamais abouti n'a pas de
    -- `paid_at`, et c'est precisement celui que le taux doit compter au
    -- denominateur.
    'payments_period_total', (
      select count(*) from public.payments where created_at >= v_from
    ),
    'payments_period_succeeded', (
      select count(*) from public.payments
      where created_at >= v_from
        and status in ('reussi', 'active_manuellement')
    ),
    'revenue_bucket', v_bucket,
    'revenue_from', v_from,
    'revenue_series', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'bucket',         b.bucket,
            'abonnement',     coalesce(a.amount, 0),
            'scout_day',      coalesce(s.amount, 0),
            'abonnement_tx',  coalesce(a.transactions, 0),
            'scout_day_tx',   coalesce(s.transactions, 0)
          )
          order by b.bucket
        ),
        '[]'::jsonb
      )
      from buckets b
      left join revenue a on a.bucket = b.bucket and a.payment_type = 'abonnement'
      left join revenue s on s.bucket = b.bucket and s.payment_type = 'scout_day'
    ),
    'revenue_previous_total', (
      select coalesce(sum(p.amount), 0)
      from public.payments p
      where p.status = 'reussi'
        and p.paid_at >= v_previous
        and p.paid_at <  v_from
    ),
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
  'Les lectures du tableau de bord du back-office en une, revenus fenetres sur la periode demandee. Facultative : l''appelant retombe sur ses requetes d''origine si elle est absente, et sur les revenus mensuels si elle est d''une version anterieure.';

revoke all on function public.admin_dashboard_counts(integer) from public;
grant execute on function public.admin_dashboard_counts(integer) to authenticated;
