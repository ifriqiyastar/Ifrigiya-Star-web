-- =====================================================================
-- IFRIQIYA STAR — Back-office : le modele « Invitation beta testeurs ».
--
-- CE QUE CE FICHIER AJOUTE. Un modele de courriel pret a l'emploi dans le
-- catalogue (`/admin/notifications/modele`), choisissable a la diffusion. Ce
-- n'est pas du schema : c'est du **contenu**, pose une fois, et modifiable a
-- l'ecran ensuite comme n'importe quel autre modele.
--
-- ⚠️⚠️ **AUCUN NOM DE DESTINATAIRE, NULLE PART, ET C'EST VOULU.**
-- Le gabarit sait ecrire « Bonjour <nom>, » quand il connait le nom. Ici les
-- deux formules d'accueil — celle « avec nom » et celle « sans » — portent
-- **le meme texte**, qui n'a pas de jeton de substitution. Il n'y a donc
-- aucun chemin par lequel un nom pourrait apparaitre, pas meme le jour ou ce
-- modele servirait a ecrire a des comptes. C'est la demande, et c'est aussi
-- ce qui convient : un testeur recrute par ailleurs ne s'attend pas a ce
-- qu'on connaisse son nom.
--
-- ⚠️ **L'adresse de reponse est laissee vide, volontairement.** Le corps
-- invite a repondre ; `ifriqiya-soccer.com` n'a **aucun enregistrement MX**,
-- donc une reponse n'arriverait nulle part. Renseignez `reply_to` sur l'ecran
-- du modele avec une boite reellement relevee **avant** le premier envoi,
-- ou remplacez la phrase de retour. La laisser vide ici plutot que d'y mettre
-- une adresse qui n'existe pas : un faux contact se decouvre trop tard.
--
-- ⚠️ **Le bouton pointe vers une URL a remplacer.** Le lien d'adhesion au
-- test est donne par la Play Console et change a chaque piste de test ; il
-- est pose ici en clair pour etre repere, pas pour etre envoye tel quel.
--
-- Idempotent : relancable sans erreur (identifiant fixe, `on conflict`).
-- =====================================================================

do $$
declare
  -- Identifiant fixe : c'est ce qui rend le script rejouable sans creer un
  -- second modele a chaque passage.
  v_id constant uuid := '6b3f2a10-9c44-4f8e-b1d7-2a5e0c7d4411';
begin
  -- ⚠️ **`blocks` vit sur le CATALOGUE, pas sur la ligne par langue.** La
  -- mise en page est la meme dans les trois langues — ce sont les *textes*
  -- des blocs qui sont traduits, chacun portant son `{ "fr": ..., "en": ... }`.
  -- La poser par langue laisserait trois mises en page diverger en silence.
  insert into public.admin_email_templates (id, name, description, is_default, blocks)
  values (
    v_id,
    'Invitation beta testeurs',
    'Invitation a rejoindre le test ferme de l''application. Le modele se suffit : l''invitation, ce qu''est l''application et les trois etapes y sont deja. Objet suggere : « Vous etes invite a tester Ifriqiya Soccer Star ». Le corps du message peut rester vide — il ne sert qu''a ajouter une note libre. Sans nom de destinataire. Remplacer l''URL du bouton par le lien d''adhesion de la Play Console.',
    -- ⚠️ Surtout pas par defaut : ce modele parle d'un test ferme, il n'a
    -- rien a faire sur une annonce ordinaire envoyee par erreur.
    false,
    $blocks$[
      {
            "id": "accueil",
            "type": "greeting",
            "named": {
                  "fr": "Bonjour,"
            },
            "plain": {
                  "fr": "Bonjour,"
            }
      },
      {
            "id": "invitation",
            "type": "text",
            "text": {
                  "fr": "Vous etes invite a essayer Ifriqiya Soccer Star avant son ouverture au public.\nL'application met en relation les joueurs et les recruteurs : un joueur y construit son profil sportif et se rend visible, un recruteur y cherche des profils et organise ses sessions de detection.\nVous faites partie du premier groupe a l'ouvrir. Rien n'y est encore fige, et c'est bien pour cela que votre avis compte."
            }
      },
      {
            "id": "message",
            "type": "message"
      },
      {
            "id": "trait-1",
            "type": "divider"
      },
      {
            "id": "etapes",
            "type": "text",
            "text": {
                  "fr": "Pour rejoindre le test, trois gestes, une seule fois :\n1. Ouvrez le lien ci-dessous depuis le telephone Android sur lequel vous testerez.\n2. Acceptez de rejoindre le test, puis installez l'application depuis le Play Store.\n3. Creez votre compte et servez-vous en comme vous le feriez vraiment."
            }
      },
      {
            "id": "bouton",
            "type": "button",
            "label": {
                  "fr": "Rejoindre le test"
            },
            "href": "https://play.google.com/apps/testing/REMPLACER-PAR-VOTRE-PACKAGE"
      },
      {
            "id": "compte-google",
            "type": "text",
            "text": {
                  "fr": "Le lien ne fonctionne qu'avec le compte Google de l'adresse qui a recu ce message, et l'application peut mettre quelques minutes a devenir installable."
            }
      },
      {
            "id": "trait-2",
            "type": "divider"
      },
      {
            "id": "attendu",
            "type": "columns",
            "left": {
                  "fr": "C'est une version de test : attendez-vous a des lenteurs, des textes provisoires, parfois un ecran qui se ferme. Rien de cela n'est definitif."
            },
            "right": {
                  "fr": "Ce qui nous aide le plus : savoir ou vous avez hesite, ce que vous vous attendiez a trouver, et ce qui vous a semble lent. Une capture d'ecran vaut dix lignes."
            }
      },
      {
            "id": "retour",
            "type": "text",
            "text": {
                  "fr": "Pour nous ecrire, repondez simplement a ce message. Merci du temps que vous y passerez : c'est lui qui decide de ce que verront les joueurs."
            }
      },
      {
            "id": "signature",
            "type": "signature",
            "text": {
                  "fr": "L'equipe Ifriqiya Soccer Star"
            }
      }
]$blocks$::jsonb
  )
  on conflict (id) do update
    set name        = excluded.name,
        description = excluded.description,
        blocks      = excluded.blocks;

  insert into public.admin_email_template (
    template_id, locale,
    sender_name, reply_to,
    greeting_named, greeting_plain,
    show_cta, cta_label, cta_url,
    signature, footer_why, unsubscribe_label, unsubscribe_hint, rights,
    color_header_bg, color_body_bg, color_text, color_button_bg, color_button_text
  )
  values (
    v_id, 'fr',
    'Ifriqiya Soccer Star',
    -- Voir l'avertissement en tete : a renseigner avant le premier envoi.
    null,
    -- Les deux accueils sont identiques et sans jeton : aucun nom possible.
    'Bonjour,',
    'Bonjour,',
    -- Le bouton vit dans les blocs, ou il est place ; celui de l'habillage
    -- ferait doublon juste en dessous.
    false, null, null,
    'L''equipe Ifriqiya Soccer Star',
    'Vous recevez ce message parce que votre adresse a ete inscrite a la phase de test de l''application.',
    'Ne plus recevoir ces messages',
    'Vous ne recevrez plus d''invitation ni d''annonce de notre part.',
    'Ifriqiya Soccer Star — Tous droits reserves',
    -- Les quatre couleurs de la charte, et elles seules.
    '#000000', '#FFFFFF', '#000000', '#aff70f', '#000000'
  )
  on conflict (template_id, locale) do update
    set sender_name       = excluded.sender_name,
        greeting_named    = excluded.greeting_named,
        greeting_plain    = excluded.greeting_plain,
        show_cta          = excluded.show_cta,
        signature         = excluded.signature,
        footer_why        = excluded.footer_why,
        unsubscribe_label = excluded.unsubscribe_label,
        unsubscribe_hint  = excluded.unsubscribe_hint,
        rights            = excluded.rights,
        color_header_bg   = excluded.color_header_bg,
        color_body_bg     = excluded.color_body_bg,
        color_text        = excluded.color_text,
        color_button_bg   = excluded.color_button_bg,
        color_button_text = excluded.color_button_text;
        -- ⚠️ `reply_to` n'est **pas** rejoue : une relance du script ne doit
        -- pas effacer l'adresse de reponse saisie a l'ecran depuis.
end $$;

notify pgrst, 'reload schema';
