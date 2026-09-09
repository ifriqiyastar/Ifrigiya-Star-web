-- Extensions du back-office Ifriqiya Star.
-- Idempotent et compatible avec le schema mobile existant.

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text
);

create table if not exists public.admin_role_permissions (
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  permission_id uuid not null references public.admin_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.admin_user_roles (
  admin_id uuid primary key references public.profiles(id) on delete cascade,
  role_id uuid not null references public.admin_roles(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now()
);

insert into public.admin_roles (code, label, description) values
  ('super_admin', 'Super administrateur', 'Tous les droits, y compris les roles.'),
  ('validator', 'Validateur', 'Validation des joueurs et professionnels.'),
  ('moderator', 'Moderateur', 'Signalements et contenus.'),
  ('event_manager', 'Responsable evenements', 'Scout Days, inscriptions et presences.'),
  ('finance_admin', 'Administrateur finances', 'Plans, abonnements, paiements et remboursements.'),
  ('support', 'Support', 'Lecture des comptes et actions limitees.')
on conflict (code) do update set label = excluded.label, description = excluded.description;

insert into public.admin_permissions (code, description) values
  ('dashboard.read', 'Consulter le tableau de bord'), ('users.read', 'Consulter les comptes'),
  ('users.write', 'Modifier les comptes'), ('verifications.review', 'Traiter les validations'),
  ('moderation.manage', 'Moderer les contenus'), ('events.manage', 'Gerer les Scout Days'),
  ('evaluations.manage', 'Gerer les evaluations'), ('finance.manage', 'Gerer les finances'),
  ('notifications.manage', 'Gerer les notifications'), ('audit.read', 'Consulter le journal')
on conflict (code) do update set description = excluded.description;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r cross join public.admin_permissions p
where r.code = 'super_admin' on conflict do nothing;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p on
  (r.code = 'validator' and p.code in ('dashboard.read','users.read','verifications.review')) or
  (r.code = 'moderator' and p.code in ('dashboard.read','users.read','moderation.manage')) or
  (r.code = 'event_manager' and p.code in ('dashboard.read','users.read','events.manage','evaluations.manage','notifications.manage')) or
  (r.code = 'finance_admin' and p.code in ('dashboard.read','users.read','finance.manage','audit.read')) or
  (r.code = 'support' and p.code in ('dashboard.read','users.read','users.write'))
on conflict do nothing;

-- Le premier deploiement conserve l'acces des admins existants.
insert into public.admin_user_roles (admin_id, role_id)
select p.id, r.id from public.profiles p cross join public.admin_roles r
where p.role = 'admin' and r.code = 'super_admin'
on conflict (admin_id) do nothing;

create or replace function public.admin_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.admin_user_roles ur on ur.admin_id = p.id
    join public.admin_role_permissions rp on rp.role_id = ur.role_id
    join public.admin_permissions ap on ap.id = rp.permission_id
    where p.id = auth.uid() and p.role = 'admin' and p.is_active and ap.code = p_permission
  );
$$;
revoke all on function public.admin_has_permission(text) from public;
grant execute on function public.admin_has_permission(text) to authenticated;

create table if not exists public.admin_notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_type text not null check (target_type in ('all','role','user','scout_day')),
  target_value text,
  channels text[] not null check (cardinality(channels) > 0),
  status text not null default 'queued' check (status in ('queued','processing','sent','failed')),
  recipient_count integer not null default 0,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.admin_notification_campaigns(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('in_app','push','email')),
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed')),
  provider_reference text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  unique (campaign_id, recipient_id, channel)
);

create table if not exists public.scout_evaluation_history (
  id bigint generated always as identity primary key,
  evaluation_id uuid not null,
  snapshot jsonb not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create or replace function public.capture_scout_evaluation_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.scout_evaluation_history(evaluation_id, snapshot, changed_by)
  values (old.id, to_jsonb(old), auth.uid());
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists trg_scout_evaluation_history on public.scout_evaluations;
create trigger trg_scout_evaluation_history before update or delete on public.scout_evaluations
for each row execute function public.capture_scout_evaluation_history();

alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_user_roles enable row level security;
alter table public.admin_notification_campaigns enable row level security;
alter table public.admin_notification_deliveries enable row level security;
alter table public.scout_evaluation_history enable row level security;

drop policy if exists admin_roles_read on public.admin_roles;
create policy admin_roles_read on public.admin_roles for select to authenticated using (public.is_admin());
drop policy if exists admin_permissions_read on public.admin_permissions;
create policy admin_permissions_read on public.admin_permissions for select to authenticated using (public.is_admin());
drop policy if exists admin_role_permissions_read on public.admin_role_permissions;
create policy admin_role_permissions_read on public.admin_role_permissions for select to authenticated using (public.is_admin());
drop policy if exists admin_user_roles_read on public.admin_user_roles;
create policy admin_user_roles_read on public.admin_user_roles for select to authenticated using (public.is_admin());
-- Aucune policy d'ecriture sur `admin_user_roles` : l'ecran d'attribution des
-- roles ne figure pas au cahier des charges et a ete retire. L'attribution se
-- fait dans l'editeur SQL de Supabase, qui passe outre RLS.
drop policy if exists admin_campaigns_manage on public.admin_notification_campaigns;
create policy admin_campaigns_manage on public.admin_notification_campaigns for all to authenticated
using (public.admin_has_permission('notifications.manage')) with check (public.admin_has_permission('notifications.manage'));
drop policy if exists admin_deliveries_manage on public.admin_notification_deliveries;
create policy admin_deliveries_manage on public.admin_notification_deliveries for all to authenticated
using (public.admin_has_permission('notifications.manage')) with check (public.admin_has_permission('notifications.manage'));
drop policy if exists evaluation_history_read on public.scout_evaluation_history;
create policy evaluation_history_read on public.scout_evaluation_history for select to authenticated
using (public.admin_has_permission('evaluations.manage'));
