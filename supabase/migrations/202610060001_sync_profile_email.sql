-- =====================================================================
-- profiles.email suit l'adresse de connexion (Supabase Auth)
-- =====================================================================
--
-- Pourquoi : la page « Mon profil » du back-office laisse un administrateur
-- changer son adresse via `supabase.auth.updateUser({ email })`. C'est
-- `auth.users.email` qui change — une fois le lien de confirmation suivi —,
-- et rien ne recopiait la nouvelle valeur dans `public.profiles.email`.
-- Le rail, l'en-tete et la liste des utilisateurs, qui lisent `profiles`,
-- auraient affiche l'ancienne adresse indefiniment. Et l'interessé ne peut pas
-- corriger lui-meme : la migration mobile 0025 n'accorde pas `update (email)`
-- sur `profiles`.
--
-- Le trigger vaut pour tout compte, pas seulement les administrateurs : un
-- joueur qui changerait d'adresse depuis l'app mobile aurait le meme decalage.
--
-- ⚠️ Le gestionnaire d'exception est la ligne qui compte. Ce trigger s'execute
-- DANS la transaction de GoTrue qui ecrit la nouvelle adresse : une erreur non
-- rattrapee annulerait le changement d'adresse lui-meme. Meme arbitrage que la
-- migration mobile 0063 (avis de changement de mot de passe) : une copie pour
-- l'affichage ne doit jamais couter le geste qu'elle reflete.
--
-- Idempotent : `create or replace`, `drop trigger if exists`.
-- =====================================================================

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    update public.profiles
       set email = new.email
     where id = new.id
       and email is distinct from new.email;
  exception when others then
    raise warning 'sync_profile_email(%): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- `security definer` : ecrit `profiles.email`, colonne qu'aucun role applicatif
-- ne peut mettre a jour. Personne d'autre n'a a l'appeler.
revoke all on function public.sync_profile_email() from public, anon, authenticated;

drop trigger if exists trg_sync_profile_email on auth.users;
-- `update of email` ET `when` : GoTrue ecrit dans `auth.users` a chaque
-- connexion et chaque rafraichissement de jeton ; seul un vrai changement
-- d'adresse doit declencher la copie.
create trigger trg_sync_profile_email
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.sync_profile_email();
