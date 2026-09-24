# Ifriqiya Star — Back-office administrateur

Interface d'administration web (§12 du cahier des charges) pour la plateforme
Ifriqiya Star. Elle s'appuie sur **le meme projet Supabase que l'application
mobile** (`~/ifriqiyastar`) : memes utilisateurs `auth.users`, memes tables,
memes policies RLS. Ce depot n'a donc aucun schema propre — la source de verite
reste `00_ALL_IN_ONE.sql` cote mobile.

**Stack** : Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS v4 ·
shadcn/ui (style `base-sera`, sur Base UI) · `@supabase/ssr`.

## Demarrage

```bash
npm install
npm run dev        # http://localhost:3000 -> redirige vers /connexion
npm run build
npm run lint
```

### Variables d'environnement

Le `.env` de ce depot a ete copie de l'application Expo et porte encore des
noms `EXPO_PUBLIC_*`. Next.js n'expose au navigateur que `NEXT_PUBLIC_*`, d'ou
les deux jeux de variables :

| Variable | Requis | Role |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | oui | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | oui | Cle publique (le RLS fait le reste) |
| `SUPABASE_SERVICE_ROLE_KEY` | non (voir ci-dessous) | Suppression definitive d'un compte, webhook de paiement, envoi d'un code de reinitialisation de mot de passe depuis une fiche, et **repli** du masquage si la migration 0042 n'est pas appliquee |
| `PAYMENT_WEBHOOK_SECRET` | pour les paiements en ligne | Signature HMAC-SHA256 de `/api/webhooks/payment-provider` |
| `NEXT_PUBLIC_APP_STORE_URL` | non — a renseigner le jour de la publication | Fiche App Store ; des qu'elle existe, le badge Apple du site devient un vrai lien et le QR de l'entete redirige un iPhone qui le scanne directement vers elle (`lib/store-urls.ts`) |
| `NEXT_PUBLIC_PLAY_STORE_URL` | non — a renseigner le jour de la publication | Meme mecanique, cote Google Play / Android |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | oui tant que la protection anti-robot est active sur le projet Supabase | Cle **publique** du widget Cloudflare Turnstile, la meme que l'app mobile. Voir « Protection anti-robot » ci-dessous |
| `RESEND_API_KEY` | oui | Envoi de l'e-mail du formulaire `/contact` via Resend (`lib/actions/contact.ts`) |

**Formulaire de contact (`/contact`).** Envoi uniquement par le serveur, via
Resend — pas de repli `mailto:`. Le domaine d'expedition
(`ifriqiya-soccer.com`, distinct du nom du site `ifriqiya-soccer-star.com`)
doit rester verifie dans le tableau de bord Resend (SPF/DKIM) : sans
`RESEND_API_KEY`, ou si Resend refuse l'envoi (domaine desverifie, panne du
service), le formulaire affiche une erreur au visiteur au lieu de l'envoyer.
⚠️ **`ifriqiya-soccer.com` n'a pas d'enregistrement MX** : le domaine est
verifie pour l'envoi, mais personne ne peut recevoir de courrier a
`contact@ifriqiya-soccer.com` tant qu'une messagerie n'y est pas branchee
(Google Workspace, Zoho Mail, ou une redirection Cloudflare Email Routing vers
une boite existante). En attendant, `DELIVERY_ADDRESS` dans
`lib/actions/contact.ts` route les messages vers la boite Gmail deja utilisee
par l'app (`ifriqiya.star@gmail.com`) — a remplacer par l'adresse du domaine
des que sa reception sera configuree. **L'adresse affichee sur le site**
(pied de page, page `/contact`, messages d'erreur) est la meme
`ifriqiya.star@gmail.com`, pour ne jamais montrer une adresse que personne ne
lit — a remettre a jour avec `DELIVERY_ADDRESS` le jour ou les deux changent.

**Protection anti-robot (Cloudflare Turnstile).** Activee le 2026-09-17 a la
demande du client, c'est la fonctionnalite captcha de **Supabase Auth**
(Authentication -> Attack Protection) et non un controle de cette application.
⚠️ **C'est un reglage de projet** : il s'applique d'un coup a tous les points
d'entree d'authentification du projet partage, donc l'ecran `/connexion` doit
envoyer un jeton exactement comme l'app mobile — sans quoi Supabase repond
`captcha protection: request disallowed (no captcha_token found)`. Le jeton ne
prouve rien par lui-meme : c'est GoTrue qui l'echange contre la cle **secrete**,
laquelle ne vit que dans le tableau de bord Supabase.

⚠️ **Le nom d'hote doit etre declare sur la cle**, sinon le widget refuse de se
charger (code `110200`), et cela ne se corrige pas dans le code : ajouter
`localhost` et le domaine de production dans le tableau de bord Cloudflare
(Turnstile -> le widget -> Hostname Management). L'origine reellement declaree
est journalisee a cote du code dans la console, parce que c'est la seule
question utile face a un `110200`.

**Reinitialisation du mot de passe (§4.1).** Elle se fait **par code a six
chiffres**, jamais par lien : le gabarit d'e-mail est commun a l'app mobile et
a ce back-office (un seul projet Supabase), et l'app mobile n'a pas de site
vers lequel un lien reviendrait. Deux portes y menent :

- `/connexion/mot-de-passe-oublie`, ouvert a qui connait son adresse — adresse,
  puis code, puis nouveau mot de passe, sur un seul ecran. Le code est consomme
  a la verification, d'ou l'absence de retour arriere possible ; la session
  ouverte par le code est **fermee** apres l'ecriture, pour que l'entree dans le
  back-office reste `/connexion` et sa garde `requireAdmin()` ;
- le bouton « Reinitialiser le mot de passe » d'une fiche `/admin/utilisateurs/[id]`,
  reserve au **super administrateur** (`is_super_admin()`). Il declenche le meme
  e-mail vers l'adresse du compte : l'administrateur ne choisit aucun mot de
  passe et n'en apprend aucun. ⚠️ Cet envoi-la exige
  `SUPABASE_SERVICE_ROLE_KEY` — la protection anti-robot couvre `/recover`, un
  serveur n'a pas de defi a resoudre, et GoTrue n'en dispense que les appels
  porteurs d'identifiants d'administration.

⚠️ **Deux reglages du tableau de bord conditionnent tout cela**, et aucun ne se
detecte depuis le code : *Authentication -> Emails -> Reset Password* doit
contenir `{{ .Token }}` (le gabarit livre par defaut ne porte que le lien, et
l'e-mail arrive alors sans code), et *Authentication -> SMTP Settings* doit
porter un fournisseur a nous (le serveur integre de Supabase ne delivre qu'aux
membres du projet, ce que l'ecran nomme au lieu de l'afficher comme une panne).

**Masquage d'un contenu.** Les migrations 0033 et 0035 ont retire le droit
d'ecrire `is_hidden` aux sessions `authenticated` — session administrateur
comprise, un privilege de colonne ne regardant que le role Postgres — pour
qu'un auteur ne puisse pas annuler une decision de moderation sur son propre
contenu. Le back-office passe donc par la RPC `admin_set_content_hidden`
(**migration 0042**, depot mobile), `security definer`, qui verifie `is_admin()`
elle-meme : aucune cle supplementaire n'est necessaire, et l'autorisation reste
dans Postgres. Tant que 0042 n'est pas appliquee, le masquage retombe sur
`SUPABASE_SERVICE_ROLE_KEY` si elle est renseignee, et affiche sinon un message
nommant les deux remedes.

**Desactivation, reactivation et changement de role.** Meme histoire : la
migration 0025 a revoque `update (is_active, deactivated_at, role)` sur
`profiles` au role `authenticated` — pour qu'aucun utilisateur ne se promeuve
administrateur — et la session du back-office est une session `authenticated`
comme les autres. Ces gestes passent donc par les RPC de la **migration 0044**
(`admin_set_account_active`, `admin_set_account_role`,
`admin_request_account_deletion`). Sans elle, le back-office echoue en
`42501 permission denied for table profiles`.

Sans `SUPABASE_SERVICE_ROLE_KEY`, l'action « Supprimer » desactive le compte et
horodate `deletion_requested_at` au lieu de supprimer la ligne `auth.users` : la
cle publique ne peut pas appeler l'API Auth Admin, et supprimer seulement
`public.profiles` laisserait le JWT deja emis valide sur l'appareil.

### Creer le premier administrateur

Le back-office n'est accessible qu'aux comptes dont `profiles.role = 'admin'`
— c'est la colonne que lit `public.is_admin()`, dont dependent toutes les
policies RLS d'administration.

L'application mobile ne cree que des comptes `player` et `professional` : il
faut donc promouvoir un compte existant depuis le SQL Editor de Supabase.
Attention, un simple `UPDATE` echoue : le trigger
`trg_prevent_self_role_escalation` refuse tout changement de role quand
`is_admin()` est faux, et `auth.uid()` est nul dans l'editeur SQL. Il faut le
desactiver le temps de la requete :

```sql
alter table public.profiles disable trigger trg_prevent_self_role_escalation;

update public.profiles
set role = 'admin'
where email = 'REMPLACER@exemple.com';

alter table public.profiles enable trigger trg_prevent_self_role_escalation;
```

Une fois un premier admin en place, les changements de role suivants passent par
la fiche compte du back-office (le trigger est alors satisfait).

### Creer un compte editeur (blog uniquement)

Le role RBAC `editeur` ([`202609230004_admin_editor_role.sql`](supabase/migrations/202609230004_admin_editor_role.sql),
`dashboard.read` retire depuis [`202609230006_editeur_blog_only.sql`](supabase/migrations/202609230006_editeur_blog_only.sql))
ne porte que `blog.manage` : la personne ne voit que l'ecran Blog, rien
d'autre — ni tableau de bord, ni validations, ni moderation, ni Scout Days,
ni finances. A la connexion, elle est envoyee directement sur `/admin/blog`
(`firstAccessiblePath()`, `components/admin/nav-items.ts`) plutot que sur
`/admin`, qui lui est ferme.

Deux etapes, dans cet ordre :

1. **`profiles.role = 'admin'`** — obligatoire, c'est la garde de
   `requireAdmin()` (`lib/auth.ts`), verifiee avant meme de regarder le role
   RBAC. Si au moins un admin existe deja, faites-le depuis la fiche compte
   du back-office (`/admin/utilisateurs/[id]`) plutot que par SQL — le
   trigger `trg_prevent_self_role_escalation` n'a alors pas besoin d'etre
   desactive.
2. **L'attribution du role `editeur`** — comme tous les roles RBAC, il n'y a
   pas d'ecran pour ca (voir le commentaire de
   `202608240001_admin_platform.sql`) : ca passe par le SQL Editor de
   Supabase.

```sql
insert into public.admin_user_roles (admin_id, role_id)
select p.id, r.id
from public.profiles p, public.admin_roles r
where p.email = 'REMPLACER@exemple.com' and r.code = 'editeur'
on conflict (admin_id) do update set role_id = excluded.role_id;
```

`on conflict ... do update` fait aussi office de changement de role : relancer
cette requete avec un autre `r.code` (`support`, `moderator`...) reassigne un
compte qui avait deja un role RBAC.

## Couverture du cahier des charges

| Section | Ecran | Ce qui est couvert |
|---|---|---|
| — | `/` | **Site public** : page vitrine d'Ifriqiya Star (charte graphique Wii Studio — noir `#000000`, vert neon `#aff70f`, Nunito Sans / Poppins), captures reelles de l'application mobile. La racine ne redirige plus vers `/admin`. |
| — | Page 404 | **Page introuvable** aux couleurs du site public, dans la langue du visiteur (prefixe d'URL, puis cookie, puis `Accept-Language`). Servie par `app/global-not-found.tsx` — voir « Choix d'implementation notables ». Une adresse `/admin` erronee reste, elle, dans le chassis d'administration. |
| §4.1 | `/connexion/mot-de-passe-oublie` | **Mot de passe oublie** : envoi d'un code a six chiffres a l'adresse du compte, verification, puis nouveau mot de passe. Meme mecanisme que l'app mobile, meme gabarit d'e-mail. |
| §12.1 | `/admin/validations` | Files d'attente : profils joueurs, comptes professionnels, justificatifs pro, pieces d'identite. Validation / refus motive. |
| §12.1 | `/admin/utilisateurs` + `/admin/utilisateurs/[id]` | Annuaire filtrable (type, statut, actif, demande de suppression) ; consultation et **modification** (fiche compte, profil sportif, fiche pro) ; suspension, reactivation, suppression ; suivi du statut de verification ; visibilite du profil joueur. |
| §12.2 | `/admin/moderation` | Signalements : un moderateur propose un retrait motive, un **super administrateur** le valide ou le refuse. Publications, commentaires, medias joueurs (videos, photos), **comptes et messages**. Masquage, suppression, suspension d'un utilisateur. |
| §12.2 | `/admin/moderation/signalements/[id]` | Le dossier d'un signalement : la cible, le motif, les blocages deja recus par le compte, la provenance (fil d'actualite ou messagerie), la frise des decisions, et les gestes de decision a cote. **Le contenu des messages prives n'y est pas affiche** : l'instruction se fait sur le motif. |
| §12.3 | `/admin/scout-days` + `/admin/scout-days/[id]` | File d'attente de **validation** des evenements soumis par les professionnels (super admin), publication / depublication / annulation / cloture / suppression, inscriptions et leurs statuts, paiements par inscription, rapports de scouting. |
| §12.4 | `/admin` | Utilisateurs par type de compte, profils actifs et valides, connexions (7 j / 30 j), abonnements actifs, revenus et paiements, nombre de Scout Days et d'inscriptions. |
| §12.3 / §12.4 | `/admin/finances` | Paiements (dont activation manuelle des encaissements hors ligne, §10.3), abonnements, catalogue d'offres, revenus par mois. |
| Evaluations | `/admin/evaluations` | Creation, calcul serveur du score global, publication/masquage, suppression et historique SQL. |
| Notifications | `/admin/notifications` | Ciblage individuel, role, Scout Day ou plateforme ; notification in-app et push Expo ; historique et renvoi. |

## Migrations a appliquer

Dans cet ordre, sur le projet Supabase partage. Toutes sont idempotentes.

| Fichier | Depot | Role |
|---|---|---|
| [`202608240001_admin_platform.sql`](supabase/migrations/202608240001_admin_platform.sql) | back-office | Roles et permissions fines, file de notifications, historique immuable des evaluations. Attribue `super_admin` aux administrateurs existants. |
| [`202608240002_admin_authoring_policies.sql`](supabase/migrations/202608240002_admin_authoring_policies.sql) | back-office | Autorise l'administration a creer un Scout Day et une evaluation (le schema d'origine les reservait au professionnel concerne). |
| `0040_scout_day_admin_validation.sql` | **mobile** (`~/ifriqiyastar`) | Soumission a validation des Scout Days : `en_attente_validation`, `is_super_admin()`, trigger de transition, notification de l'organisateur. |
| [`202608240003_scout_day_validation_permission.sql`](supabase/migrations/202608240003_scout_day_validation_permission.sql) | back-office | Permission `events.validate`, attribuee au seul `super_admin`. A appliquer **apres** 0040. |
| `0041_report_removal_validation.sql` | **mobile** (`~/ifriqiyastar`) | Retrait d'un contenu signale : statut `a_valider`, machine a etats, garde-fous de suppression, notification du signaleur. Depend de 0040. |
| `0042_admin_hide_content.sql` | **mobile** (`~/ifriqiyastar`) | RPC `admin_set_content_hidden` : rend au back-office le droit de masquer, retire par 0033/0035, sans cle `service_role`. |
| [`202608240004_report_validation_permission.sql`](supabase/migrations/202608240004_report_validation_permission.sql) | back-office | Permission `moderation.validate`, attribuee au seul `super_admin`. A appliquer **apres** 0041. |
| [`202608240005_admin_notification_reads.sql`](supabase/migrations/202608240005_admin_notification_reads.sql) | back-office | **Plus utilisee.** Etat « lu » par administrateur, du temps ou la cloche listait les notifications des utilisateurs. La table reste en place, plus rien ne la lit. |
| [`202608240006_drop_admins_manage.sql`](supabase/migrations/202608240006_drop_admins_manage.sql) | back-office | Retire la permission `admins.manage` et la policy d'ecriture sur `admin_user_roles` : l'ecran d'attribution des roles ne figure pas au cahier des charges. L'attribution se fait desormais dans l'editeur SQL. |
| `0047_messaging_block_report.sql` | **mobile** (`~/ifriqiyastar`) | Blocage et signalement d'un utilisateur depuis la messagerie : `reports.context_conversation_id`, `report_conversation_user()`. Le back-office lit le signalement, jamais les messages du fil. |
| [`202609090001_realtime_admin_queue.sql`](supabase/migrations/202609090001_realtime_admin_queue.sql) | back-office | Publie en temps reel les sept tables comptees par la file d'attente, pour que la cloche et les pastilles reagissent a l'instant plutot qu'au sondage suivant. **Facultative** : sans elle le back-office fonctionne, avec une latence de dix secondes sur les compteurs. |
| [`202609210001_blog.sql`](supabase/migrations/202609210001_blog.sql) | back-office | Table `blog_posts`, entierement propre a ce depot (n'existe pas cote mobile) : articles rediges en Tiptap depuis `/admin/blog`, publies sur `/blog`. Bucket public `blog-media`, permission `blog.manage` accordee a tous les roles. |
| [`202609230001_blog_author_name.sql`](supabase/migrations/202609230001_blog_author_name.sql) | back-office | `blog_posts.author_name` : copie figee du nom d'auteur a la creation, pour l'afficher sans ouvrir `profiles` a une session anonyme. |
| [`202609230002_blog_scheduling_seo.sql`](supabase/migrations/202609230002_blog_scheduling_seo.sql) | back-office | `blog_posts.meta_title` / `meta_description` (repli sur `title`/`excerpt` quand vides) et `scheduled_at` avec le statut `programme` : publication reellement differee, sans tache planifiee — les deux pages du blog etant `force-dynamic`, la regle RLS suffit a rendre l'article visible a l'heure dite. |
| [`202609230003_blog_category.sql`](supabase/migrations/202609230003_blog_category.sql) | back-office | `blog_posts.category` : texte libre choisi par l'administration, pas une liste fermee. Alimente le filtre « Categories » de `/blog`. |
| [`202609230004_admin_editor_role.sql`](supabase/migrations/202609230004_admin_editor_role.sql) | back-office | Role RBAC `editeur` : `dashboard.read` + `blog.manage` uniquement. Voir « Creer un compte editeur ». |
| [`202609230005_admin_roles_grants.sql`](supabase/migrations/202609230005_admin_roles_grants.sql) | back-office | `grant select` manquant depuis 202608240001 sur `admin_roles`/`admin_user_roles` pour `authenticated` : sans lui, la colonne « role RBAC » de `/admin/utilisateurs` echoue en silence (`42501`) et retombe sur le libelle generique « Administrateur » — invisible pour `super_admin` (libelle quasi identique), flagrant pour `editeur`. |
| [`202609230006_editeur_blog_only.sql`](supabase/migrations/202609230006_editeur_blog_only.sql) | back-office | Retire `dashboard.read` du role `editeur` : ne garde que `blog.manage`. A appliquer avec le changement de code qui redirige un compte sans `dashboard.read` vers sa premiere section accessible au lieu de `/admin/acces-refuse` (`firstAccessiblePath()`). |

### Validation des retraits de contenu

Un utilisateur signale une publication depuis l'application mobile
(`report_content()`, migration 0033). Cote back-office, le retrait se decide
en deux temps depuis la migration 0041 :

1. un **moderateur** propose un retrait motive — masquage, suppression ou
   suspension du compte. Le contenu est masque dans la foulee quand la cible
   s'y prete (publication, commentaire, profil joueur) ;
2. un **super administrateur** confirme, et le retrait est applique, ou le
   refuse avec un motif, et le contenu revient en ligne.

Postgres a le dernier mot : supprimer une publication, un commentaire ou un
media joueur **appartenant a quelqu'un d'autre** est reserve a
`is_super_admin()`. Sans ces garde-fous, un moderateur contournerait la
validation en supprimant le contenu directement. L'auteur, lui, reste libre de
retirer ce qui lui appartient.

### Validation des Scout Days

Depuis la migration 0040, un professionnel ne publie plus son evenement
lui-meme : il le soumet, et **seul un super administrateur** peut le passer a
`publie`. Postgres a le dernier mot (`is_super_admin()` dans le trigger
`trg_enforce_scout_day_validation`) ; `events.validate` ne fait que cacher le
geste aux administrateurs qui ne l'obtiendraient pas. La file d'attente est en
tete de `/admin/scout-days`, avec le compteur dans la navigation. Un refus est
obligatoirement motive : le motif part en notification a l'organisateur et
s'affiche sur sa fiche.

**La page Notifications envoie reellement.** L'envoi passe par
`admin_broadcast_notification()` (**migration 0046**, depot mobile), qui insere
une ligne par destinataire dans `public.notifications` — ce qui declenche le
push Expo deja pose par la migration 0023 et remplit la boite in-app. Il n'y a
donc **pas** de worker a ecrire : la logique d'envoi existait, elle n'etait
simplement pas appelee.

**La cloche du bandeau montre la file de travail de l'administration**, pas les
notifications des utilisateurs. Elle listait les vingt dernieres lignes de
`public.notifications` — la boite de reception des membres, avec le nom du
destinataire : le RLS l'autorise, la regle du client non, comme pour les
conversations privees. Elle liste desormais ce qui attend une decision
(dossiers a valider, signalements, retraits, Scout Days, demandes de
suppression), filtre par les droits de l'administrateur connecte, chaque ligne
renvoyant a son ecran. Meme lecture que les pastilles de la navigation
(`lib/queries/admin-queue.ts`), donc les deux chiffres ne peuvent pas diverger.
Il n'y a plus d'etat « lu » : une tache disparait quand elle est traitee — la
table de la migration `202608240005` n'est donc plus lue.

**Le canal email a ete retire de l'interface** : aucun fournisseur n'est
configure, la case n'envoyait donc rien. Les colonnes `email_required` /
`email_sent_at` de `notifications` restent en place pour le jour ou un
fournisseur sera choisi.

Ce qui reste hors perimetre : la **remise** effective d'un push (les
« receipts » Expo, qui demandent une seconde requete differee).
`recipient_count` dit combien de personnes ont ete servies ;
`delivered_count` reste a zero tant que personne ne relit les receipts, et
`admin_notification_deliveries` attend toujours ce suivi fin.

## Securite

L'autorisation est verifiee a trois niveaux, volontairement redondants :

1. `proxy.ts` (l'ancien « middleware », renomme en Next 16) rafraichit le token
   Supabase. Il ne fait **pas** l'autorisation — la doc Next le deconseille.
2. `requireAdmin()` (`lib/auth.ts`) est appele par le layout `/admin` **et par
   chaque Server Action** : une Server Action est joignable par un POST direct,
   sans passer par l'interface.
3. Le RLS Postgres a le dernier mot. Meme si les deux premieres barrieres
   etaient contournees, `public.is_admin()` bloquerait la requete.

Les buckets prives (`identity-documents`, `professional-documents`,
`guardian-documents`) n'ont pas de lecture publique. La route
`/admin/documents?bucket=…&path=…` genere une URL signee (5 min) avec la session
administrateur, sur une liste blanche de buckets.

## Design

Les couleurs et la typographie sont reprises **a l'identique** de l'application
mobile (`src/constants/theme.ts` d'`~/ifriqiyastar`) : fond noir `#000000`,
surfaces `#212225`, bordures `#333333`, accent lime `#aff70f`, titres en Nunito
Sans, corps de texte en Poppins, cartes arrondies a 16 px et pastilles de statut
en petites majuscules interlettrees. Le theme clair equivalent
(`Colors.light`) est defini dans `app/globals.css` mais l'interface est rendue
en sombre, comme l'application.

Les couleurs de series des graphiques (`--viz-1`, `--viz-2`) sont **distinctes**
de l'accent de marque : l'accent est une couleur d'etat (bouton, onglet actif),
pas une identite de serie. Le couple retenu est valide sur la surface sombre
pour la bande de clarte, le plancher de chroma, la separation daltonisme et le
contraste ; legende et valeurs chiffrees restent affichees, la couleur ne porte
jamais seule l'information.

## Choix d'implementation notables

- **Pas de jointures imbriquees PostgREST vers `profiles`.** `player_profiles`
  et `professional_profiles` ont deux cles etrangeres vers `profiles` (`id` et
  `status_updated_by`), ce qui rend l'embed ambigu. Les identites sont donc
  chargees par `fetchProfilesByIds()`.
- **`profiles` n'a pas de colonne `avatar_url`** sur ce projet Supabase, malgre
  ce que suggere `00_ALL_IN_ONE.sql` (verifie contre la base reelle). La photo
  vient des tables metier : `player_profiles.profile_photo_url` pour un joueur,
  `professional_profiles.photo_url` pour un professionnel (migration mobile
  `0039`). `fetchProfilesByIds()` fusionne l'une ou l'autre sous le nom
  `avatar_url` ; seuls les comptes administrateurs restent sans vignette.
- **Validation du profil ≠ validation de la piece d'identite.**
  `player_profiles.status` (`player_profile_status`) et
  `identity_verifications.status` (`identity_verification_status`) sont deux
  enums distincts ; seul le premier est lu par le resolveur d'onboarding mobile.
  Les deux gestes sont donc proposes separement.
- **La moderation de contenu utilise `is_hidden` / `is_deleted`**, pas de DELETE :
  le schema n'ouvre pas de policy DELETE admin sur `posts` / `post_comments`, ce
  qui est voulu — un contenu retire reste consultable par l'administration pour
  instruire un signalement. Videos et photos joueurs, elles, sont bien
  supprimees (ligne + fichier de stockage).
- **L'etat des filtres vit dans l'URL**, pas dans le composant : les pages
  restent des Server Components, un filtre est partageable par lien et le retour
  navigateur fonctionne.
- **La 404 globale passe par `app/global-not-found.tsx`** et le drapeau
  `experimental.globalNotFound`. La mise en page racine de ce depot est un
  segment dynamique (`app/[locale]/layout.tsx`) : Next n'a donc aucune mise en
  page ou composer une 404 globale, et `not-found.tsx` seul rendait un document
  d'erreur nu — corps vide cote serveur, pas de `dir="rtl"` en arabe, pas de
  polices de marque. Ce fichier court-circuitant la mise en page, il importe
  lui-meme `globals.css` et `lib/fonts.ts`, et recoit la langue deja resolue par
  `proxy.ts` via l'en-tete `x-ifriqiya-locale`.
- **Le catalogue d'offres est en lecture seule.** Les limites qu'il decrit sont
  appliquees cote serveur (`can_message()`, RLS) ; les modifier releve d'une
  migration, pas du back-office.
# Ifrigiya-Star-web
