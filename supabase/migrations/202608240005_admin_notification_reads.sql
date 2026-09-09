-- =====================================================================
-- IFRIQIYA STAR — Back-office : etat « lu » des notifications, cote admin.
--
-- POURQUOI UNE TABLE PLUTOT QUE `notifications.is_read`. La cloche du
-- back-office liste les notifications de **toute la plateforme** — un
-- administrateur les lit toutes, `notifications_select_own` porte
-- `or public.is_admin()`. Mais `is_read` appartient a son **destinataire** :
-- la policy d'ecriture est `notifications_update_own_mark_read`, strictement
-- `profile_id = auth.uid()`, et c'est une bonne regle. Marquer « lu » la
-- notification de quelqu'un d'autre ferait disparaitre sa pastille de non-lus
-- sans qu'il ait rien vu — on falsifierait sa boite pour vider la notre.
--
-- L'etat de lecture de l'administrateur est donc **le sien**, range a part.
-- Une ligne par (administrateur, notification) : la table ne grossit que de ce
-- que l'administration a effectivement marque, et `on delete cascade` la
-- nettoie quand la notification disparait.
--
-- Idempotent.
-- =====================================================================

create table if not exists public.admin_notification_reads (
  admin_id        uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (admin_id, notification_id)
);

comment on table public.admin_notification_reads is
  'Notifications deja lues *par un administrateur* dans le back-office. Distinct de notifications.is_read, qui appartient au destinataire.';

create index if not exists idx_admin_notification_reads_admin
  on public.admin_notification_reads (admin_id);

alter table public.admin_notification_reads enable row level security;

-- Chacun ne voit et n'ecrit que ses propres marques de lecture.
drop policy if exists admin_notification_reads_own on public.admin_notification_reads;
create policy admin_notification_reads_own on public.admin_notification_reads for all to authenticated
using (admin_id = auth.uid() and public.is_admin())
with check (admin_id = auth.uid() and public.is_admin());

grant select, insert, delete on public.admin_notification_reads to authenticated;

notify pgrst, 'reload schema';
