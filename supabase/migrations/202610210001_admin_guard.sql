-- =====================================================================
-- IFRIQIYA STAR — Back-office : toute l'autorisation d'une requete en
-- un seul aller-retour.
--
-- POURQUOI. Suite directe de `202610140001_admin_fast_reads.sql`, qui
-- avait regroupe les lectures du *layout*. Il restait le preambule de
-- chaque **page**, paye avant qu'une seule ligne de l'ecran ne soit
-- demandee :
--
--   1. `requireAdmin()`        -> lecture de `profiles` (role, actif)
--   2. `requirePermission()`   -> `admin_has_permission(code)`
--   3. `getAdminAccess()`      -> `admin_access(uuid)`
--
-- Trois allers-retours **successifs**, qui repondent tous a la meme
-- question : qui est ce compte et qu'a-t-il le droit de faire. Mesure du
-- 21 oct. 2026 depuis un poste de developpement vers le projet : 1,01 s
-- sur connexion froide, 0,09 a 0,51 s sur connexion chaude, par
-- aller-retour. Sur `/admin/moderation/publications` — qui enchaine les
-- trois — c'est environ une seconde de reseau avant la premiere requete
-- metier.
--
-- Cette fonction rend les trois reponses sur une ligne.
--
-- ⚠️ ELLE N'EST PAS OBLIGATOIRE. `lib/auth.ts` retombe sur ses trois
-- lectures d'origine si elle est absente (`PGRST202`) ou si son execution
-- est refusee (`42501`), comme le reste du back-office degrade a
-- l'ouverture quand une migration n'est pas appliquee. Ce script
-- accelere, il ne conditionne rien.
--
-- ⚠️ ELLE NE S'OUVRE PAS SUR `is_admin()`, et c'est delibere — contrairement
-- a `admin_access()` juste a cote. `requireAdmin()` doit distinguer trois
-- refus : compte introuvable, compte non administrateur, compte desactive.
-- Une garde `is_admin()` les confondrait en un seul `42501`, et
-- l'administrateur desactive repartirait vers `/connexion` sans savoir
-- pourquoi. La fonction ne lit donc **que la ligne du compte appelant**
-- (`auth.uid()`), ce que le RLS de `profiles` lui montre de toute facon, et
-- ne joint le referentiel RBAC que si ce compte est un administrateur
-- actif : un compte ordinaire n'apprend rien de la structure des roles.
--
-- `security definer` pour la meme raison que `admin_access()` : les
-- tables RBAC ne sont pas lisibles par le role `authenticated` depuis la
-- migration mobile 0059, et `profiles` a vu plusieurs de ses colonnes
-- revoquees (mobile 0025, 0050) — un privilege de colonne est verifie
-- *avant* le RLS et refuserait la session administrateur elle-meme.
--
-- Idempotent.
-- =====================================================================

create or replace function public.admin_guard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile record;
  v_role_id uuid;
  v_role_code text;
  v_role_label text;
  v_granted text[];
  v_known text[];
  v_assigned boolean := false;
begin
  -- Pas de session : l'appelant redirige vers la page de connexion sans
  -- autre diagnostic. `profile` absent dit exactement cela.
  if v_uid is null then
    return jsonb_build_object('profile', null::jsonb);
  end if;

  -- `role::text` : la colonne est une enumeration sur certains projets et
  -- du texte sur d'autres ; le cast rend la meme chaine dans les deux cas,
  -- et c'est la chaine que compare `requireAdmin()`.
  select p.id, p.role::text as role, p.email, p.full_name, p.is_active
    into v_profile
  from public.profiles p
  where p.id = v_uid;

  -- Session orpheline : jeton valide, ligne `profiles` supprimee a la main.
  if not found then
    return jsonb_build_object('profile', null::jsonb);
  end if;

  -- Compte non administrateur ou desactive : on rend les faits qui
  -- motivent le refus, et rien du referentiel RBAC.
  if v_profile.role is distinct from 'admin'
     or not coalesce(v_profile.is_active, false) then
    return jsonb_build_object('profile', to_jsonb(v_profile));
  end if;

  -- Le bloc RBAC est rattrapable en entier : un projet qui n'a pas applique
  -- `202608240001_admin_platform.sql` n'a aucune de ces tables. `known`
  -- reste alors vide, ce que l'appelant lit comme « RBAC pas deploye » et
  -- qui lui fait accorder tous les droits — la regle du depot, degrader a
  -- l'ouverture, et le comportement qu'il avait deja sans cette fonction.
  begin
    select array_agg(ap.code order by ap.code) into v_known
    from public.admin_permissions ap;

    select ur.role_id, r.code, r.label
      into v_role_id, v_role_code, v_role_label
    from public.admin_user_roles ur
    join public.admin_roles r on r.id = ur.role_id
    where ur.admin_id = v_uid;

    if v_role_id is not null then
      v_assigned := true;
      select array_agg(ap.code order by ap.code) into v_granted
      from public.admin_role_permissions rp
      join public.admin_permissions ap on ap.id = rp.permission_id
      where rp.role_id = v_role_id;
    end if;
  exception
    when undefined_table or undefined_column then
      v_known := null;
      v_granted := null;
      v_role_code := null;
      v_role_label := null;
      v_assigned := false;
  end;

  -- Memes cles que `admin_access()` : l'appelant lit les deux reponses avec
  -- la meme fonction (`accessFromRow`), donc elles ne peuvent pas diverger.
  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'assigned', v_assigned,
    'role_code', v_role_code,
    'role_label', v_role_label,
    'granted', coalesce(to_jsonb(v_granted), '[]'::jsonb),
    'known', coalesce(to_jsonb(v_known), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_guard() from public;
grant execute on function public.admin_guard() to authenticated;

notify pgrst, 'reload schema';
