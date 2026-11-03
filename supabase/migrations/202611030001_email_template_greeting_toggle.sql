-- Retirer entierement la formule d'accueil d'un modele.
--
-- POURQUOI. Vider les deux champs ne le permettait pas, et ce n'etait pas un
-- oubli : une chaine vide vaut « non renseigne » et fait revenir le texte
-- livre (`pick()` dans `emails/copy.ts`). L'absence **est** le defaut, donc
-- rien n'exprimait « pas d'accueil du tout ». Un modele adresse a des gens
-- qui n'ont pas de compte — le test ferme, une annonce a une liste — n'a
-- pourtant rien a dire avant son premier paragraphe, et « Bonjour, » tout
-- seul en tete sonne comme un champ qu'on a oublie de remplir.
--
-- Meme mecanique que `show_cta`, posee a cote de lui : un booleen par langue,
-- vrai par defaut, qui n'efface aucun texte. Decocher cache l'accueil,
-- recocher le retrouve tel qu'il etait — ce qu'une suppression de contenu ne
-- permettrait pas.
--
-- Idempotent : la colonne est ajoutee si elle manque, et les droits de la
-- table couvrent deja toute colonne nouvelle (`grant select, insert, update
-- … to authenticated` dans `202609300003`), donc rien a reprendre de ce cote.

alter table public.admin_email_template
  add column if not exists show_greeting boolean not null default true;

comment on column public.admin_email_template.show_greeting is
  'false retire la formule d''accueil du courriel rendu, sans effacer les deux textes. Lecture par langue, comme show_cta.';
