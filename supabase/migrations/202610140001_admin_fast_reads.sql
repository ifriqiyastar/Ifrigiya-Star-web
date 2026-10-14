-- =====================================================================
-- IFRIQIYA STAR — Back-office : deux lectures de chargement regroupees
-- en une seule fonction chacune.
--
-- POURQUOI. Rien ici n'est nouveau : ces deux fonctions ne font que ce
-- que le code applicatif faisait deja, mais en un aller-retour au lieu
-- de quinze. Le back-office parle a un projet Supabase distant, et le
-- temps d'une page est domine par le nombre d'allers-retours, pas par le
-- travail de Postgres :
--
--   * `getAdminAccess()` lisait les quatre tables RBAC en trois vagues
--     successives (le role, puis ses liens, puis les codes), pour un
--     role qui ne change quasiment jamais ;
--   * `fetchAdminQueue()` comptait dix files avec dix requetes
--     `count exact` separees, a chaque rendu du layout — donc aussi a
--     chaque sondage de la cloche, toutes les dix secondes.
--
-- Mesure depuis un poste de developpement (aller-retour chaud ~100 ms,
-- froid ~500 ms) : 2,2 s de reseau pour un chargement d'ecran a chaud,
-- 12,5 s a froid, dont 0,6 a 6,8 s pour la seule rafale des dix
-- comptages.
--
-- ⚠️ CES FONCTIONS NE SONT PAS OBLIGATOIRES. Les deux appelants
-- retombent sur leurs requetes d'origine si la fonction est absente
-- (`PGRST202`), comme le reste du back-office degrade a l'ouverture
-- quand une migration n'est pas appliquee. Ce script accelere, il ne
-- conditionne rien.
--
-- `security definer` pour la meme raison que `admin_has_permission` :
-- les tables RBAC ne sont pas toutes lisibles par le role
-- `authenticated`, et un comptage doit voir les lignes que le RLS
-- montrerait de toute facon a un administrateur. Les deux fonctions
-- exigent donc `public.is_admin()` en premiere ligne — c'est la meme
-- question que pose le RLS des tables comptees, posee une fois.
--
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Le role RBAC du compte et ses permissions, en une ligne.
--
-- Rend aussi `known` — tous les codes semes au referentiel. L'appelant en
-- a besoin pour sa regle de repli (« une permission que le code connait
-- mais que la base n'a pas encore semee reste accordee »), et la lui
-- rendre ici evite la requete supplementaire qui la lisait.
-- ---------------------------------------------------------------------
create or replace function public.admin_access(p_admin_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
  v_role_code text;
  v_role_label text;
  v_granted text[];
  v_known text[];
begin
  if not public.is_admin() then
    raise exception 'acces refuse' using errcode = '42501';
  end if;

  select array_agg(code order by code) into v_known from public.admin_permissions;

  select ur.role_id, r.code, r.label
    into v_role_id, v_role_code, v_role_label
  from public.admin_user_roles ur
  join public.admin_roles r on r.id = ur.role_id
  where ur.admin_id = p_admin_id;

  if v_role_id is null then
    return jsonb_build_object(
      'assigned', false,
      'known', coalesce(to_jsonb(v_known), '[]'::jsonb)
    );
  end if;

  select array_agg(ap.code order by ap.code) into v_granted
  from public.admin_role_permissions rp
  join public.admin_permissions ap on ap.id = rp.permission_id
  where rp.role_id = v_role_id;

  return jsonb_build_object(
    'assigned', true,
    'role_code', v_role_code,
    'role_label', v_role_label,
    'granted', coalesce(to_jsonb(v_granted), '[]'::jsonb),
    'known', coalesce(to_jsonb(v_known), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_access(uuid) from public;
grant execute on function public.admin_access(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Les dix files d'attente, comptees en une fois.
--
-- Les comptages passent par du SQL dynamique **uniquement** pour pouvoir
-- rattraper l'absence d'une table ou d'une colonne file par file : une
-- seule requete a dix sous-selects echouerait en entier des que le
-- projet n'a pas encore applique une migration mobile (`posts
-- .moderation_status` arrive avec 0089). C'est la regle du depot —
-- degrader a l'ouverture, et perdre la file plutot que l'ecran. Aucune
-- de ces chaines ne depend d'une entree : il n'y a rien a injecter.
--
-- Les cles rendues sont exactement celles attendues par
-- `fetchAdminQueue()`. En ajouter une ici sans l'ajouter la-bas ne casse
-- rien ; l'inverse non plus — une cle absente est lue comme zero.
-- ---------------------------------------------------------------------
create or replace function public.admin_queue_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  spec record;
  n bigint;
  result jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'acces refuse' using errcode = '42501';
  end if;

  for spec in
    select * from (values
      ('players',
       'select count(*) from public.player_profiles where status = ''en_attente_validation'''),
      ('professionals',
       'select count(*) from public.professional_profiles where status = ''en_attente_validation'''),
      ('documents',
       'select count(*) from public.professional_documents where status = ''en_attente'''),
      ('identity',
       'select count(*) from public.identity_verifications where status = ''en_attente'''),
      ('reports',
       'select count(*) from public.reports where status = ''en_attente'''),
      ('removals',
       'select count(*) from public.reports where status = ''a_valider'''),
      ('posts',
       'select count(*) from public.posts where moderation_status = ''en_attente'' and is_deleted = false'),
      ('comments',
       'select count(*) from public.post_comments where moderation_status = ''en_attente'' and is_deleted = false'),
      ('scoutDays',
       'select count(*) from public.scout_days where status = ''en_attente_validation'''),
      ('deletions',
       'select count(*) from public.profiles where deletion_requested_at is not null')
    ) as t(key, statement)
  loop
    begin
      execute spec.statement into n;
    exception
      -- Table, colonne ou valeur d'enumeration que ce projet n'a pas
      -- encore : la file vaut zero et disparait de la cloche, le reste
      -- des comptages continue.
      when undefined_table or undefined_column or invalid_text_representation then
        n := 0;
    end;
    result := result || jsonb_build_object(spec.key, n);
  end loop;

  return result;
end;
$$;

revoke all on function public.admin_queue_counts() from public;
grant execute on function public.admin_queue_counts() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Les six tuiles de `/admin/utilisateurs`, comptees en une fois.
--
-- Ces six nombres portent sur toute la base et **ne dependent pas de la page
-- affichee** — pourtant ils etaient recomptes a chaque clic sur « Suivant »,
-- en six requetes separees, en plus de celles que coute deja un rendu
-- d'ecran. Un clic de pagination demandait ainsi une quinzaine d'allers-
-- retours au projet Supabase.
--
-- Meme forme et memes garanties que `admin_queue_counts()` ci-dessus : garde
-- `is_admin()`, un comptage par bloc d'exception, et l'appelant retombe sur
-- ses six requetes si la fonction est absente.
-- ---------------------------------------------------------------------
create or replace function public.admin_user_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  spec record;
  n bigint;
  result jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'acces refuse' using errcode = '42501';
  end if;

  for spec in
    select * from (values
      ('all',               'select count(*) from public.profiles'),
      ('active',            'select count(*) from public.profiles where is_active'),
      ('players',           'select count(*) from public.profiles where role = ''player'''),
      ('professionals',     'select count(*) from public.profiles where role = ''professional'''),
      ('playerProfiles',    'select count(*) from public.player_profiles'),
      ('identityValidated', 'select count(*) from public.identity_verifications where status = ''valide''')
    ) as t(key, statement)
  loop
    begin
      execute spec.statement into n;
    exception
      when undefined_table or undefined_column or invalid_text_representation then
        n := 0;
    end;
    result := result || jsonb_build_object(spec.key, n);
  end loop;

  return result;
end;
$$;

revoke all on function public.admin_user_stats() from public;
grant execute on function public.admin_user_stats() to authenticated;

notify pgrst, 'reload schema';
