-- =====================================================================
-- IFRIQIYA STAR — Back-office : choisir les canaux d'une diffusion (§11).
--
-- DEUX DEFAUTS, ET LE PREMIER EST UN CHIFFRE FAUX.
--
-- 1. « X comptes joignables par push » affichait **toujours zero**, sur
--    toutes les installations. Ce n'etait pas une mesure : `push_tokens` n'a
--    qu'une policy `push_tokens_manage_own` (`profile_id = auth.uid()`), et
--    la migration mobile 0023 dit explicitement pourquoi il n'y a pas de
--    policy d'administration — « personne d'autre ne doit pouvoir lire les
--    jetons : ils permettent d'envoyer une notification a un utilisateur ».
--    La session administrateur est donc filtree comme les autres et lit une
--    liste vide. L'ecran en deduisait une portee nulle et annoncait que
--    personne ne recevrait de push.
--
--    ⚠️ La correction n'est **pas** d'ouvrir la table. C'est une fonction qui
--    ne rend qu'un **nombre** : aucun jeton ne sort de la base, et la regle
--    de 0023 tient toujours.
--
-- 2. Le push ne se decochait pas. L'insertion d'une ligne dans
--    `public.notifications` **est** la notification in-app, et c'est elle qui
--    declenche le push (trigger de 0023) : les deux etaient un seul geste.
--    Le trigger apprend ici a s'abstenir quand la notification porte
--    `data->>'push' = 'false'`, et la diffusion apprend a le poser.
--
--    ⚠️ L'in-app, lui, reste **obligatoire**, et ce n'est pas un oubli : la
--    ligne `notifications` est a la fois l'element de la cloche et le
--    declencheur du push. « Push sans in-app » demanderait un second chemin
--    d'envoi, appelant Expo avec les jetons — que le back-office ne peut pas
--    lire, par la decision de 0023 rappelee ci-dessus.
--
-- Idempotent : relancable sans erreur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La portee push, sans exposer un seul jeton
-- ---------------------------------------------------------------------
create or replace function public.admin_push_reach()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Reserve a l''administration.'
      using errcode = '42501', hint = 'admin_only';
  end if;

  select count(distinct t.profile_id) into v_count
    from public.push_tokens t
    join public.profiles p on p.id = t.profile_id
   where p.is_active;

  return coalesce(v_count, 0);
end;
$$;

comment on function public.admin_push_reach() is
  'Nombre de comptes actifs ayant au moins un jeton de push. Rend un entier et jamais un jeton : push_tokens n''a volontairement pas de policy d''administration (migration mobile 0023).';

revoke all on function public.admin_push_reach() from public;
grant execute on function public.admin_push_reach() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Le trigger de push apprend a s'abstenir
--
-- Corps identique a celui de la migration mobile 0046, **plus** la sortie
-- anticipee. Aucun autre appelant ne pose la cle `push` dans `data`, donc le
-- comportement de toutes les notifications existantes est inchange.
-- ---------------------------------------------------------------------
create or replace function public.send_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tokens text[];
  v_body   text;
begin
  -- ⚠️ La seule ligne ajoutee a 0046. `data->>'push' = 'false'` veut dire
  -- « l'expediteur a decoche le push » : la notification in-app existe, la
  -- cloche s'allume, rien ne part sur l'appareil.
  if new.data ? 'push' and new.data->>'push' = 'false' then
    return new;
  end if;

  select array_agg(t.token) into v_tokens
    from public.push_tokens t
   where t.profile_id = new.profile_id;

  if v_tokens is null or array_length(v_tokens, 1) = 0 then
    return new;
  end if;

  v_body := case new.type
    when 'nouveau_message' then 'Ouvrez Ifriqiya Star pour lire votre message.'
    when 'consultation_profil' then 'Un professionnel a consulté votre profil.'
    when 'validation_compte' then 'Votre compte a été validé.'
    when 'refus_compte' then 'Votre dossier nécessite votre attention.'
    else new.body
  end;

  begin
    perform net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send',
      body    := jsonb_build_object(
                   'to', to_jsonb(v_tokens),
                   'title', new.title,
                   'body', v_body,
                   'sound', 'default',
                   'channelId', 'messages',
                   'priority', 'high',
                   'data', new.data || jsonb_build_object('type', new.type,
                                                          'notification_id', new.id)
                 ),
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Accept', 'application/json'
                 )
    );
  exception when others then
    raise notice 'Push non envoyé (%): %', sqlstate, sqlerrm;
  end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. La diffusion, avec le choix du push
--
-- ⚠️ Une **cinquieme** parametre cree une surcharge : la signature a quatre
-- arguments de 0046 continue d'exister, et PostgREST choisit d'apres les
-- parametres nommes recus. Pour qu'il n'y ait pas deux corps a maintenir, la
-- version a quatre arguments devient un simple relais vers celle-ci.
--
-- Si le depot mobile rejoue un jour 0046, il rendra a la version a quatre
-- arguments son corps complet : le back-office appelle la version a cinq, qui
-- n'est pas touchee, donc rien ne casse — le relais est seulement perdu.
-- ---------------------------------------------------------------------
create or replace function public.admin_broadcast_notification(
  p_title        text,
  p_body         text,
  p_target_type  text,
  p_target_value text,
  p_push         boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'L''envoi de notifications est reserve a l''administration.'
      using errcode = '42501', hint = 'admin_only';
  end if;

  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_body), '') = '' then
    raise exception 'Titre et message sont obligatoires.'
      using errcode = '22023', hint = 'title_body_required';
  end if;

  if p_target_type not in ('all', 'role', 'user', 'scout_day') then
    raise exception 'Cible inconnue : %.', p_target_type
      using errcode = '22023', hint = 'unknown_target';
  end if;

  if p_target_type <> 'all' and coalesce(btrim(p_target_value), '') = '' then
    raise exception 'Cette cible demande une valeur (role, compte ou evenement).'
      using errcode = '22023', hint = 'target_value_required';
  end if;

  with destinataires as (
    select p.id
      from public.profiles p
     where p.is_active
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
       )
  )
  insert into public.notifications (profile_id, type, title, body, email_required, data)
  select
    d.id,
    'autre',
    btrim(p_title),
    btrim(p_body),
    false,
    jsonb_build_object('source', 'admin_campaign', 'target_type', p_target_type)
      -- La cle n'est posee que pour refuser : une notification ordinaire ne
      -- porte pas `push`, et le trigger ne la cherche que pour s'abstenir.
      || case when coalesce(p_push, true) then '{}'::jsonb else jsonb_build_object('push', false) end
  from destinataires d;

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

comment on function public.admin_broadcast_notification(text, text, text, text, boolean) is
  'Diffuse une notification depuis le back-office (§11/§12). p_push = false pose data->>push = false, que le trigger de 0023 lit pour ne pas envoyer de push : la notification in-app existe quand meme. Renvoie le nombre de destinataires.';

-- Le relais : meme signature que 0046, un seul corps a maintenir.
create or replace function public.admin_broadcast_notification(
  p_title        text,
  p_body         text,
  p_target_type  text,
  p_target_value text default null
)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.admin_broadcast_notification(p_title, p_body, p_target_type, p_target_value, true);
$$;

comment on function public.admin_broadcast_notification(text, text, text, text) is
  'Relais vers la version a cinq arguments, avec le push actif. Conserve pour les appelants anterieurs a la migration 202609300002.';

revoke all on function public.admin_broadcast_notification(text, text, text, text, boolean) from public;
revoke all on function public.admin_broadcast_notification(text, text, text, text) from public;
grant execute on function public.admin_broadcast_notification(text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_broadcast_notification(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
