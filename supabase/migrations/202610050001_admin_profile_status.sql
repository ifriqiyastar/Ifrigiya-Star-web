-- =====================================================================
-- IFRIQIYA STAR — Back-office : valider un dossier redevient possible (§12.1)
--
-- SYMPTOME RAPPORTE, sur « Valider le compte », « Refuser », la validation
-- groupee et la levee de suspension :
--
--     permission denied for table player_profiles            (42501)
--
-- ⚠️⚠️ CE N'EST PAS UNE POLICY RLS QUI MANQUE, C'EST UN GRANT.
-- La migration mobile **0050** a revoque `update` sur `player_profiles` et
-- `professional_profiles` au role `authenticated`, puis re-accorde colonne
-- par colonne — en laissant volontairement dehors :
--
--     status, status_reason, status_updated_by, status_updated_at,
--     ranking_score
--
-- La faille qu'elle ferme est reelle : sans elle, un joueur executait
-- `update player_profiles set status = 'valide' where id = auth.uid()` et se
-- validait lui-meme, rendant decorative la revue manuelle du §6.1.
--
-- Mais un privilege de colonne ne regarde que le **role Postgres**, et la
-- session d'un administrateur du back-office est une session `authenticated`
-- comme une autre : elle est refusee elle aussi. 0050 en concluait que « ces
-- colonnes sont reservees au back-office (`service_role`) » — or ce
-- back-office n'utilise pas la cle de service pour ces gestes, et ne doit pas
-- le faire : `service_role` rend `auth.uid()` nul, donc `status_updated_by`
-- ne serait plus renseigne et la decision deviendrait intracable. C'est
-- exactement l'objection que 0042 opposait a la moderation par cle de
-- service. C'est aussi, mot pour mot, la panne que 0079 a eu a reparer apres
-- 0073 : un privilege retire au vu du seul depot mobile, alors que **deux**
-- applications consomment cette base.
--
-- LE REMEDE EST CELUI DE 0042 ET DE 0044, ET C'EST LE SEUL QUI MARCHE : une
-- fonction `security definer` qui verifie `is_admin()` elle-meme. Le revoke
-- de 0050 n'est pas touche — un utilisateur ordinaire reste incapable de se
-- valider, puisqu'il n'est pas administrateur.
--
-- ⚠️ POURQUOI UNE SEULE FONCTION POUR LES DEUX TABLES ET POUR LE LOT.
-- Le back-office ecrivait ce statut a quatre endroits (joueur, professionnel,
-- validation groupee, levee de suspension). Quatre RPC, c'est quatre corps ou
-- la regle « on vide le motif quand on valide » peut diverger. La fonction
-- prend un **tableau** d'identifiants, resout la table par `profiles.role`, et
-- rend **les identifiants reellement modifies** : PostgREST ne signale pas une
-- mise a jour qui ne touche aucune ligne, et l'ecran annoncerait « profil
-- valide » sans que rien n'ait change (le piege deja paye sur
-- `professional_documents` puis sur `scout_days`).
--
-- ⚠️ `suspendu` est refuse ici, volontairement. Suspendre, c'est aussi couper
-- `profiles.is_active`, ce que seule `admin_set_account_active()` (0044) fait.
-- Poser le statut seul laisserait un compte « suspendu mais actif », l'etat
-- hybride que l'interface decrit deja comme une anomalie.
--
-- Idempotent : relancable sans erreur.
-- =====================================================================

create or replace function public.admin_set_profile_status(
  p_profile_ids  uuid[],
  p_status       text,
  p_reason       text default null,
  p_only_pending boolean default false
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joueur public.player_profile_status;
  v_pro    public.professional_verification_status;
  v_motif  text;
  v_ids    uuid[];
begin
  if not public.is_admin() then
    raise exception 'La validation des dossiers est reservee a l''administration.'
      using errcode = '42501', hint = 'admin_only';
  end if;

  if p_profile_ids is null or cardinality(p_profile_ids) = 0 then
    return '{}'::uuid[];
  end if;

  -- Les deux enums ont les memes membres mais sont deux types distincts, d'ou
  -- deux variables. On caste ICI plutot que dans l'UPDATE : un litteral non
  -- caste passe (il est `unknown`), une expression non castee donne `text`, et
  -- il n'existe aucune conversion implicite de text vers un enum — c'est le
  -- 42804 que 0017 a eu a corriger.
  begin
    v_joueur := p_status::public.player_profile_status;
    v_pro    := p_status::public.professional_verification_status;
  exception when invalid_text_representation then
    raise exception 'Statut de profil inconnu : %', p_status
      using errcode = '22023', hint = 'unknown_profile_status';
  end;

  if v_joueur = 'suspendu' then
    raise exception
      'Une suspension passe par admin_set_account_active(), qui coupe aussi l''acces au compte.'
      using errcode = '42501', hint = 'use_admin_set_account_active';
  end if;

  v_motif := nullif(btrim(coalesce(p_reason, '')), '');

  -- `p_only_pending` sert la validation groupee : elle ne doit toucher que ce
  -- qui attend encore, sinon elle ecraserait une decision prise entre
  -- l'affichage de la liste et le clic.
  with cible as (
    select id, role from public.profiles where id = any(p_profile_ids)
  ),
  joueur as (
    update public.player_profiles pp
       set status            = v_joueur,
           status_reason     = v_motif,
           status_updated_by = auth.uid(),
           status_updated_at = now()
     where pp.id in (select id from cible where role = 'player')
       and (p_only_pending is not true or pp.status = 'en_attente_validation')
    returning pp.id
  ),
  pro as (
    update public.professional_profiles pr
       set status            = v_pro,
           status_reason     = v_motif,
           status_updated_by = auth.uid(),
           status_updated_at = now()
     where pr.id in (select id from cible where role = 'professional')
       and (p_only_pending is not true or pr.status = 'en_attente_validation')
    returning pr.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids
    from (select id from joueur union all select id from pro) t;

  return v_ids;
end;
$$;

comment on function public.admin_set_profile_status(uuid[], text, text, boolean) is
  'Pose le statut metier d''un ou plusieurs comptes (§12.1) et rend les identifiants reellement modifies. security definer : 0050 a revoque update(status, status_reason, status_updated_by, status_updated_at) a authenticated, session administrateur comprise. Refuse « suspendu » : voir admin_set_account_active().';

-- ⚠️ `revoke ... from public` et pas seulement `from anon` : 0013 a accorde
-- EXECUTE a PUBLIC par defaut, et `anon` en est membre — lui retirer le droit
-- nominativement ne lui enleve rien tant qu'il le tient par PUBLIC (0060).
revoke all on function public.admin_set_profile_status(uuid[], text, text, boolean) from public;
revoke all on function public.admin_set_profile_status(uuid[], text, text, boolean) from anon;
grant execute on function public.admin_set_profile_status(uuid[], text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Autocontrole : il mesure le DROIT REEL, pas le fait d'avoir lance un grant.
-- Un `grant` peut partir sans effet (role absent, signature differente) et le
-- fichier se terminerait au vert.
-- ---------------------------------------------------------------------
do $$
declare
  v_fn regprocedure := 'public.admin_set_profile_status(uuid[], text, text, boolean)'::regprocedure;
begin
  if not has_function_privilege('authenticated', v_fn, 'execute') then
    raise exception 'La session administrateur ne peut toujours pas valider un dossier.';
  end if;

  -- Le temoin. Sans lui, un autocontrole qui ne mesure rien passerait au vert
  -- exactement comme un succes : personne de non connecte n'administre.
  if has_function_privilege('anon', v_fn, 'execute') then
    raise exception 'admin_set_profile_status est appelable sans etre connecte.';
  end if;

  raise notice 'VERIFIE — admin_set_profile_status : authenticated oui, anon non.';
end $$;

notify pgrst, 'reload schema';
