-- =====================================================================
-- IFRIQIYA STAR — Back-office 202609090001
-- Temps reel des files d'attente de l'administration.
--
-- Symptome : la cloche et les pastilles du back-office n'apprennent qu'un
-- dossier est arrive qu'a la relecture suivante — dix secondes dans le
-- meilleur des cas, puisque rien ne les previent. Un signalement depose
-- depuis l'application mobile n'ecrit rien ici : pas d'action serveur, donc
-- pas de `revalidatePath`.
--
-- Cause : aucune des tables comptees par `fetchAdminQueue()` n'appartient a
-- la publication `supabase_realtime`. Seule la messagerie y avait ete
-- ajoutee (migrations mobiles 0019 / 0024 / 0026). Un abonnement
-- `postgres_changes` sur une table non publiee **reussit** et ne livre rien :
-- il n'y a pas d'erreur a observer, c'est ce qui rend le defaut couteux.
--
-- Ce que cette migration change : la seule appartenance a la publication.
-- Aucune table mobile n'est redefinie, aucune policy n'est touchee — le RLS
-- reste le filtre, et Realtime le reevalue pour chaque abonne avant de lui
-- transmettre un evenement. Un administrateur recoit donc ces lignes parce
-- que `public.is_admin()` l'y autorise deja, ni plus ni moins. Cote client,
-- la charge utile est ignoree : l'evenement ne sert qu'a declencher un
-- recomptage, jamais a afficher une ligne.
--
-- C'est exactement le mecanisme de la messagerie, et c'est la sa preuve : la
-- migration mobile 0019 abonne le client a `postgres_changes` sur
-- `public.messages` **et** publie la table dans sa section 4. L'abonnement
-- seul n'a jamais suffi — 0024 puis 0026 ont ete ecrites parce que le bloc de
-- publication avait echoue sans bruit.
--
-- Sans editeur SQL, le meme resultat s'obtient a la main, comme le note 0019 :
-- Dashboard → Database → Replication → `supabase_realtime`, cocher les sept
-- tables listees ci-dessous. La section 2 (identite de replica) n'a alors pas
-- d'equivalent dans l'interface ; c'est le seul morceau qui exige du SQL, et
-- son absence se voit sur les UPDATE, pas sur les INSERT.
--
-- Si `alter publication` echoue en `insufficient_privilege` — la publication
-- appartient a `supabase_admin` sur certains projets — passer par le dashboard
-- comme ci-dessus.
--
-- Idempotent : relancable sans erreur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Publication des tables comptees par la file d'attente
-- ---------------------------------------------------------------------
do $$
declare
  -- Exactement les tables lues par `fetchAdminQueue()`
  -- (lib/queries/admin-queue.ts). Ajouter une file la-bas sans l'ajouter ici
  -- redonne a cette file la latence du sondage.
  t text;
  tables text[] := array[
    'player_profiles',
    'professional_profiles',
    'professional_documents',
    'identity_verifications',
    'reports',
    'scout_days',
    'profiles'
  ];
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
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Identite de replica complete
--
-- Le signal de ces files est presque toujours un UPDATE : un dossier qui
-- passe a « en_attente_validation », un signalement qui passe a « a_valider ».
-- Avec l'identite par defaut (la cle primaire), l'ancienne version de la ligne
-- n'est pas repliquee, et selon la version de Realtime cela suffit a faire
-- ecarter l'evenement au moment de reevaluer le RLS. `full` supprime le doute.
--
-- Le raisonnement de la migration mobile 0026 s'applique : le cout est le
-- volume d'ecriture dans le WAL, donc il se juge table par table. Les sept
-- tables ci-dessous sont ecrites a la creation d'un dossier et a chaque
-- decision d'un administrateur — quelques ecritures par jour, pas un flux.
-- Ce choix ne se transpose PAS a `public.messages`.
-- ---------------------------------------------------------------------
alter table public.player_profiles replica identity full;
alter table public.professional_profiles replica identity full;
alter table public.professional_documents replica identity full;
alter table public.identity_verifications replica identity full;
alter table public.reports replica identity full;
alter table public.scout_days replica identity full;
alter table public.profiles replica identity full;

-- ---------------------------------------------------------------------
-- 3. Controle
--
-- Sans ce bloc, une publication refusee en `insufficient_privilege` passerait
-- inapercue et le back-office retomberait silencieusement sur son sondage.
-- ---------------------------------------------------------------------
do $$
declare
  manquantes text;
begin
  select string_agg(t, ', ')
    into manquantes
    from unnest(array[
      'player_profiles','professional_profiles','professional_documents',
      'identity_verifications','reports','scout_days','profiles'
    ]) as t
   where not exists (
     select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
   );

  if manquantes is not null then
    raise exception 'Tables absentes de supabase_realtime : %', manquantes;
  end if;

  raise notice 'Les sept files sont publiees en temps reel.';
end $$;
