-- =====================================================================
-- IFRIQIYA STAR — Back-office : autoriser l'administration a creer un
-- Scout Day et une evaluation de scouting.
--
-- CONTEXTE. Le schema d'origine reserve la creation de ces deux objets au
-- professionnel concerne :
--
--   scout_days_insert_professional      with check (organizer_id = auth.uid()
--                                                   and public.is_professional())
--   evaluations_insert_evaluator        with check (evaluator_id = auth.uid()
--                                                   and public.is_professional())
--
-- Un compte administrateur n'etant pas `is_professional()`, toute creation
-- depuis le back-office etait refusee par le RLS (SQLSTATE 42501).
--
-- CE QUE CETTE MIGRATION CHANGE. Elle ajoute deux policies *supplementaires*
-- reservees aux administrateurs. Les policies d'origine sont conservees
-- telles quelles : un professionnel continue de creer ses propres evenements
-- et ses propres rapports, exactement comme avant.
--
-- CONSEQUENCE A ASSUMER. `scout_days.organizer_id` et
-- `scout_evaluations.evaluator_id` referencent `professional_profiles(id)` :
-- l'objet cree porte donc le nom d'un **professionnel**, que l'administrateur
-- doit designer dans le formulaire. Qui a reellement saisi la donnee reste
-- tracable dans `admin_audit_log`, qui enregistre l'administrateur et le
-- professionnel signataire.
--
-- IDEMPOTENT : ce script peut etre relance tel quel. C'est deliberé —
-- `00_ALL_IN_ONE.sql` ne l'est pas (140 `create policy` sans garde), et
-- l'editeur SQL de Supabase enveloppant le script dans une transaction
-- unique, la moindre collision annule tout.
-- =====================================================================

-- §8.1 — creation d'un Scout Day par l'administration
drop policy if exists "scout_days_insert_admin" on public.scout_days;
create policy "scout_days_insert_admin"
on public.scout_days for insert
to authenticated
with check (public.is_admin());

-- §8.4 — saisie d'un rapport de scouting par l'administration
drop policy if exists "evaluations_insert_admin" on public.scout_evaluations;
create policy "evaluations_insert_admin"
on public.scout_evaluations for insert
to authenticated
with check (public.is_admin());

-- Note : aucune policy DELETE n'est ajoutee sur scout_evaluations. Les
-- evaluations sont historisees (trigger trg_scout_evaluation_history) et
-- restent volontairement non supprimables ; pour retirer une evaluation de la
-- vue du joueur, utiliser visible_to_player = false.
