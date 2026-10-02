-- =====================================================================
-- IFRIQIYA STAR — Back-office : plusieurs modeles d'e-mail, et le choix
-- du modele au moment de la diffusion (§11).
--
-- CE QUI CHANGE PAR RAPPORT A 202609300003. Cette migration-la ne permettait
-- **qu'un** habillage : une ligne par langue, et tous les envois le
-- partageaient. Le client veut choisir, a l'envoi, quel courriel part — une
-- annonce de Scout Day ne se redige pas comme un rappel d'inscription.
--
-- Le modele devient donc un objet nomme, et les textes lui appartiennent :
--
--   admin_email_templates        le catalogue  (id, nom, defaut)
--   admin_email_template         les textes    (template_id, langue, phrases)
--
-- ⚠️ La table de textes n'est **pas** renommee, volontairement. Renommee,
-- un rejeu de 202609300003 recreerait une table fantome du meme nom avec son
-- ancienne cle primaire, et personne ne le verrait avant de chercher pourquoi
-- un modele ne s'enregistre plus. Elle gagne une colonne et change de cle.
--
-- ⚠️ La reprise des lignes existantes est ecrite pour un cas qui ne s'est
-- probablement pas produit — la table est neuve — mais elle doit exister :
-- une installation qui avait deja personnalise son habillage doit le
-- retrouver **dans** le modele par defaut, pas le perdre.
--
-- Idempotent : relancable sans erreur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Le catalogue
-- ---------------------------------------------------------------------
create table if not exists public.admin_email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- A quoi sert ce modele : note interne, jamais envoyee.
  description text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id)
);

comment on table public.admin_email_templates is
  'Catalogue des modeles d''e-mail du back-office. Les phrases de chaque modele vivent dans admin_email_template, une ligne par langue.';

-- ⚠️ Un seul modele par defaut, et c'est Postgres qui le tient : gere dans
-- le code, deux clics rapprochés en laisseraient deux, et la diffusion
-- choisirait alors au hasard.
create unique index if not exists idx_email_templates_single_default
  on public.admin_email_templates (is_default) where is_default;

-- ---------------------------------------------------------------------
-- 2. Les textes appartiennent a un modele
-- ---------------------------------------------------------------------
alter table public.admin_email_template
  add column if not exists template_id uuid references public.admin_email_templates(id) on delete cascade;

do $$
declare
  v_default uuid;
begin
  -- Un modele par defaut doit exister : c'est lui qu'une diffusion prend
  -- quand personne n'a choisi.
  select id into v_default from public.admin_email_templates where is_default limit 1;
  if v_default is null then
    insert into public.admin_email_templates (name, description, is_default)
    values ('Modele par defaut', 'Habillage utilise quand aucun modele n''est choisi.', true)
    returning id into v_default;
  end if;

  -- Reprise : les lignes ecrites avant cette migration rejoignent ce modele.
  update public.admin_email_template set template_id = v_default where template_id is null;
end
$$;

alter table public.admin_email_template alter column template_id set not null;

-- Nouvelle cle : un modele porte une ligne par langue.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.admin_email_template'::regclass
       and contype = 'p' and conname = 'admin_email_template_pkey'
       and (select array_agg(attname order by attnum)
              from pg_attribute
             where attrelid = conrelid and attnum = any(conkey)) = array['locale']::name[]
  ) then
    alter table public.admin_email_template drop constraint admin_email_template_pkey;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.admin_email_template'::regclass and contype = 'p'
  ) then
    alter table public.admin_email_template
      add constraint admin_email_template_pkey primary key (template_id, locale);
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 3. La campagne retient le modele employe
--
-- Sans cette colonne, le journal dirait qu'un courriel est parti sans dire
-- lequel — et le modele, lui, peut avoir ete modifie depuis.
-- `on delete set null` : supprimer un modele ne doit pas effacer l'historique.
-- ---------------------------------------------------------------------
alter table public.admin_notification_campaigns
  add column if not exists email_template_id uuid
  references public.admin_email_templates(id) on delete set null;

-- ---------------------------------------------------------------------
-- 4. Droits : meme regle que pour les textes
-- ---------------------------------------------------------------------
alter table public.admin_email_templates enable row level security;

drop policy if exists admin_email_templates_read on public.admin_email_templates;
create policy admin_email_templates_read on public.admin_email_templates for select to authenticated
using (public.admin_has_permission('notifications.manage'));

-- L'ecriture reste au super administrateur, et Postgres le verifie.
drop policy if exists admin_email_templates_write on public.admin_email_templates;
create policy admin_email_templates_write on public.admin_email_templates for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

grant select, insert, update, delete on public.admin_email_templates to authenticated;
-- Supprimer une langue d'un modele, ou le modele entier, demande le DELETE
-- que 202609300003 n'accordait pas.
grant delete on public.admin_email_template to authenticated;

create or replace function public.stamp_email_templates()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_stamp_email_templates on public.admin_email_templates;
create trigger trg_stamp_email_templates before insert or update on public.admin_email_templates
for each row execute function public.stamp_email_templates();

-- ⚠️ Le dernier modele ne se supprime pas : la diffusion n'aurait plus
-- d'habillage a prendre, et l'ecran n'aurait plus rien a montrer.
create or replace function public.guard_last_email_template()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.admin_email_templates) <= 1 then
    raise exception 'Le dernier modele d''e-mail ne peut pas etre supprime.'
      using errcode = '23503', hint = 'last_email_template';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_guard_last_email_template on public.admin_email_templates;
create trigger trg_guard_last_email_template before delete on public.admin_email_templates
for each row execute function public.guard_last_email_template();

notify pgrst, 'reload schema';
