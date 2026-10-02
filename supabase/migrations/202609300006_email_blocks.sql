-- =====================================================================
-- IFRIQIYA STAR — Back-office : le corps d'un modele d'e-mail se compose
-- par blocs (§11).
--
-- POURQUOI DES BLOCS, ET POURQUOI PAS UNE TOILE LIBRE. Le super
-- administrateur du client n'est pas technicien : il doit pouvoir ajouter une
-- image, deplacer un bouton, retirer un paragraphe — sans pouvoir produire un
-- courriel casse, parce qu'il n'a aucun moyen de s'en apercevoir. Il
-- n'ouvrira pas Outlook pour verifier, et ce sont les joueurs du client qui
-- recevraient le resultat.
--
-- Chaque bloc est donc un **type connu** rendu par un composant React Email :
-- l'agencement est libre, le rendu ne l'est pas. Une toile libre (GrapesJS,
-- Unlayer) donnerait l'inverse — la liberte de disposer, et la liberte de
-- casser.
--
-- ⚠️ La **structure** est portee par le modele, les **textes** par langue a
-- l'interieur de chaque bloc. On compose une fois, on traduit trois fois ;
-- l'inverse obligerait a refaire la mise en page dans chaque langue et
-- laisserait les trois diverger.
--
-- ⚠️ Un bloc `message` marque l'emplacement du texte de la campagne. Le
-- modele dit *ou* il se pose ; le composeur dit *ce qu'il contient*. Sans ce
-- bloc, un modele n'a pas d'endroit ou mettre le message — l'application le
-- rajoute a la fin plutot que de perdre le texte.
--
-- Idempotent : relancable sans erreur.
-- =====================================================================

alter table public.admin_email_templates
  add column if not exists blocks jsonb not null default '[]'::jsonb;

comment on column public.admin_email_templates.blocks is
  'Corps du modele : liste ordonnee de blocs typés (message, text, image, button, columns, divider, spacer). Les textes y sont ranges par langue. Revalidee cote serveur avant tout rendu — la colonne est une commodite de stockage, pas une garantie.';

-- ⚠️ Un garde-fou de volume, pas de forme : la validation du contenu se fait
-- en TypeScript (`normalizeBlocks`), qui rejette un type inconnu, borne les
-- longueurs et refuse une adresse qui n'est pas http/https/mailto. Postgres
-- ne sait ici que dire « c'est bien une liste, et elle n'est pas absurde ».
alter table public.admin_email_templates
  drop constraint if exists chk_email_blocks_shape;
alter table public.admin_email_templates
  add constraint chk_email_blocks_shape
  check (jsonb_typeof(blocks) = 'array' and jsonb_array_length(blocks) <= 40);

-- ---------------------------------------------------------------------
-- Les images des courriels
--
-- ⚠️ **Bucket public, et il doit l'etre.** Un client de messagerie charge une
-- image sans session et ne sait pas suivre une URL signee : les buckets
-- prives du back-office (migration mobile 0051) sont inutilisables ici. Ce
-- bucket ne contient donc que ce qui est destine a etre public — des visuels
-- d'annonce — et jamais une piece d'identite.
--
-- Distinct de `blog-media` a dessein : son ecriture est gardee par
-- `blog.manage`, qui n'est pas la permission de qui compose un courriel, et
-- melanger les deux rendrait le menage impossible.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('email-media', 'email-media', true)
on conflict (id) do update set public = true;

drop policy if exists email_media_read on storage.objects;
create policy email_media_read on storage.objects for select
using (bucket_id = 'email-media');

-- L'ecriture suit l'edition des modeles : super administrateur.
drop policy if exists email_media_write on storage.objects;
create policy email_media_write on storage.objects for insert to authenticated
with check (bucket_id = 'email-media' and public.is_super_admin());

drop policy if exists email_media_delete on storage.objects;
create policy email_media_delete on storage.objects for delete to authenticated
using (bucket_id = 'email-media' and public.is_super_admin());

notify pgrst, 'reload schema';
