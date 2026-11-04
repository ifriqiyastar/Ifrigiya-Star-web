-- L'objet du courriel vit dans le modele, langue par langue.
--
-- POURQUOI. L'envoi rend deja **une variante par langue de destinataire**
-- (`variantOf()` dans `lib/email/campaign.ts`) : l'habillage et les blocs du
-- modele suivent `profiles.locale`. L'objet, lui, etait une seule chaine
-- tapee au composeur et posee telle quelle sur les trois variantes — un
-- destinataire anglophone recevait un habillage anglais sous un objet
-- francais. C'est la derniere piece du courriel qui ne parlait qu'une langue.
--
-- Le texte de l'annonce, lui, n'a besoin d'aucune colonne : il se compose
-- deja en blocs `text`, qui sont localises depuis `202609300006`.
--
-- Nullable a dessein, et sans defaut : l'absence vaut « ce modele n'impose
-- pas d'objet », et la diffusion retombe alors sur le titre qu'elle porte.
-- Une chaine vide dit la meme chose (`pick()` dans `emails/copy.ts`).
--
-- Idempotent : la colonne est ajoutee si elle manque, et les droits de la
-- table couvrent deja toute colonne nouvelle (`grant select, insert, update
-- … to authenticated` dans `202609300003`), donc rien a reprendre de ce cote.

alter table public.admin_email_template
  add column if not exists subject text;

comment on column public.admin_email_template.subject is
  'Objet du courriel pour cette langue. Nul ou vide : la diffusion impose le sien.';
