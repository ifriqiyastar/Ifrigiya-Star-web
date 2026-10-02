-- =====================================================================
-- IFRIQIYA STAR — Back-office : couleurs du modele d'e-mail, et message
-- mis en forme (§11).
--
-- 1. LES COULEURS. Cinq colonnes, pas un theme libre : l'en-tete, le fond du
--    bouton, le texte du bouton, le fond du message et la couleur du texte.
--    Chacune est un `#rrggbb` verifie par une contrainte — une valeur libre
--    finirait dans un attribut `style` de courriel, ou `red; position:fixed`
--    passerait aussi bien qu'une couleur.
--
--    ⚠️ Nulles par defaut, et elles le restent : une couleur absente retombe
--    sur la charte (`#000000`, `#aff70f`, `#CCCCCC`, `#FFFFFF`) definie dans
--    `emails/copy.ts`. Rien n'est seme ici, sinon la charte existerait en
--    deux exemplaires.
--
-- 2. LE MESSAGE MIS EN FORME. `admin_notification_campaigns.body` reste le
--    texte **brut** et c'est vital : c'est lui que `admin_broadcast_notification`
--    ecrit dans `public.notifications`, donc lui que la cloche affiche et que
--    le push pose sur un ecran verrouille. Un ecran verrouille ne sait pas
--    rendre `<strong>`.
--
--    `body_html` porte la version mise en forme, **et elle ne sert qu'au
--    courriel**. Les deux sont ecrites ensemble par le composeur : l'une est
--    derivee de l'autre, jamais saisie deux fois.
--
--    ⚠️ Ce HTML n'est pas rendu tel quel. Il est reanalyse cote serveur
--    contre le schema Tiptap, qui est une liste blanche par construction :
--    `<script>`, `<iframe>`, `onerror`, `style`, `class` et les liens
--    `javascript:` n'y survivent pas (mesure). Le courriel est ensuite
--    reconstruit a partir de l'arbre obtenu, jamais par concatenation.
--
-- Idempotent : relancable sans erreur.
-- =====================================================================

alter table public.admin_email_template
  add column if not exists color_header_bg   text,
  add column if not exists color_body_bg     text,
  add column if not exists color_text        text,
  add column if not exists color_button_bg   text,
  add column if not exists color_button_text text;

do $$
declare
  v_column text;
begin
  foreach v_column in array array[
    'color_header_bg', 'color_body_bg', 'color_text', 'color_button_bg', 'color_button_text'
  ] loop
    execute format(
      'alter table public.admin_email_template drop constraint if exists chk_email_%s', v_column);
    execute format(
      $f$alter table public.admin_email_template
           add constraint chk_email_%1$s
           check (%1$s is null or %1$s ~* '^#[0-9a-f]{6}$')$f$, v_column);
  end loop;
end
$$;

comment on column public.admin_email_template.color_header_bg is
  'Fond du bandeau d''entete, #rrggbb. Nul = couleur de la charte.';

-- Le message mis en forme, pour le courriel seulement.
alter table public.admin_notification_campaigns
  add column if not exists body_html text;

comment on column public.admin_notification_campaigns.body_html is
  'Message mis en forme, utilise par le seul canal email. `body` reste le texte brut : c''est lui qui part dans la notification in-app et dans le push, ou aucun balisage n''est rendu.';

notify pgrst, 'reload schema';
