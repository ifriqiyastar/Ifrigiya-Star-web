# Notifications — `/admin/notifications`

> Reference for [`../../CLAUDE.md`](../../CLAUDE.md). **Read when:** touching
> the composer, the audience segments, the in-app / push / email channels, or
> the campaign journal. The e-mail rendering and template system is in
> [`email-campaigns.md`](email-campaigns.md).

## Notifications : le composeur d'abord, et les canaux disent la verite (Sept 2026)

Passe de conception sur `/admin/notifications`. Ce qui a change, et pourquoi :

- **L'ecran ouvre sur le composeur.** Un bandeau de trois mesures dans l'entete
  plus quatre `StatCard` — sept chiffres, dont deux doublons a fenetres
  differentes ("Envois reussis (30 j)" au-dessus de "Envois reussis") —
  repoussaient sous la ligne de flottaison le seul geste pour lequel on ouvre
  la page. L'ordre est desormais entete → composeur → mesures → journal, les
  mesures coiffant la liste qu'elles resument.
- ⚠️ **« Destinataires servis — sur les campagnes affichees » a disparu.** La
  tuile changeait de valeur en tournant la page et en posant un filtre : un
  indicateur ne peut pas dependre de la pagination. Les quatre mesures portent
  la meme fenetre de 30 jours, sauf « Echecs a relancer » — un reste de travail
  n'a pas de peremption — qui est la seule cliquable, vers `?statut=failed`.
  (`MetricStrip` a gagne un `href` pour ca.)
- ⚠️ **Les canaux ne se cochaient pas, et ils en avaient l'air.** In-app et push
  partent avec la notification — c'est l'ecriture de la notification qui
  declenche le push — donc rien ne les decoche ; les trois cartes portaient
  pourtant la meme case carree, inerte. Elles annoncent maintenant un **etat** :
  `always` (un fait), `option` (un choix), `off` (une absence, avec sa raison).
- **Le canal email est pret a etre branche, pas promis.**
  `EMAIL_CHANNEL_AVAILABLE` (`lib/queries/notifications.ts`) est le second
  interrupteur ; le premier est l'envoi lui-meme, dans
  `lib/actions/notifications.ts`. Tant qu'il vaut `false`, la carte est
  desactivee et nomme la cause — l'ecran distingue « aucun fournisseur
  configure » (absence de `RESEND_API_KEY`) de « diffusion pas encore
  branchee ». Le basculer sans ecrire l'envoi enregistrerait une campagne
  « email » que personne ne recoit, et le journal l'afficherait comme reussie.
  `admin_notification_deliveries.channel` accepte deja `'email'`.
- ⚠️ **« Cibler un compte precis » etait un lien en marge de la barre de
  segments**, si bien que le choisir eteignait toute la barre : aucun segment
  n'etait actif, et le controle annoncait une cible qu'il n'avait plus. C'est
  une cinquieme pastille. La barre est un `flex flex-wrap`, pas une grille :
  `repeat(n, minmax(0,1fr))` retrecit ses pistes **sous** leur contenu au lieu
  de deborder — cinq pastilles dans huit colonnes finissaient tronquees sans
  que `scrollWidth` bouge.
- **Un envoi de masse se confirme.** Une notification ne se rappelle pas ; le
  bouton ouvre une confirmation qui nomme l'audience, son volume et rappelle le
  message. Un envoi nominatif (`target_type = 'user'`) en est dispense, il n'a
  rien de surprenant. La relance depuis le journal passe par le meme garde-fou.
- **Le titre et le corps du meme message** etaient separes par le selecteur
  d'audience et par les canaux. Le formulaire se lit en trois temps numerotes :
  qui, quoi, par ou.
- ⚠️ **Le journal se filtrait par statut seul, dans un `<form>` bricole a la
  main** avec un bouton « OK ». C'est `FilterBar` — deja mesure ailleurs — avec
  une **recherche plein texte** sur le titre et le message, plus un filtre de
  cible, et les quatre statuts que la contrainte accepte (`queued` et
  `processing` n'etaient pas proposes). `/admin/notifications/export` rejoue les
  trois filtres, sans quoi le fichier differerait de l'ecran.
- ⚠️⚠️ **La recherche vit dans la requete, et son echappement est double.**
  `%` et `_` sont les jokers d'`ilike` ; `or=(...)` reserve la virgule et les
  parentheses, donc la valeur doit etre entre guillemets — **et PostgREST
  deshabille un niveau de `\` en sortant des guillemets**, ce qui mangerait le
  premier echappement. Mesure contre le projet reel plutot que deduite :
  `title.ilike."%\%%"` rend les 7 lignes de `blog_posts` (echappement perdu),
  `title.ilike."%\\%%"` en rend 0 (le `%` est bien litteral). `orLikeTerm()`
  fait les deux passes, dans cet ordre. **Il a quitte ce fichier** pour
  `lib/queries/search-term.ts` : le depot portait quatre echappements
  differents pour la meme question, dont deux qui effacaient les caracteres
  genants au lieu de les echapper. `tests/search-term.test.cjs` garde les deux
  passes et l'ordre.
- **Le journal dit qui a expedie.** Depuis le retrait du journal
  d'administration, `created_by` est la seule trace de l'auteur d'une
  diffusion ; elle se lit sous la date, chargee en une requete pour la page
  entiere. La colonne « Canaux » — identique sur toutes les lignes — a fondu
  sous le message pour lui laisser la place, et une campagne en echec porte
  `.row-flagged`, la seule ligne du journal qui attende encore un geste.
- **Mesure 375 → 1920 contre la feuille compilee**, dans une coque reproduisant
  le rail de 16rem. Deux defauts trouves et corriges : a 768 px les trois
  cartes de canal tombaient a 143 px et leur libelle etait **rabote a six
  pixels** — l'etat `shrink-0` prenait sa largeur sur le texte — d'ou
  `sm:grid-cols-2 xl:grid-cols-3`, l'etat pose au-dessus du descriptif et son
  icone supprimee ; et deux libelles de mesure debordaient de 2 a 4 px a
  1280 px. Apres correction : aucun texte rabote, `scrollWidth === clientWidth`
  a chacune des six largeurs.
- `components/admin/notification-target-fields.tsx` a ete supprime : un second
  selecteur d'audience pour le meme ecran, plus reference depuis nulle part.


## Le choix des canaux, et un chiffre qui etait faux depuis le debut (Sept 2026)

Demande du client : « le super administrateur devrait pouvoir choisir ».
`supabase/migrations/202609300002_push_channel_choice.sql` porte les deux
corrections ci-dessous ; sans elle l'ecran reste tel qu'avant, et le dit.

⚠️⚠️ **« X comptes joignables par push » affichait toujours zero, partout.**
Ce n'etait pas une mesure. `push_tokens` n'a qu'une policy
`push_tokens_manage_own` (`profile_id = auth.uid()`), et la migration mobile
0023 ecrit noir sur blanc pourquoi il n'y a **pas** de policy
d'administration : « personne d'autre ne doit pouvoir lire les jetons, ils
permettent d'envoyer une notification a un utilisateur ». La session du
back-office etait donc filtree comme les autres et lisait `[]` — l'ecran en
concluait par ecrit que personne ne recevrait de push. La correction n'est pas
d'ouvrir la table : `admin_push_reach()` ne rend qu'un **entier**, aucun jeton
ne sort de la base, et `fetchPushReach()` rend `null` — affiche « — », jamais
« 0 » — quand la fonction n'est pas la.

⚠️⚠️ **L'in-app ne se decoche pas, et ce n'est pas un oubli.** La ligne
inseree dans `public.notifications` **est** l'element de la cloche *et* le
declencheur du push (trigger de 0023) : les deux sont un seul geste. « Push
sans in-app » demanderait un second chemin d'envoi appelant Expo avec les
jetons — que le back-office ne peut pas lire, par la decision ci-dessus. La
carte In-app l'ecrit plutot que de presenter une case bloquee.

**Le push, lui, se decoche.** Le trigger apprend a s'abstenir quand la
notification porte `data->>'push' = 'false'`, et la RPC gagne un cinquieme
argument `p_push` qui pose ce drapeau. Trois choses a savoir :

- **Aucun autre appelant ne pose cette cle**, donc le comportement de toutes
  les autres notifications est inchange — verifie sur un Postgres jetable :
  une notification ordinaire declenche toujours son push.
- **La signature a quatre arguments de 0046 devient un relais** vers celle a
  cinq, pour qu'il n'y ait pas deux corps a maintenir. Si le depot mobile
  rejoue 0046 un jour, il lui rend son corps complet : le back-office appelle
  la version a cinq, qui n'est pas touchee, donc rien ne casse.
- ⚠️ **Le repli sur l'ancienne signature est refuse quand le push a ete
  decoche.** Retomber dessus silencieusement enverrait sur les telephones une
  alerte que l'expediteur venait explicitement de refuser. L'action echoue et
  nomme la migration manquante. Avec le push demande, le repli est fidele et
  se fait sans bruit.

**La selectabilite est gatee sur `isSuperAdmin()`**, comme `events.validate` et
`content.validate` : un envoi ordinaire part sur les canaux par defaut. Chaque
canal nomme separement ce qui lui manque — migration, cle d'envoi, ou role —
parce que ce sont trois gestes differents pour l'exploitant. Un push decoche
affiche un avertissement : sans lui, personne n'est alerte sur son telephone.

Verifie sur un Postgres jetable, 0046 applique d'abord puis cette migration
deux fois : portee = 2 (un compte a deux jetons compte une fois, un compte
inactif ne compte pas), diffusion avec push = 2 notifications + 2 push,
diffusion sans push = 2 notifications + **0** push, relais a quatre arguments =
push actif, notification hors campagne = push actif.

## Le courriel se separe de la notification (Sept 2026)

Signale par le client : « je ne peux pas envoyer sans remplir les infos de la
notification, je veux le mail separe ». C'etait exact, et bloquant.

⚠️⚠️ **`sendNotification()` appelait `admin_broadcast_notification()` dans
tous les cas.** Un courriel ne pouvait donc pas partir sans deposer aussi une
notification dans la cloche de chacun et un push sur son telephone — pour une
lettre d'information, deux interruptions de trop. Sans canal `in_app`, la RPC
n'est plus appelee du tout : **rien n'est ecrit dans `notifications`**.

Precision qui compte : **le push reste indissociable de l'in-app**, c'est
l'ecriture de la notification qui le declenche. Ce qui est devenu facultatif,
c'est le **couple** in-app/push, exactement comme l'email l'etait deja.

**Le composeur ouvre sur le mode**, avant tout le reste : une notification /
un e-mail / les deux. Le mode decide des champs *et* des canaux — il n'y a
plus de cases de canal a cocher, elles en decoulent. En mode courriel,
l'intitule devient « Objet de l'e-mail » et la limite passe de 64 a 120
caracteres : un objet de boite de reception n'a pas la contrainte d'un titre
d'ecran verrouille.

**En mode « les deux », le courriel peut porter son propre texte** (case
« meme texte », cochee par defaut — le cas courant est une meme annonce par
deux voies, et proposer d'emblee deux redactions ferait payer a tout le monde
le prix d'un besoin occasionnel).

⚠️ **Ce que porte chaque colonne, apres `202609300007` :**

| colonne | contenu |
|---|---|
| `title` / `body` | le texte **principal**. Notification ou « les deux » : celui de la notification. Courriel seul : celui du courriel |
| `email_subject` | l'objet du courriel **quand il differe** de `title`. **Nul = meme texte**, et non « pas de courriel » — cela, seul `channels` le dit |
| `body_html` | le corps mis en forme du courriel |

⚠️ **« Destinataires servis » aurait affiche 0** sur toute campagne par
courriel seul : la colonne comptait les notifications ecrites. Elle rend
desormais compte du canal qui a reellement tourne (`served = count > 0 ? count
: email.sent`).

⚠️ **La relance rejoue l'objet distinct**, pas le titre de la notification :
un second envoi doit dire ce que le premier disait.

⚠️ **L'envoi test suit le mode.** Il deposait toujours une notification de
test dans sa propre cloche — sur un courriel seul, cela donnait a verifier un
canal qui ne partira pas. Et il montre le texte **propre au courriel** quand
il existe, sinon il validerait un message que personne ne recevra.

Le bouton d'envoi reste bloque tant qu'un courriel redige a part n'a pas son
objet **et** son corps : sans cela il partirait vide.

