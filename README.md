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
| `SUPABASE_SERVICE_ROLE_KEY` | non | Uniquement pour la **suppression definitive** d'un compte |
| `PAYMENT_WEBHOOK_SECRET` | pour les paiements en ligne | Signature HMAC-SHA256 de `/api/webhooks/payment-provider` |

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

## Couverture du cahier des charges

| Section | Ecran | Ce qui est couvert |
|---|---|---|
| §12.1 | `/admin/validations` | Files d'attente : profils joueurs, comptes professionnels, justificatifs pro, pieces d'identite. Validation / refus motive. |
| §12.1 | `/admin/utilisateurs` + `/admin/utilisateurs/[id]` | Annuaire filtrable ; consultation et **modification** (fiche compte, profil sportif, fiche pro) ; suspension, reactivation, suppression ; suivi du statut de verification ; visibilite du profil joueur. |
| §12.2 | `/admin/moderation` | Signalements (traitement + action de moderation), publications, commentaires, medias joueurs (videos, photos). Masquage, suppression, suspension d'un utilisateur. |
| §12.3 | `/admin/scout-days` + `/admin/scout-days/[id]` | Liste de tous les evenements, publication / depublication / annulation / cloture / suppression, inscriptions et leurs statuts, paiements par inscription, rapports de scouting. |
| §12.4 | `/admin` | Utilisateurs par type de compte, profils actifs et valides, connexions (7 j / 30 j), abonnements actifs, revenus et paiements, nombre de Scout Days et d'inscriptions. |
| §12.3 / §12.4 | `/admin/finances` | Paiements (dont activation manuelle des encaissements hors ligne, §10.3), abonnements, catalogue d'offres, revenus par mois. |
| §13 | `/admin/journal` | Journal d'audit : chaque action passee par le back-office est consignee dans `admin_audit_log`. |
| Evaluations | `/admin/evaluations` | Creation, calcul serveur du score global, publication/masquage, suppression et historique SQL. |
| Notifications | `/admin/notifications` | Ciblage individuel, role, Scout Day ou plateforme ; canaux in-app, push et email ; suivi/retry. |
| Permissions | `/admin/acces` | RBAC : super admin, validateur, moderateur, evenements, finances et support. |

## Migration du back-office

Appliquer [`supabase/migrations/202608240001_admin_platform.sql`](supabase/migrations/202608240001_admin_platform.sql)
sur le projet Supabase partage. La migration est idempotente, attribue le role
`super_admin` aux administrateurs existants, ajoute les permissions fines, la
file de notifications et l'historique immuable des evaluations.

La page Notifications cree des campagnes. La livraison push/email elle-meme
doit etre effectuee par un worker Supabase/Edge Function relie aux fournisseurs
choisis ; les statuts et references fournisseur sont deja prevus dans
`admin_notification_deliveries`.

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
  ce que suggere `00_ALL_IN_ONE.sql` (verifie contre la base reelle). La seule
  photo disponible est `player_profiles.profile_photo_url`, donc les avatars
  n'apparaissent que pour les joueurs.
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
- **Le catalogue d'offres est en lecture seule.** Les limites qu'il decrit sont
  appliquees cote serveur (`can_message()`, RLS) ; les modifier releve d'une
  migration, pas du back-office.
