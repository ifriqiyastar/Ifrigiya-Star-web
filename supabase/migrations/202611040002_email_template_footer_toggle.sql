-- Retirer entierement le pied de page d'un modele.
--
-- POURQUOI. Les quatre textes du pied — « pourquoi ce message », le lien de
-- desabonnement, sa precision, la mention finale — sont modifiables depuis
-- `202609300003`, mais pas supprimables : une chaine vide vaut « non
-- renseigne » et fait revenir le texte livre (`pick()` dans `emails/copy.ts`).
-- L'absence **est** le defaut, donc rien n'exprimait « pas de pied du tout ».
--
-- Meme mecanique que `show_cta` et `show_greeting`, posee a cote d'eux : un
-- booleen par langue, vrai par defaut, qui n'efface aucun texte. Decocher
-- cache le pied, recocher le retrouve tel quel.
--
-- ⚠️⚠️ CE QUE CE BOOLEEN EMPORTE AVEC LUI : le **lien de desabonnement
-- visible**. L'en-tete `List-Unsubscribe` continue de partir — il est pose
-- dans `lib/email/campaign.ts`, hors du gabarit, et Gmail comme Yahoo en font
-- une condition d'acceptation d'un envoi de masse — mais le lien dans le
-- corps, lui, disparait. Un courriel d'annonce adresse a une liste doit le
-- garder ; l'ecran le dit au moment ou l'on decoche. Le choix appartient a
-- l'administrateur, le refus silencieux ne lui appartenait pas.
--
-- Idempotent : la colonne est ajoutee si elle manque, et les droits de la
-- table couvrent deja toute colonne nouvelle (`grant select, insert, update
-- … to authenticated` dans `202609300003`), donc rien a reprendre de ce cote.

alter table public.admin_email_template
  add column if not exists show_footer boolean not null default true;

comment on column public.admin_email_template.show_footer is
  'false retire le pied de page du courriel rendu (mention, desabonnement visible, droits), sans effacer les textes. L''en-tete List-Unsubscribe part quand meme.';
