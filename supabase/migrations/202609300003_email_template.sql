-- =====================================================================
-- IFRIQIYA STAR — Back-office : l'habillage des courriels, modifiable.
--
-- CE QUE CETTE TABLE STOCKE, ET CE QU'ELLE NE STOCKE PAS.
--
-- Elle stocke les **phrases** qui entourent le message d'une campagne :
-- l'accueil, le libelle et la cible du bouton, le pied, la mention de
-- desabonnement, une signature. Une ligne par langue du site.
--
-- ⚠️ Elle ne stocke **pas de HTML**, et c'est le point central. Un gabarit
-- libre serait injecte tel quel dans la boite de milliers de personnes : une
-- balise mal fermee casse la mise en page chez Outlook, un `<script>` ou un
-- `<img src=x onerror=…>` est une injection, et un tableau bricole a la main
-- ne survit pas aux clients de messagerie. Chaque valeur est du **texte**,
-- echappee au rendu, posee dans une structure qui reste dans le code — la
-- charte graphique (quatre couleurs, deux polices) est une contrainte du
-- client, pas un reglage.
--
-- ⚠️ Les colonnes sont **nullables et le restent** : une valeur absente
-- retombe sur la traduction livree dans `emails/copy.ts`. Une installation
-- sans cette table, ou avec une ligne partielle, envoie donc exactement ce
-- qu'elle envoyait avant. Il n'y a volontairement aucune valeur semee ici :
-- ce serait une seconde copie des textes par defaut, a maintenir en double.
--
-- Idempotent : relancable sans erreur.
-- =====================================================================

create table if not exists public.admin_email_template (
  locale             text primary key check (locale in ('fr', 'en', 'ar')),
  sender_name        text,
  reply_to           text,
  -- Deux accueils plutot qu'un modele a trou : « Bonjour {nom}, » sans nom
  -- donnerait « Bonjour , », et le rattrapage par expression reguliere se
  -- comporte differemment en arabe. Deux phrases explicites ne mentent pas.
  greeting_named     text,
  greeting_plain     text,
  show_cta           boolean not null default true,
  cta_label          text,
  cta_url            text,
  signature          text,
  footer_why         text,
  unsubscribe_label  text,
  unsubscribe_hint   text,
  rights             text,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles(id)
);

comment on table public.admin_email_template is
  'Habillage des courriels de campagne, une ligne par langue. Texte uniquement : aucune valeur n''est interpretee comme du HTML. Une colonne nulle retombe sur la traduction livree dans le code.';

-- Une adresse de reponse doit ressembler a une adresse : la contrainte est
-- volontairement laxiste (Postgres n'a pas a arbitrer la RFC 5322), elle
-- attrape la faute de frappe, pas le cas tordu.
alter table public.admin_email_template
  drop constraint if exists chk_email_template_reply_to;
alter table public.admin_email_template
  add constraint chk_email_template_reply_to
  check (reply_to is null or reply_to ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- ⚠️ Le bouton mene a une adresse que des milliers de gens vont cliquer :
-- `http`/`https` uniquement. Sans cette contrainte, un `javascript:` ou un
-- `data:` colle dans le formulaire partirait dans le courriel.
alter table public.admin_email_template
  drop constraint if exists chk_email_template_cta_url;
alter table public.admin_email_template
  add constraint chk_email_template_cta_url
  check (cta_url is null or cta_url ~* '^https?://[^[:space:]]+$');

alter table public.admin_email_template enable row level security;

-- Lecture : toute l'administration qui gere les notifications, puisque l'ecran
-- de diffusion en a besoin pour rendre l'apercu.
drop policy if exists admin_email_template_read on public.admin_email_template;
create policy admin_email_template_read on public.admin_email_template for select to authenticated
using (public.admin_has_permission('notifications.manage'));

-- ⚠️ Ecriture : super administrateur **et Postgres le verifie**. La garde de
-- l'interface est une courtoisie ; celle-ci est la regle. Meme forme que la
-- validation d'un Scout Day (mobile 0040) ou d'une publication (0089).
drop policy if exists admin_email_template_write on public.admin_email_template;
create policy admin_email_template_write on public.admin_email_template for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

grant select, insert, update on public.admin_email_template to authenticated;

-- L'auteur et la date sont poses par la base, jamais par le client : envoyes
-- depuis le formulaire, ils seraient declaratifs.
create or replace function public.stamp_email_template()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_stamp_email_template on public.admin_email_template;
create trigger trg_stamp_email_template before insert or update on public.admin_email_template
for each row execute function public.stamp_email_template();

notify pgrst, 'reload schema';
