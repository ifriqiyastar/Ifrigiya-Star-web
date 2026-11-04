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

⚠️ **Depasse** : la case et le texte dissocie ont ete retires — voir
« [Le texte du courriel vit dans le modele](#le-texte-du-courriel-vit-dans-le-modele-nov-2026) »
en fin de fichier. Tout ce qui suit de `email_subject` / `email_body` vaut
pour l'historique, plus pour le code.

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


## Trois champs qui mentaient sur ce qu'ils etaient (Nov 2026)

Signale a l'usage, sur un envoi par courriel seul : « Email subject 0 / 120,
Message body 0 / 120, les deux sont obligatoires — et le sujet apparait dans
le modele ».

- ⚠️⚠️ **L'objet du courriel etait aussi son titre affiche.** Un seul champ
  alimentait `Subject:` **et** le `<h1>` pose sous l'entete
  (`emails/blocks.tsx`, `message.title`) : le destinataire relisait dans le
  message la ligne qu'il venait de lire dans sa boite de reception. Un objet
  se redige pour une liste de messages, un titre pour la page qu'on ouvre.
  `CampaignEmail` prend desormais `heading` a cote de `title`. La regle, posee
  dans `lib/actions/notifications.ts` : **le titre affiche n'existe que si le
  courriel reprend litteralement celui de la notification** — donc jamais en
  courriel seul, jamais en texte dissocie, ou le champ est libelle « Objet de
  l'e-mail ». `undefined` garde l'ancien comportement, ce qui laisse l'apercu
  de modele (`lib/email/preview.ts`, textes d'exemple) inchange.
  ⚠️ Les **quatre** chemins de rendu devaient suivre, sans quoi l'un d'eux
  montrerait un courriel que personne ne recevra : la diffusion, la relance,
  l'envoi de test — le seul garde-fou avant un envoi de masse — et l'apercu
  vivant du composeur, qui transporte `heading` jusqu'au Server Action.
- ⚠️ **Le corps n'est plus exige que pour la notification.** Il l'etait pour
  tous les canaux, si bien qu'un courriel bati sur un modele — dont les blocs
  portent deja le texte — ne pouvait pas partir sans qu'on remplisse en plus
  un champ dont rien n'allait s'afficher. Une notification, elle, ne peut pas
  etre vide : la cloche et l'ecran verrouille n'auraient rien a montrer.
  L'ecran le dit maintenant (« facultatif ») au lieu de le faire decouvrir par
  un refus apres coup.
- ⚠️⚠️ **Et le bouton, lui, exigeait toujours un corps.** Premiere correction
  incomplete : la regle serveur et le libelle disaient « facultatif », le
  bouton d'envoi restait grise, et c'est le bouton qui tranchait. `ready()`
  reprend desormais mot pour mot la regle du Server Action — titre, cible
  quand elle se choisit, corps **seulement si une notification part** — et
  l'envoi de test suit la meme condition, un test refuse la ou la diffusion
  passerait ne testant rien d'utile. Les champs du texte dissocie ne bloquent
  plus non plus : vides, `email_subject` / `email_body` valent `null`, ce qui
  veut dire « le courriel reprend le texte de la notification » et non « vide ».
  **C'est le meme piege que les gardes de permission** : un garde-fou plus
  severe que la regle qu'il represente ne protege de rien, il cache un geste
  legitime. Verifie en comparant les deux predicats sur les douze
  combinaisons mode x titre x corps — ils repondent pareil partout.
- ⚠️ **« 0 / 120 » annoncait une limite qui n'existe pas.** Le compteur du
  corps mesure `LOCK_SCREEN_BODY_CHARS` — ce que l'ecran verrouille d'un
  telephone laisse lire. Un courriel n'a pas d'ecran verrouille : le compteur
  et sa mention de repli disparaissent en mode courriel seul.
- `tests/campaign-email.test.cjs` garde la separation objet / titre, **verifie
  par mutation** : remettre `title` dans le bloc message fait tomber le test.
  Son troisieme cas est le temoin — sans lui, un gabarit qui n'afficherait
  plus **aucun** titre passerait les deux premiers sans rien prouver. Ce qu'il
  ne couvre pas : quel appelant passe quoi, la regle ci-dessus vivant dans le
  Server Action.

## Diffuser vers des adresses sans compte (Nov 2026)

Demande du client : un champ pour taper n'importe quelle adresse, « pas besoin
qu'elle soit liee a l'application », marketing compris. C'est une **sixieme
pastille** d'audience, `target_type = 'emails'`, et le texte saisi voyage dans
`target_value`.

Tout le reste du composeur part de `profiles` — la cloche, le push, la langue
du destinataire, son nom. Une adresse tapee n'a rien de cela. Les trois
accroches ont donc ete desserrees par `202611020001`, **sans etre supprimees** :
un destinataire reste rattache a son compte quand il en a un.

| Accroche | Avant | Maintenant |
|---|---|---|
| `admin_notification_campaigns.target_type` | 4 cibles | + `'emails'` |
| `admin_notification_deliveries.recipient_id` | `not null references profiles` | facultatif, `email` a cote, contrainte « l'un ou l'autre » |
| `admin_email_optouts.profile_id` | cle primaire | facultatif ; c'est **l'adresse** qui porte l'unicite |

- ⚠️⚠️ **Deux espaces de signature disjoints.** Le jeton d'un compte couvre
  `unsubscribe:<identifiant>`, celui d'une adresse `unsubscribe-email:<adresse>`.
  Avec un prefixe commun, un jeton emis pour l'un vaudrait pour l'autre.
  L'adresse est normalisee **avant** d'etre signee comme avant d'etre stockee,
  sinon le lien recu refuserait la ligne enregistree. Garde par
  `tests/campaign-email.test.cjs`, **verifie par mutation**.
- ⚠️ **Le desabonnement est re-verifie en TypeScript pour cette cible, et
  uniquement pour elle.** Les cibles de comptes le doivent a
  `admin_broadcast_recipients()`, qui reste la definition unique de « qui
  recoit » — la recopier ferait diverger deux definitions. Une liste tapee ne
  se deduit de rien, donc rien ne peut diverger ; mais sans ce filtre,
  recoller une adresse desabonnee la rabonnerait, et le lien serait un
  mensonge. La relance le re-verifie aussi : on a pu se desabonner entre-temps.
- ⚠️ **`unique` tient les NULL pour distincts.** La contrainte historique
  `(campaign_id, recipient_id, channel)` ne contraint plus rien des que
  `recipient_id` est nul : d'ou un second index `(campaign_id, email, channel)`
  **a cote**, et `recordDeliveries()` qui separe les lignes en deux upserts —
  PostgREST ne sait viser que des colonnes simples dans `on_conflict`.
- ⚠️ **La cible est refusee par Postgres** (`unknown_target` dans les deux RPC
  de diffusion) : rien ne peut partir par megarde par ce chemin. La relance
  court-circuite donc l'appel et relit les adresses depuis `target_value`, ou
  l'envoi a enregistre la liste **reellement visee** — pas le texte tape, qui
  portait doublons et fautes de frappe.
- ⚠️ **Le couple mode / cible se tient dans les deux sens.** Choisir la
  pastille basculait bien en « courriel seul », mais rien ne se passait dans
  l'autre sens : on repassait sur « une notification » en gardant la cible, et
  l'ecran proposait d'envoyer une notification a des adresses qui n'ont pas
  d'application — le Server Action l'aurait refuse apres coup, une fois tout
  le message compose. La pastille **n'apparait qu'en courriel seul**, et
  revenir a un mode qui porte l'in-app ramene la cible a « tous ». Elle n'est
  pas grisee : une cible sans aucun sens dans ce mode n'a pas a occuper la
  barre.
- **L'in-app est refuse deux fois** : le Server Action le dit en clair, et
  `notificationOn` porte `targetType !== "emails"` en plus du mode, pour qu'un
  etat revenu par un autre chemin ne puisse pas emettre `in_app`.
- **Rien de ce que la saisie ecarte n'est tu** — illisibles (nommees),
  doublons, desabonnes, surplus — et cela se lit **sous le champ avant
  d'envoyer**, pas seulement dans le compte rendu : une diffusion ne se
  rappelle pas. `parseAddressList()` vit dans `lib/email/address-list.ts`, un
  module **neutre qui n'importe rien**, pour que le nombre affiche et la liste
  envoyee sortent de la meme analyse.
- ⚠️ **Plafond de 200** (`MAX_TYPED_ADDRESSES`), dix fois plus bas que
  `MAX_EMAIL_RECIPIENTS`. Ce champ sert a joindre quelques dizaines de
  personnes qui attendent le message ; un plafond haut inviterait a coller une
  liste achetee, que le domaine paierait en reputation — **le meme domaine qui
  porte les notifications reelles du produit**.
- Ces destinataires recoivent le courriel **en francais, sans leur nom** : il
  n'y a pas de profil ou lire l'un ou l'autre, et les deviner serait une
  invention. L'ecran le dit sous le champ.

## Les champs n'avaient pas de bord (Nov 2026)

Signale a l'usage : « je ne veux pas que ca apparaisse au clic, je veux un
cadre sur le champ, tous ».

Les champs du composeur etaient des aplats `bg-background` sans contour, poses
sur des cartes elles-memes noires (`--card: #000000` dans
`.admin-dashboard-shell`) : rien ne disait ou commencait une zone de saisie ni
combien il en restait a remplir, et le seul indice arrivait **apres** le clic,
sous la forme d'un anneau de focus. Un repere qui nait de l'interaction
n'aide pas a decider ou cliquer.

- ⚠️ **`border-input` ne convient pas ici.** Dans le scope admin `--input`
  vaut `#000000` et sert de **fond** aux champs — la regle
  `[data-slot="input"] { background: var(--input) }` de `app/globals.css` —
  pas de trait. Une bordure `border-input` serait noire sur noir. Le trait
  visible est `--border` (`#242629`), celui qui detache deja les cartes.
- Chaque champ passe par `Field` (`notification-composer.tsx`) : un vrai
  `<fieldset>` dont le `<legend>` porte le libelle. C'est le navigateur qui
  interrompt la bordure sous la legende — rien n'est simule par un fond
  opaque — et le libelle reste rattache au champ pour un lecteur d'ecran.
- Le `aside` — compteur de caracteres, lien « Voir les modeles » — se pose sur
  la bordure a droite, donc il lui faut le fond **exact** de la surface qui
  porte le cadre, d'ou la prop `surface` : `card` partout, `background` dans
  le bloc du texte dissocie, qui est lui-meme sur `bg-background`. Sur le
  mauvais fond, le trait reapparait derriere le compteur.
- ⚠️⚠️ **Le cadre ne bouge pas au clic — et `:focus-visible` ne suffit pas a
  le garantir.** Premiere correction incomplete : le cadre restait colore par
  `has-[:focus-visible]`, « que la souris ne declenche pas ». Faux pour un
  champ texte — Chrome fait correspondre `:focus-visible` **aussi au clic**
  la ou une saisie clavier est attendue (verifie :
  `input.matches(':focus-visible')` vaut `true` apres un vrai
  `Input.dispatchMouseEvent`). Un clic repeignait donc le trait en vert, ce
  qui se lit comme un **second** cadre pose sur le premier. Le trait est
  desormais fige (`#242629` focus ou non, mesure en `getComputedStyle`) et
  c'est le **libelle** qui passe au vert (`group-focus-within:text-brand`) :
  une tabulation reste suivable sans qu'aucun trait ne se redessine.
- `RichTextEditor` et `AccountPicker` ont perdu leur propre bordure : ils ne
  servent qu'au composeur, et deux cadres concentriques se lisaient comme une
  erreur d'alignement. L'editeur entre avec `inset={false}`, ses marges
  internes etant deja dans `editorProps`.
- Les trois nouveaux libelles (« Scout Day concerne », « Adresses e-mail »,
  « Compte destinataire ») existaient jusque-la en `aria-label` seulement :
  ils sont desormais visibles, donc dans `messages/admin/{fr,en}.json`.

## « Ce n'est pas responsive » : la barre d'outils, et un titre rabote (Nov 2026)

Signale en pointant la ligne « Formatting only shows in the email… », donc le
champ **Message**. Mesure faite dans Chrome 131 contre le CSS compile du
projet, dans la coquille a rail de 16rem (recette dans
[`design-system.md`](design-system.md)) : **rien ne deborde a aucune largeur**,
`scrollWidth` reste egal a `clientWidth` de 320 a 1600 px. C'est une capture
d'ecran, pas une mesure de debordement, qui a montre les deux defauts.

- ⚠️ **La barre d'outils de l'editeur se defaisait en se repliant.** Quatorze
  commandes tiennent sur une ligne au-dela de ~27rem ; en dessous, `ml-auto`
  envoyait Annuler / Retablir a droite de la **premiere** rangee tandis que les
  pastilles de couleur passaient a la seconde — l'ordre lu ne suivait plus
  l'ordre des commandes, un trou s'ouvrait au milieu, et un separateur tombe en
  fin de rangee pendait sans rien separer. Les commandes sont desormais
  groupees (`Group`), un groupe ne se coupe plus, `ml-auto` et les separateurs
  n'existent qu'au-dela du seuil, et l'ecart entre groupes passe a `gap-x-2.5`
  en mode replie pour tenir lieu de separation.
- ⚠️⚠️ **Le seuil est une requete de conteneur, pas une media query.**
  `@container/editor` + `@min-[27rem]/editor:` : le meme editeur est plus
  etroit d'un cran dans le bloc du texte dissocie (`bg-background p-3`), et
  plus etroit a 1280 px qu'a 1024 px — la colonne tombe a 8/12 au moment ou
  `xl` s'allume. Une media query aurait repondu sur la largeur de la fenetre,
  c'est-a-dire a cote. Mesure : barre sur une rangee (37 px) des 640 px de
  fenetre, deux rangees (69 px) en dessous, a toutes les largeurs testees.
- ⚠️⚠️ **« Email » s'affichait « E… » a 1280 px**, et seulement en anglais.
  La carte de canal avait deja perdu son icone d'etat pour cette raison ; ce
  n'etait pas assez : « OFF IN THIS MODE » reclame ~170 px la ou la carte en
  offre 176. Le titre ne se rabote plus — la premiere ligne de la carte se
  replie (`flex-wrap`) et l'etat passe dessous, pousse a droite par `ml-auto`
  dans les deux cas. **La longueur d'une traduction fait partie de la mesure** :
  le francais « Hors mode » tenait, l'anglais non.

## Le texte du courriel vit dans le modele (Nov 2026)

Demande apres les deux corrections ci-dessus : « pour le corps du message on
devrait le mettre dans le modele ». C'etait juste, et pour une raison mesurable
dans le code d'envoi plutot que dans l'ecran.

⚠️⚠️ **Le courriel rendait deja une variante par langue de destinataire —
sauf son texte.** `variantOf()` (`lib/email/campaign.ts`) rend un courriel par
langue reellement presente dans l'audience : l'habillage (`copy[locale]`) et
les blocs du modele, qui portent leur texte en fr/en/ar, suivent
`profiles.locale`. L'objet et le corps, eux, etaient **une seule chaine**
tapee au composeur et posee sur les trois variantes. Un destinataire
anglophone recevait un habillage anglais autour d'un corps francais. Le champ
de saisie ne pouvait pas y faire quoi que ce soit : il n'a qu'une langue.

Ce qui a change :

- **Le corps du courriel n'existe plus au composeur.** Le champ « Corps de
  l'e-mail », la case « le courriel reprend le meme texte » et tout le bloc de
  texte dissocie sont retires de l'ecran. Ce qu'un courriel raconte se compose
  en blocs dans `/admin/notifications/modele`, ou chaque bloc porte son texte
  dans les trois langues.
- **`email_subject` / `email_body` / `email_body_html` ne sont plus lus**, ni
  dans `sendNotification()` ni dans `sendTestNotification()`. ⚠️ Les retirer
  de l'ecran seul n'aurait rien retire : **un Server Action est atteignable par
  un POST direct**, donc la branche serait restee une fonction accessible que
  l'interface ne propose plus. La colonne `email_subject` du journal est
  desormais ecrite a `null`.
- **L'objet vient du modele, langue par langue** : nouvelle colonne
  `admin_email_template.subject` (migration `202611040001`), un champ par
  langue en tete du formulaire d'habillage. `campaignSubject()` choisit
  l'objet du modele s'il en porte un, et retombe sinon sur le titre de la
  diffusion.
- ⚠️ **Le titre de la diffusion reste, et il le faut** : un modele peut
  n'imposer aucun objet, et sur un projet ou la migration n'est pas passee la
  colonne n'existe pas du tout. Dans ces deux cas l'objet est celui de la
  diffusion — c'est-a-dire exactement ce qui partait avant. Rien ne peut
  partir sans objet.
- ⚠️ **Le « [Test] » de l'envoi a soi-meme est devenu un prefixe**
  (`subjectPrefix`). Il coiffait `title` ; depuis que `title` n'est qu'un
  repli, un test serait parti sous un objet en tout point identique a celui
  d'une vraie diffusion. Il est pose sur l'objet **reellement** employe.
- ⚠️ **L'envoi test n'exige plus de corps** quand aucune notification ne part.
  La condition etait `!title || !body` : le bouton de test serait devenu
  inutilisable le jour ou le champ a disparu — un refus sur un champ qui
  n'existe plus, c'est-a-dire sans rien a corriger a l'ecran.
- **Ce que la diffusion porte encore** : la cible, les canaux, l'objet de
  repli, et le texte de la **notification** — que nul modele ne peut porter,
  la cloche et l'ecran verrouille n'en ayant pas. En mode « les deux », ce
  texte-la est aussi ce que le courriel pose dans le bloc `message` : y
  renoncer obligerait a creer un modele par annonce.
- **Ce que ca change pour qui :** editer un modele est reserve au super
  administrateur (`saveEmailBlocks`), composer une diffusion demande
  `notifications.manage`. Rediger le contenu d'un courriel devient donc un
  geste de super administrateur. C'est une decision produit, prise
  explicitement — elle a ete posee avant d'ecrire une ligne.
- Garde par `tests/campaign-email.test.cjs`, **verifie par mutation** :
  ignorer `copy[locale].subject` fait tomber le test, supprimer le repli
  aussi (mesure, les deux). Ses deux derniers cas sont les temoins. Ce qu'il
  ne couvre pas : que Resend recoive bien cet objet — personne n'appelle
  `sendCampaignEmails()` dans les tests, elle parle au reseau.

### Un canal eteint par le mode ne s'affiche plus (Nov 2026)

Signale sur les deux modes simples : « in a notification and in an email,
remove both of those ». L'etape « Canaux de diffusion » montrait les trois
cartes quel que soit le mode, et celles que le mode avait eteintes portaient
« Hors mode » — l'e-mail sur « une notification », l'in-app et le push sur
« un e-mail ».

- Elles n'apprenaient rien : **le mode est le premier choix de l'ecran**, deux
  sections plus haut, et c'est lui qui decide des canaux. Une carte grisee ne
  faisait que repeter ce choix, en occupant jusqu'aux deux tiers de l'etape.
- Premiere correction, **incomplete** : ne rendre une carte que si le mode la
  concerne. Restaient « In-app — Toujours » sur le mode notification et
  « Email — Toujours » sur le mode courriel — c'est-a-dire exactement la meme
  repetition, avec l'etat « Toujours » au lieu de « Hors mode ». Signale aussi
  sec : « while selecting a notification tab it is still there ».
- ⚠️ **Les cartes sont parties entierement**, et `ChannelCard` avec elles.
  L'etape ne porte plus que ce qui **n'est pas** decide par le mode : le push,
  qui se decoche, en une case a cocher avec sa portee en dessous, et le modele
  du courriel. Plus les deux avertissements, qui disent chacun quelque chose
  (« sans push, personne ne sera alerte sur son telephone » ; le canal e-mail
  indisponible).
- Le titre de l'etape suit le mode : « Canaux de diffusion » quand un canal se
  choisit encore, « Envoi par e-mail » en courriel seul, ou elle ne porte que
  le modele.
- ⚠️ **Les champs caches n'ont jamais dependu des cartes** : `channels` part
  de `notificationOn` / `pushOn` / `emailOn`, et le Server Action le lit
  inchange. Retirer l'affichage n'a donc rien retire a l'envoi — c'est ce qui
  rendait le retrait sur.
- Le libelle « OFF IN THIS MODE », qui reclamait ~170 px dans une carte qui
  en offre 176 (voir la section sur la barre d'outils), n'existe plus : la
  mesure qui l'avait motive n'a plus d'objet.

### Et la case du push avec elles (Nov 2026)

Demande dans la foulee : « remove this check box ». Retirer les cartes une a
une avait fini par vider l'etape — il n'y restait qu'une case « Push mobile »
et sa portee.

- **Le push n'est plus un choix.** C'etait deja la moitie de la verite : le
  schema ne sait pas envoyer un push sans ecrire la notification, c'est son
  ecriture qui le declenche. L'ecran laissait seulement **retirer** le push
  d'une notification qui partait quand meme. `pushOn` vaut desormais
  `notificationOn`, et `channels` porte toujours les deux ensemble.
- **L'etape 4 ne subsiste que pour le courriel** — le modele, qui se choisit
  vraiment — et ne s'affiche que lorsqu'un courriel part. ⚠️ Un titre d'etape
  au-dessus de rien serait pire que l'etape supprimee : les champs caches
  `channels` sont sortis de la `section`, pour que son rendu puisse dependre
  de ce qu'elle a a montrer sans jamais toucher a ce qui est envoye.
- **Le refus « courriel indisponible » est sorti de l'etape aussi** : un
  courriel qui ne peut pas partir n'est pas un reglage d'envoi, c'est un refus
  a lire avant d'essayer.
- ⚠️ **Une sonde serveur en moins a chaque ouverture.** `fetchChannelStates()`
  appelait `admin_broadcast_notification` uniquement pour savoir si le push
  se laissait decocher. Plus personne ne lit cette reponse : l'appel est
  retire, et le type rendu ne porte plus que `email`. Une migration manquante
  se signale la ou elle gene — a l'envoi, ou le Server Action nomme deja le
  fichier a appliquer.
- **Ce qui n'est pas perdu** : le nombre d'appareils joignables, qui tenait
  dans la carte du push, vit toujours dans « Portee reelle » en regard de
  l'ecran, avec sa barre et sa mise en garde (« la remise effective d'un push
  n'est pas mesuree »).
- Sept cles de dictionnaire sont sorties des deux fichiers avec les cartes.

## Une section par canal (Nov 2026)

Signale en regardant le mode « les deux » : « in both there is no place for
mail ». C'etait exact, et ce n'etait pas un oubli d'affichage.

⚠️⚠️ **Deux canaux partageaient deux champs, sans que rien ne le dise.**
L'etape « Message » portait un titre et un corps ; le titre etait celui de la
notification **et** l'objet du courriel **et** le titre affiche sous son
entete, le corps etait celui de la notification **et** le texte pose dans le
bloc `message` du modele. En mode « les deux », le courriel n'avait donc aucun
champ a lui : il empruntait tout.

L'ecran porte maintenant **une section par canal**, et chacune ne montre que
le sien :

| Section | Contenu | Quand |
|---|---|---|
| **La notification** | Titre (64) · Corps | un canal in-app part |
| **L'e-mail** | Objet · Modele | un courriel part |

- La numerotation suit : en mode simple il n'y a qu'une section (3), en mode
  « les deux » il y en a deux (3 et 4).
- **L'objet** : en courriel seul le champ **est** `title` — aucune
  notification ne part, le seul titre de la diffusion est cet objet. En mode
  « les deux » il s'ajoute, facultatif (`email_subject`), et vide il laisse le
  titre de la notification servir de repli. L'ordre complet :
  objet du modele (par langue) → `email_subject` → `title`.
- ⚠️⚠️ **Le courriel ne porte plus aucun texte de la diffusion** : `heading`
  et `body` partent a `null` / `""` sur **les trois** chemins — diffusion,
  envoi test, relance. Separer les sections sans separer ce qui part aurait
  seulement deplace l'ambiguite.
- ⚠️ **Consequence assumee sur la relance** : une campagne d'**avant**
  relancee repart sans le texte qu'elle posait en ligne (son objet, lui, est
  conserve). C'est le meme arbitrage que le modele, que la relance a toujours
  rejoue **tel qu'il est aujourd'hui** faute d'instantane ; une relance qui
  enverrait un courriel que le composeur ne sait plus produire serait plus
  difficile a expliquer.
- ⚠️⚠️ **L'editeur riche a disparu avec l'emprunt.** La mise en forme ne
  servait **qu'au courriel** — seul des trois canaux a savoir rendre du gras ;
  la cloche et l'ecran verrouille affichent du texte nu. Le courriel ne
  reprend plus ce texte, donc le gras n'arrivait plus chez personne : une
  barre d'outils qui ne change rien a l'arrivee promet une mise en page
  imaginaire. Le champ est une zone de saisie simple, `body_html` n'est plus
  ni envoye ni lu, et `components/admin/rich-text-editor.tsx` a ete supprime
  (Tiptap reste, le blog s'en sert).
- ⚠️ **Le bloc « message » des modeles n'est plus impose** : il n'a plus rien
  a accueillir, et l'ajouter de force poserait un bloc vide partout. Il reste
  **accepte** a la lecture — les modeles enregistres en portent un, et le
  supprimer a la normalisation reecrirait leur mise en page a leur insu — sa
  carte dit qu'il ne rend plus rien, et il se supprime maintenant comme les
  autres. Garde par `tests/campaign-email.test.cjs`, verifie par mutation.
