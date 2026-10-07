-- =====================================================================
-- IFRIQIYA STAR — Back-office : le preavis minimum d'un Scout Day (§8.1).
--
-- DEMANDE CLIENT (2026-10-07). Un professionnel pouvait deposer un Scout Day
-- pour le lendemain : l'evenement arrivait dans la file de validation, en
-- ressortait publie quelques heures avant, et aucun joueur n'avait le temps de
-- le voir ni de s'inscrire. Le super administrateur fixe desormais un nombre
-- de jours — « au moins 7 jours avant » — et aucun professionnel ne peut
-- soumettre un evenement dont la date tombe dans cette fenetre.
--
-- CE QUE CE FICHIER AJOUTE, ET POURQUOI IL EST ICI. Le reglage est un objet
-- d'administration : c'est le back-office qui le pose, comme les tables RBAC
-- de 202608240001. Aucune table mobile n'est redefinie, et aucune fonction du
-- depot mobile n'est reecrite — la regle est un trigger **supplementaire** sur
-- `public.scout_days`, pas une retouche de `enforce_scout_day_validation()`
-- (migration mobile 0040). Si le depot mobile rejoue 0040, ce fichier reste
-- entier ; l'inverse aurait efface la regle en silence.
--
-- ⚠️ L'ORDRE DES TRIGGERS EST LA RAISON DU NOM. Postgres execute les triggers
-- d'un meme evenement dans l'ordre alphabetique de leur nom, et c'est
-- `trg_enforce_scout_day_validation` qui bascule un brouillon de son
-- organisateur en `en_attente_validation` (la soumission est automatique
-- depuis 0040, il n'y a pas de bouton « soumettre »). Un trigger nomme
-- `trg_check_...` serait passe **avant** cette bascule et n'aurait vu qu'un
-- brouillon : la regle n'aurait filtre personne. `trg_scout_day_min_notice`
-- trie apres `trg_enforce_...`, donc lit le statut deja bascule.
--
-- Idempotent : relancable sans erreur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Le reglage
--
-- Une table a **une seule ligne** (`id boolean primary key check (id)`, le
-- motif habituel) plutot qu'un magasin cle/valeur : la valeur est un entier
-- borne, et une contrainte Postgres vaut mieux qu'un JSON ou n'importe quoi
-- rentre. La table est nommee largement — d'autres reglages de plateforme
-- viendront s'y ajouter en colonnes, pas en lignes.
-- ---------------------------------------------------------------------
create table if not exists public.platform_settings (
  id         boolean primary key default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  constraint chk_platform_settings_singleton check (id)
);

alter table public.platform_settings
  add column if not exists scout_day_min_notice_days integer not null default 7;

-- Ecrite a part de la colonne : `add column if not exists` ne rejoue pas sa
-- contrainte si la colonne existait deja.
alter table public.platform_settings
  drop constraint if exists chk_scout_day_min_notice_days;
alter table public.platform_settings
  add constraint chk_scout_day_min_notice_days
  check (scout_day_min_notice_days between 0 and 365);

comment on table public.platform_settings is
  'Reglages de plateforme poses par le back-office (une seule ligne). Lisible par tout compte authentifie : une regle qui contraint un professionnel doit pouvoir lui etre annoncee avant qu''elle ne le refuse.';
comment on column public.platform_settings.scout_day_min_notice_days is
  'Preavis minimum, en jours, entre le depot d''un Scout Day par son organisateur et la date de l''evenement. 0 = aucune contrainte. Applique par trg_scout_day_min_notice.';

-- La ligne unique. `on conflict do nothing` : un rejeu ne doit pas ecraser la
-- valeur que le super administrateur a choisie entre-temps.
insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

-- ⚠️ LECTURE OUVERTE A TOUT COMPTE AUTHENTIFIE, ET C'EST LE POINT. Le
-- professionnel est **l'assujetti** de cette regle : sans pouvoir la lire,
-- l'application mobile ne peut ni grisier les dates interdites ni expliquer le
-- refus, et il decouvre la contrainte par une erreur. La valeur n'est pas une
-- donnee sensible, c'est une condition d'usage.
drop policy if exists platform_settings_read on public.platform_settings;
create policy platform_settings_read on public.platform_settings
  for select to authenticated using (true);

-- L'ecriture est reservee au super administrateur — la meme main que la
-- validation des Scout Days (0040). `is_super_admin()` vient de cette
-- migration mobile : sur un projet ou elle n'a pas tourne, on retombe sur
-- `is_admin()` plutot que de rendre ce script increable, meme repli que
-- `is_super_admin()` fait lui-meme pour les tables RBAC.
do $$
declare
  v_guard text := case
    when to_regprocedure('public.is_super_admin()') is not null then 'public.is_super_admin()'
    else 'public.is_admin()'
  end;
begin
  execute 'drop policy if exists platform_settings_write on public.platform_settings';
  execute format(
    'create policy platform_settings_write on public.platform_settings '
    'for update to authenticated using (%s) with check (%s)',
    v_guard, v_guard);

  execute 'drop policy if exists platform_settings_insert on public.platform_settings';
  execute format(
    'create policy platform_settings_insert on public.platform_settings '
    'for insert to authenticated with check (%s)',
    v_guard);
end;
$$;

grant select, insert, update on public.platform_settings to authenticated;

-- ---------------------------------------------------------------------
-- 2. Le lecteur
--
-- `security definer` : le trigger ci-dessous tourne avec les droits de celui
-- qui ecrit, et la regle doit tenir meme si une policy de lecture venait a se
-- refermer un jour. Une absence de ligne vaut 0, c'est-a-dire aucune
-- contrainte — le defaut sur donne jamais un refus inexplique.
-- ---------------------------------------------------------------------
create or replace function public.scout_day_min_notice_days()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select s.scout_day_min_notice_days from public.platform_settings s where s.id), 0);
$$;

comment on function public.scout_day_min_notice_days() is
  'Preavis minimum (en jours) exige d''un organisateur deposant un Scout Day. 0 = aucune contrainte.';

revoke all on function public.scout_day_min_notice_days() from public;
grant execute on function public.scout_day_min_notice_days() to authenticated;

-- ---------------------------------------------------------------------
-- 3. La regle
--
-- ⚠️ ELLE NE VISE QUE L'ORGANISATEUR (`organizer_id = auth.uid()`), ET
-- L'ADMINISTRATION EN EST EXEMPTE. Deux raisons, pas une :
--   * le back-office cree un evenement *pour* un professionnel et doit pouvoir
--     rattraper un cas exceptionnel — c'est la voie de derogation, et sans
--     elle plus personne ne peut publier un evenement imminent ;
--   * un evenement soumis dix jours a l'avance et valide la veille serait
--     refuse au moment de la validation, c'est-a-dire que le super
--     administrateur se verrait interdire de publier ce qu'il vient
--     d'accepter.
--
-- ⚠️ ET ELLE NE SE DECLENCHE QUE SUR UN GESTE QUI LA CONCERNE : entrer dans
-- la file de validation, ou deplacer la date. Corriger le titre d'un
-- evenement imminent deja soumis reste possible — sinon un organisateur
-- pris par la regle ne pourrait plus rien corriger du tout.
--
-- Le message est **accentue**, contrairement au reste du depot : il est lu
-- par un professionnel dans l'application mobile, pas par un administrateur.
-- Son `hint` suit la convention de 0028 et 0040, que `describeError()` cote
-- back-office reconnait.
-- ---------------------------------------------------------------------
create or replace function public.check_scout_day_min_notice()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_days       integer := public.scout_day_min_notice_days();
  v_entering   boolean;
  v_date_moved boolean;
begin
  if v_days <= 0 then
    return new;
  end if;

  if new.organizer_id is distinct from auth.uid() then
    return new;
  end if;

  -- `old` n'est pas assignable dans un trigger INSERT : on teste tg_op dans
  -- une instruction distincte plutot que dans un `or`, dont plpgsql ne
  -- garantit pas le court-circuit. Meme precaution que 0040.
  if tg_op = 'INSERT' then
    v_entering   := true;
    v_date_moved := true;
  else
    v_entering   := old.status::text is distinct from new.status::text;
    v_date_moved := old.event_date is distinct from new.event_date;
  end if;

  if new.status::text in ('en_attente_validation', 'publie')
     and (v_entering or v_date_moved)
     and new.event_date < current_date + v_days then
    raise exception 'Un Scout Day doit être déposé au moins % jour(s) avant sa date. Le % est trop proche : la première date possible est le %.',
      v_days, new.event_date, current_date + v_days
      using errcode = '22023', hint = 'scout_day_min_notice';
  end if;

  return new;
end;
$$;

comment on function public.check_scout_day_min_notice() is
  'Exige le preavis de platform_settings.scout_day_min_notice_days quand un organisateur depose ou redate son propre Scout Day (§8.1). L''administration en est exempte : elle est la voie de derogation.';

drop trigger if exists trg_scout_day_min_notice on public.scout_days;
create trigger trg_scout_day_min_notice
before insert or update on public.scout_days
for each row execute function public.check_scout_day_min_notice();

-- Nouvelle table : PostgREST doit relire le schema pour l'exposer.
notify pgrst, 'reload schema';
