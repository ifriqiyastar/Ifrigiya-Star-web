-- =====================================================================
-- IFRIQIYA STAR — Back-office : la cloche annonce l'argent qui attend.
--
-- POURQUOI. Un joueur s'inscrit a un Scout Day payant depuis l'application
-- mobile ; cote administration, personne n'est prevenu. L'inscription
-- n'a aucune ligne dans `public.payments` tant que l'encaissement n'est
-- pas saisi — c'est l'etat normal d'un reglement en especes — donc
-- l'ecran « Paiements » paraissait a jour alors qu'il restait de l'argent
-- a encaisser, et il fallait penser a aller voir. Demande client : que le
-- super administrateur en soit averti.
--
-- La « notification » du back-office, ce n'est pas `public.notifications`
-- (c'est la boite de reception des UTILISATEURS, et ce depot s'interdit
-- de l'afficher) : c'est la cloche du bandeau, qui compte ce qui attend
-- une decision dans les tables metier. Deux files s'y ajoutent donc :
--
--   * `collect`         — inscription a un evenement payant sans aucun
--                         paiement vivant : il y a de l'argent a
--                         encaisser ;
--   * `paymentsPending` — paiement en attente : la passerelle (ou un
--                         encaissement hors ligne) attend une
--                         confirmation.
--
-- Les deux sont reservees a `finance.manage` cote application —
-- `super_admin` et `finance_admin` — parce que pointer un moderateur vers
-- un ecran dont tous les boutons lui seront refuses n'est pas une
-- notification, c'est une impasse.
--
-- ⚠️⚠️ CE SCRIPT REMPLACE `public.admin_queue_counts()` EN ENTIER, liste
-- des files comprise. C'est la seule facon d'en ajouter une a une
-- fonction `create or replace`, mais cela veut dire que **rejouer
-- `202610140001_admin_fast_reads.sql` apres celui-ci perd les deux
-- nouvelles files** (silencieusement : une cle absente est lue comme
-- zero). L'ordre alphabetique des fichiers protege un deploiement normal ;
-- une execution manuelle dans l'editeur SQL, non. Toute file ajoutee
-- demain doit l'etre ici, dans la derniere version de la fonction.
--
-- ⚠️ CETTE FONCTION N'EST PAS OBLIGATOIRE. `fetchAdminQueue()` retombe sur
-- ses comptages requete par requete quand elle est absente (`PGRST202`),
-- les deux nouvelles files comprises. Tant que ce script n'est pas
-- applique, la cloche les compte donc quand meme — simplement au prix de
-- deux allers-retours de plus par rendu de layout.
--
-- Idempotent.
-- =====================================================================

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
       'select count(*) from public.profiles where deletion_requested_at is not null'),
      -- ⚠️ `not exists` et non une jointure sur `payments` : une inscription
      -- peut porter plusieurs lignes de paiement (un echec, puis un
      -- remboursement, puis un nouvel essai), et une jointure la compterait
      -- autant de fois. Ce qui est demande, c'est « aucun paiement VIVANT »,
      -- donc l'absence, pas la presence. `rembourse` et `echoue` n'en sont
      -- pas : une inscription remboursee est de nouveau a encaisser.
      --
      -- Mesure sur un Postgres jetable (fixture : 7 inscriptions, 8 paiements,
      -- deux inscriptions a encaisser dont une portant trois paiements morts) :
      --   `not exists`     -> 2   (attendu)
      --   jointure naive   -> 4   (la meme inscription comptee une fois par
      --                            paiement mort)
      -- et si `rembourse`/`echoue` comptaient comme vivants, la file tombe a 0 :
      -- les deux inscriptions a encaisser disparaissent. Les deux choix de
      -- cette requete sont donc tenus par la mesure, pas par le raisonnement.
      ('collect',
       'select count(*) from public.scout_day_registrations r
          join public.scout_days d on d.id = r.scout_day_id
         where d.is_paid
           and r.status <> ''annule''
           and not exists (
             select 1 from public.payments p
              where p.scout_day_registration_id = r.id
                and p.status in (''reussi'', ''active_manuellement'', ''en_attente'')
           )'),
      ('paymentsPending',
       'select count(*) from public.payments where status = ''en_attente''')
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
-- Temps reel des deux nouvelles files.
--
-- ⚠️ SANS CE BLOC, LA CLOCHE N'APPREND L'INSCRIPTION QU'AU SONDAGE SUIVANT.
-- C'est la regle posee par `202609090001_realtime_admin_queue.sql` : une file
-- comptee sur une table absente de la publication `supabase_realtime` garde la
-- latence du sondage (dix secondes), et un abonnement `postgres_changes` sur
-- une table non publiee **reussit sans rien livrer** — il n'y a pas d'erreur a
-- observer. Or l'evenement qui compte ici vient de l'application mobile : un
-- joueur s'inscrit, aucune action serveur du back-office n'est jouee, donc
-- rien ne revalide l'ecran.
--
-- `replica identity full` pour la meme raison que la-bas : le signal est aussi
-- bien un INSERT (une inscription qui arrive) qu'un UPDATE (un paiement qui
-- passe a « reussi », une inscription annulee), et sans l'ancienne version de
-- la ligne un UPDATE peut etre ecarte a la reevaluation du RLS. L'arbitrage de
-- la migration mobile 0026 vaut : ces deux tables s'ecrivent a l'inscription
-- et a la decision d'un administrateur — quelques ecritures par jour, pas un
-- flux comme `public.messages` ou `public.posts`.
--
-- Si `alter publication` echoue en `insufficient_privilege` (la publication
-- appartient a `supabase_admin` sur certains projets) : Dashboard → Database →
-- Replication → `supabase_realtime`, cocher les deux tables.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array['scout_day_registrations', 'payments'];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
    raise notice 'Publication supabase_realtime creee.';
  end if;

  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice '% ajoutee a supabase_realtime.', t;
    else
      raise notice '% etait deja publiee.', t;
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- Controle : une publication refusee en `insufficient_privilege` passerait
-- sinon inapercue, et la file retomberait silencieusement sur le sondage.
do $$
declare
  manquantes text;
begin
  select string_agg(t, ', ')
    into manquantes
    from unnest(array['scout_day_registrations', 'payments']) as t
   where not exists (
     select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
   );

  if manquantes is not null then
    raise exception 'Tables absentes de supabase_realtime : %', manquantes;
  end if;

  raise notice 'Les deux files de finances sont publiees en temps reel.';
end $$;

notify pgrst, 'reload schema';
