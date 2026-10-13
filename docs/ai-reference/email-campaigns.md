# E-mail campaigns, templates and the block composer

> Reference for [`../../CLAUDE.md`](../../CLAUDE.md). **Read when:** touching
> Resend sending, the unsubscribe route, `emails/*`, the template catalogue,
> the block builder, the rich-text body or the template colours.
> Who receives what, and on which channels, is in
> [`notifications.md`](notifications.md).

## Le canal email est branche (Sept 2026)

Resend etait deja dans le depot pour le formulaire `/contact` ; le canal email
des campagnes l'utilise maintenant pour de bon. Ce que ca implique :

| Fichier | Role |
|---|---|
| `supabase/migrations/202609300001_notification_email_channel.sql` | table des desabonnements + `admin_broadcast_recipients()` |
| `emails/campaign-email.tsx` · `emails/copy.ts` | le gabarit React Email et son habillage en fr/en/**ar** |
| `lib/email/campaign.ts` | rendu, signature du lien de desabonnement, envoi par lots |
| `app/api/email/desabonnement/route.ts` | le desabonnement, GET (clic) et POST (un clic, RFC 8058) |
| `lib/actions/notifications.ts` | `broadcastEmails()` et `recordDeliveries()` |

⚠️⚠️ **`default_subscription: "opt_in"` chez Resend veut dire « tout le monde
recoit sauf qui s'est desabonne »**, et `"opt_out"` veut dire « personne ne
recoit tant qu'il ne s'est pas abonne ». La denomination se lit a l'envers de
l'intuition, et se tromper **ne leve aucune erreur** : la campagne part chez
zero personne et le journal l'affiche comme reussie. Verifie dans la doc avant
d'ecrire la ligne, pas apres.

⚠️ **Les destinataires du courriel ne sont pas recalcules en TypeScript.**
`admin_broadcast_notification()` (mobile 0046) ne renvoie qu'un *compte*, pas
des adresses. `admin_broadcast_recipients()` rejoue la meme clause `where` —
dans le meme langage, a cote de son jumeau, la ou une divergence se lit — et y
ajoute les deux exclusions propres au courriel : adresse vide, desabonnement.
Recopier ce ciblage en TypeScript ferait exister deux definitions de « qui
recoit » ; le jour ou elles divergent, une partie des gens recoit le courriel
sans la notification.

⚠️ **Un message par destinataire, jamais un `to` collectif.** Mille adresses
dans un meme `to` les montrent toutes a chacun. `resend.batch.send()` prend
cent messages distincts par appel, en `batchValidation: "permissive"` — en
mode strict une seule adresse malformee fait echouer le lot, et
quatre-vingt-dix-neuf personnes ne recoivent rien a cause d'une faute de frappe
dans un profil. Mesure contre `delivered@resend.dev` : 3 envoyes, 1 en echec
nomme, les trois autres partis.

⚠️ **Le gabarit est rendu une fois par (langue × avec ou sans nom), pas une
fois par destinataire** — dix millisecondes × deux mille, c'est une demi-minute
de calcul dans un Server Action avant le premier envoi. Le nom et le lien de
desabonnement sont des marqueurs remplaces apres coup, **dans du HTML deja
rendu** : React n'y est plus, donc `fillTemplate()` echappe le nom lui-meme.
C'est le seul endroit du depot ou une injection HTML atteindrait des milliers
de boites mail.

⚠️ **Le lien de desabonnement est signe (HMAC), et la route est publique.**
Elle est appelee depuis une boite mail : il n'y a pas de session Supabase, donc
ce qui autorise l'ecriture est la signature, pas une policy. Sans elle,
`?c=<identifiant>` desabonnerait n'importe qui. Le POST n'est pas decoratif :
c'est le « un clic » de la RFC 8058, que Gmail et Yahoo declenchent depuis leur
propre interface sans ouvrir de page. L'ecriture passe par `service_role` —
seul cas possible, l'appelant n'a pas d'`auth.uid()`.

- **Un echec du courriel ne fait jamais echouer la diffusion.** L'in-app et le
  push sont deja partis ; marquer la campagne « en echec » inviterait a
  rappuyer sur « Reessayer » et **redoublerait** les notifications recues. La
  cle d'idempotence de la relance est derivee de l'identifiant de campagne,
  pour la meme raison.
- **Plafond de 2 000 destinataires par diffusion** (`MAX_EMAIL_RECIPIENTS`) :
  ce n'est pas une limite de Resend mais celle du temps de reponse HTTP.
  Au-dela, l'in-app part a tout le monde et l'ecran **dit** combien de
  courriels n'ont pas ete servis — pas de troncature muette.
- **`admin_notification_deliveries` est enfin remplie**, avec l'identifiant
  Resend dans `provider_reference` : c'est ce qui permettra a un webhook de
  poser un rebond ou une plainte sur la bonne ligne. ⚠️ L'identifiant n'est
  apparie a son destinataire **que si les deux listes ont la meme longueur** ;
  en mode permissif rien ne garantit que `data` porte un trou par echec, et
  attribuer l'identifiant d'un envoi au voisin rendrait une plainte pour spam
  intracable. Sinon la reference reste vide.
- ⚠️ **Le logo des courriels est `public/brand/ifriqiya-star-mark.png`, le
  signe **rogne**, pas l'icone d'application.** Gmail et Outlook ne rendent
  pas le SVG, d'ou un PNG ; mais `ifriqiya-star.svg` est dessine comme une
  icone de telephone — une plaque noire arrondie et, au centre, un signe qui
  n'occupe que **31 x 91 d'une boite de 160 x 160**. Pose sur le bandeau noir
  la plaque disparait, et il ne restait qu'un point lime flottant loin du
  nom : c'est ce qui a ete signale comme « le logo n'est pas clair ». Le
  fichier est ce meme signe rogne a sa boite englobante (125 x 364), affiche
  a `11 x 32` — ses proportions fixent ce couple, les changer l'etirerait.
  Quatre variantes ont ete rendues et comparees a l'oeil avant de trancher :
  icone plaquee a 44 px et a 64 px (le signe grossit, le vide autour aussi),
  signe rogne a 32 px, texte seul.
- Il porte `alt=""` et le nom de la marque est ecrit **a cote**, en blanc :
  la plupart des clients bloquent les images par defaut, donc l'entete doit
  se lire sans elle.
- ⚠️ **L'apercu charge ses images depuis l'origine de la requete**, pas
  depuis `SITE_URL` (`previewOrigin()` dans `lib/email/preview.ts`). Un
  fichier tout juste ajoute a `public/` n'est pas encore en production : le
  pointer la afficherait une image cassee dans l'ecran d'habillage alors
  qu'il est servi par le serveur qu'on interroge. C'est la seule difference
  entre l'apercu et l'envoi, et elle va dans le bon sens.
- ⚠️ `convert` **n'a pas `rsvg-convert` ici** et retombe sur le moteur SVG
  interne d'ImageMagick. Verifie par comparaison avant de s'en plaindre : le
  rendu etait fidele, le probleme etait la composition du fichier, pas la
  rasterisation.
- **Pas de propriete logique dans le gabarit** (`padding-inline-end` & co) :
  Outlook ne les rend pas, et l'ecart entre le logo et le nom disparaitrait.
  Le sens de lecture est choisi en TypeScript, pas par la cascade.
- `tests/campaign-email.test.cjs` — 6 assertions, **verifiees par mutation**.
  ⚠️ Sa premiere version testait l'injection en passant le nom directement au
  composant : React echappait a notre place, et retirer `escapeHtml()` laissait
  le test vert. Il exerce desormais le vrai chemin de substitution. Ce qu'il ne
  couvre pas : l'appel a Resend, qui n'est pas simule — un faux client ne
  dirait rien de l'envoi reel.

**Ce qui manque encore, et qui n'est pas invente** : le webhook Resend
(`email.delivered` / `email.bounced` / `email.complained`) qui ferait vivre
`delivered_count` autrement qu'au moment de l'envoi. La place est prete
(`provider_reference`), la verification de signature Svix ne l'est pas.


## Plusieurs modeles d'e-mail, choisis a la diffusion (Sept 2026)

Demande du client : le super administrateur doit pouvoir personnaliser
l'e-mail, **et** choisir lequel part a l'envoi. Deux migrations, deux ecrans.

| Fichier | Role |
|---|---|
| `…300003_email_template.sql` | les textes d'un habillage, une ligne par langue |
| `…300004_email_template_catalogue.sql` | le catalogue : un modele est un objet nomme |
| `lib/queries/email-template.ts` · `lib/actions/email-template.ts` | lecture fusionnee, ecriture gardee |
| `/admin/notifications/modele` | la **galerie** : une vignette par modele |
| `/admin/notifications/modele/[id]` | l'**editeur** : textes a gauche, courriel a droite |
| `components/admin/email-template-{form,thumb,dialogs}.tsx` | les trois pieces |

⚠️⚠️ **Du texte, jamais du HTML, et ce n'est pas une economie de moyens.** Les
tables ne stockent que des phrases ; il n'y a pas d'editeur libre et il ne
faut pas en ajouter un. Un gabarit HTML saisi a la main part tel quel chez des
milliers de personnes : une balise mal fermee casse la mise en page chez
Outlook, un `<img onerror=…>` est une injection, et un tableau bricole ne
survit pas aux clients de messagerie. La structure, les couleurs, les polices
et le logo restent dans le code — la charte graphique est une contrainte du
client, pas un reglage.

⚠️ **Deux accueils, pas un modele a trou.** « Bonjour {nom}, » sans nom
donnerait « Bonjour , », et le rattrapage par expression reguliere ne se
comporte pas pareil en arabe. `greeting_named` (qui **doit** contenir `{nom}`,
verifie par l'action) et `greeting_plain` sont deux champs distincts.

⚠️ **Une colonne nulle retombe sur `emails/copy.ts`, et une chaine vide
aussi.** Vider un champ revient au defaut, cela n'efface pas la mention
legale du pied de page. Rien n'est seme en base — ce serait une seconde copie
des textes a maintenir en double — sauf **le modele par defaut lui-meme**, qui
est un contenant et non du texte. Consequence : une installation sans ces
tables envoie exactement ce qu'elle envoyait avant, et l'ecran le dit.

⚠️ **Un seul modele par defaut, tenu par un index unique partiel** — gere dans
le code, deux clics rapproches en laisseraient deux et la diffusion
choisirait au hasard. `setDefaultEmailTemplate()` retire l'ancien **avant** de
poser le nouveau : l'inverse violerait l'index a chaque fois. Le dernier
modele ne se supprime pas (trigger `guard_last_email_template`).

⚠️ **Le sens de lecture n'est pas personnalisable.** Il decoule de la langue.
Un arabe passe en `ltr` par mégarde serait illisible, et personne dans
l'administration ne le verrait.

⚠️ **Seul le nom affiche de l'expediteur est modifiable, pas l'adresse** : elle
doit rester sur le domaine verifie SPF/DKIM ou Resend refuse l'envoi. Et ce
nom est **nettoye** avant d'entrer dans l'en-tete `From:` —
`sanitizeSenderName()` retire `\r`, `\n`, `<`, `>` et `"`. Un retour a la
ligne dans un en-tete permet d'en injecter un autre (un `Bcc:` vers un
tiers) ; c'est teste, et verifie par mutation.

**Le choix du modele a la diffusion.** Le composeur montre un selecteur
**uniquement quand le canal email est coche** — l'in-app et le push n'ont pas
d'habillage, et poser la question en permanence appellerait une reponse qui
ne change rien. `admin_notification_campaigns.email_template_id` retient
lequel a servi, et **la relance rejoue celui de la campagne d'origine**, pas
celui devenu defaut depuis : le destinataire doit recevoir ce qui avait ete
decide. `fetchCopyForSend()` retombe sur le defaut puis sur les textes livres
— une campagne ne doit pas echouer parce qu'un modele a ete supprime entre la
redaction et l'envoi.

**Ce que l'interface fait, et pourquoi :**

- **Une galerie, pas un tableau.** Un modele se reconnait a ce qu'il a l'air ;
  un nom dans une ligne ne dit rien de ce qui part. Chaque carte porte une
  vignette du **vrai** courriel. ⚠️ La reduction est un `transform`, jamais
  une largeur d'`iframe` : un courriel mis en page pour 600 px et affiche
  dans 280 px se recomposerait, et la vignette montrerait autre chose que ce
  qui part. Elle est centree par `left: 50%` + marge negative — avec
  `origin-top-left` elle laissait un vide blanc a droite qui se lisait comme
  un defaut de rendu (mesure, corrige).
- **Les langues sont des onglets dans le formulaire**, pas des pages : on
  traduit un habillage en regardant celui d'a cote, et changer de page
  perdrait la saisie. L'etat du bouton suit l'onglet par derivation pendant
  le rendu, pas par un effet — `react-hooks/set-state-in-effect` rejette
  l'autre version, et a raison.
- **Une pastille « perso » marque les champs enregistres.** Treize champs dont
  trois sont modifies se lisent autrement tous pareil, et on ne sait plus ce
  qu'on a change ni ce qui suit encore le defaut.
- **Le placeholder de chaque champ est le texte livre**, pas un exemple
  invente : vider un champ revient au defaut, donc le placeholder montre
  exactement ce qui partira.
- **La barre d'enregistrement colle au bas de la fenetre** : treize champs, et
  un bouton en pied de page oblige a redescendre a chaque essai.
- **L'apercu est une `iframe` en `sandbox=""`**, rendu par `CampaignEmail` —
  le vrai composant. Une maquette qui lui ressemble finirait par diverger,
  justement sur l'ecran ou on lui fait le plus confiance. Le bac a sable n'est
  pas decoratif : le contenu vient de la base.
- **Le rail porte le groupe** (Diffusion / Modeles d'e-mail), meme raison que
  pour la moderation et les validations. Aucun compteur — ni l'une ni l'autre
  n'est une file.
- `npm run email` reste le chemin **developpeur** : il montre le gabarit avec
  les textes livres, pas les modeles enregistres, qui se voient dans l'apercu
  de l'ecran.

Verifie sur un Postgres jetable : reprise d'une personnalisation ecrite avant
`…300004` dans le modele par defaut, cle primaire passee a `(template_id,
locale)`, deux defauts refuses, meme langue dans deux modeles acceptee,
suppression en cascade des textes, suppression du dernier modele refusee.


## Couleurs du modele, et message mis en forme (Sept 2026)

Demande du client : « une lib comme le blog, et pouvoir choisir les
couleurs ». Le choix a ete pose explicitement — couleurs + Tiptap, plutot
qu'un constructeur glisser-deposer. Migration
`202609300005_email_colors_and_rich_body.sql`.

**Pourquoi pas GrapesJS ni Unlayer.** Un constructeur visuel existe et
marche : `grapesjs` + `grapesjs-preset-newsletter` (MIT, auto-heberge) rend
du HTML en tableaux. Il coute ~1 Mo dans le paquet d'administration,
remplace le gabarit React Email, et surtout **fait sauter la charte** — les
quatre couleurs, les deux polices et la structure cesseraient d'etre tenues
par le code. `react-email-editor` (Unlayer) est plus simple mais c'est une
**iframe hebergee** : le contenu des modeles transiterait par unlayer.com,
ce qui est une decision de fournisseur a prendre par le client, pas a
glisser dans une passe technique.

⚠️⚠️ **Le message riche est sur parce que rien de ce que le client envoie
n'est jamais emis comme du HTML.** Le chemin, et chaque maillon compte :

1. l'editeur produit du HTML dans le navigateur ;
2. `parseRichText()` le **reanalyse cote serveur** contre
   `RICH_TEXT_EXTENSIONS`, le meme schema qu'a l'ecran. ProseMirror est une
   liste blanche par construction : mesure contre ces extensions,
   `<script>`, `<iframe>`, `<img onerror>`, `style=`, `class=`, `onclick=`
   et les liens `javascript:` ne survivent pas — seul leur texte reste ;
3. `emails/rich-body.tsx` parcourt l'**arbre** obtenu et emet des composants
   React. Un type de noeud inconnu n'a pas de branche : son texte est rendu,
   sa mise en forme est perdue. Une liste blanche qui se trompe rend un
   message terne ; une liste noire qui se trompe envoie une injection.

Ne pas « simplifier » en posant `dangerouslySetInnerHTML` sur le HTML
enregistre : le composeur n'est pas la seule facon d'atteindre le Server
Action.

⚠️ **`body` reste le texte brut, et `body_html` ne sert qu'au courriel.**
C'est `body` que `admin_broadcast_notification` ecrit dans
`public.notifications` — donc ce que la cloche affiche et ce que le push
pose sur un ecran verrouille, qui ne rend pas `<strong>`. Le texte brut est
**derive** de la mise en forme (`richToPlainText`), jamais saisi a part, et
l'action le recalcule cote serveur : sans cela un appel direct enverrait un
courriel disant une chose et une notification en disant une autre. Les
elements de liste prennent un tiret, sinon « un deux trois » se lit comme
une phrase.

**Les couleurs** sont cinq colonnes (`color_header_bg`, `color_body_bg`,
`color_text`, `color_button_bg`, `color_button_text`), pas un theme libre.
Chacune est un `#rrggbb` verifie par une contrainte Postgres **et** par
l'action : une couleur finit dans un attribut `style`, ou
`#ffffff; position:fixed` passerait aussi bien qu'une couleur (teste, refuse
des deux cotes). Nulles, elles retombent sur la charte definie dans
`emails/copy.ts` — le seul endroit du depot ou la charte est ecrite deux
fois, parce qu'un courriel n'a pas de cascade.

- ⚠️ **`readableOn()` bascule le nom de la marque entre blanc et noir** selon
  la luminance du fond d'entete (seuil WCAG). Des l'instant ou l'en-tete
  devient reglable, un fond clair rendait le nom invisible — et personne
  cote administration ne l'aurait vu, l'apercu etant regarde apres avoir
  choisi la couleur.
- ⚠️ **Les pastilles de couleur de l'editeur ne sont pas les quatre de la
  charte.** Le blanc et le `#cccccc` sont illisibles en texte sur un fond
  clair ; les proposer parce qu'ils sont dans la charte serait offrir deux
  facons de rendre un message invisible. L'editeur propose la marque, le
  corps et un gris attenue.
- ⚠️ **`<input type="color">` ne sait pas etre vide** — il vaut `#000000` par
  defaut, ce qui enregistrerait du noir la ou on voulait « laisse comme
  c'est ». La valeur envoyee est celle du champ texte ; la pastille ne fait
  que l'ecrire.
- ⚠️ **`@tiptap/html` s'importe par `@tiptap/html/server` cote Node** —
  l'entree par defaut leve « can only be used in a browser environment ».
- ⚠️ **StarterKit embarque deja Link** : l'ajouter a cote produit
  « Duplicate extension names » et deux schemas concurrents. Il se configure
  dans `StarterKit.configure({ link: … })`.
- `parseRichText('<p></p>')` rend `null` : un editeur vide produit un
  document d'un paragraphe sans texte, donc compter les noeuds ne suffit pas.
- `tests/campaign-email.test.cjs` — 12 assertions, **verifiees par mutation**.
  ⚠️ Le garde de `href` dans `rich-body.tsx` est **inatteignable par le
  chemin normal** puisque le schema filtre deja `javascript:` : le test qui
  passait par `parseRichText` restait vert apres sa suppression. Il y a donc
  un test qui construit l'arbre **a la main** pour verifier ce second garde
  pour lui-meme.
- **Ou se voit la mise en forme** : dans l'editeur lui-meme, qui la rend, et
  dans l'apercu de l'ecran de modele pour l'habillage. Le composeur, lui,
  previsualise l'ecran verrouille — c'est-a-dire le texte brut, qui est
  exactement ce que le push affiche.


## Le corps du modele se compose par blocs (Sept 2026)

Decision du client, prise explicitement apres arbitrage : le super
administrateur n'est pas technicien, il lui faut du glisser-deposer. La
reponse n'est pas une toile libre mais une **palette fermee** —
`202609300006_email_blocks.sql`.

⚠️⚠️ **Pourquoi une palette et pas GrapesJS/Unlayer, pour un non-technicien
precisement.** L'argument « il n'est pas technicien donc il lui faut plus de
liberte » se retourne : il ne pourra pas verifier son courriel dans dix
clients de messagerie, n'ouvrira pas Outlook, et ne verra pas qu'une
trois-colonnes s'empile mal sur un telephone. Une toile donne la liberte de
disposer **et** celle de casser ; une palette ne donne que la premiere.
Chaque bloc est un composant React Email : l'agencement est libre, le rendu
ne l'est pas.

**Le modele dit *ou* le message se pose, le composeur dit *ce qu'il
contient*.** Le bloc `message` est cet emplacement. Il ne se supprime pas et
n'existe qu'en un exemplaire : deux enverraient le texte deux fois, zero le
ferait disparaitre — `normalizeBlocks()` en rajoute un a la fin plutot que de
perdre ce que quelqu'un vient d'ecrire.

⚠️ **La structure est portee par le modele, les textes par langue dans
chaque bloc.** On compose une fois, on traduit trois fois. L'inverse
obligerait a refaire la mise en page dans chaque langue et laisserait les
trois diverger.

⚠️ **`normalizeBlocks()` reconstruit, il ne filtre pas.** La colonne `blocks`
est du JSON libre venu d'un formulaire. Chaque bloc est recopie champ par
champ contre la liste blanche : un type inconnu, une cle en trop, une langue
inventee, une adresse qui n'est pas http/https/mailto n'ont pas de branche et
disparaissent. Teste. La contrainte Postgres ne dit que « c'est une liste, et
elle fait moins de 40 » — la forme se valide en TypeScript, au plus pres du
rendu.

- ⚠️ **Le bouton de l'habillage s'efface devant celui de la mise en page.**
  Des le premier modele compose avec un bouton, deux appels a l'action se
  superposaient. Laisser le super administrateur decocher le second
  supposerait qu'il sache d'ou vient chacun ; la regle le fait a sa place, et
  le formulaire le dit plutot que d'afficher un reglage sans effet.
- ⚠️ **Une image a deux traitements, parce qu'elle a deux usages.** En
  `full` : attribut `width` **et** style, sans l'attribut Outlook rend la
  taille native, sans le style l'image deborde sur un telephone. En `auto` :
  aucune largeur imposee — la premiere version etirait tout a 552 px, ce qui
  rendait un pictogramme flou et enorme.
- ⚠️ **Les colonnes sont des `Row`/`Column`**, donc des `<table>` : une
  colonne ecrite en flexbox s'empile chez Outlook. Et en lecture de droite a
  gauche, la colonne « de debut » se rend a droite — c'est l'ordre de
  lecture qui compte, pas le nom du champ.
- ⚠️ **Bucket `email-media`, public, distinct de `blog-media`.** Un client de
  messagerie charge une image sans session et ne suit pas une URL signee :
  les buckets prives du back-office sont inutilisables. Distinct de
  `blog-media` parce que celui-la est garde par `blog.manage`, qui n'est pas
  la permission de qui compose un courriel. Ecriture reservee au super
  administrateur, 2 Mo par fichier.
- ⚠️ **Les identifiants de bloc sont derives de la liste**, pas tires au
  hasard : `Date.now()`/`Math.random()` sont des appels impurs que le
  compilateur React refuse dans du code de rendu — et un compteur qui evite
  les identifiants deja pris ne peut pas percuter un bloc enregistre.
- Le glisser-deposer est pilotable **au clavier** (`KeyboardSensor` de
  dnd-kit) : sans lui, changer l'ordre des blocs n'aurait eu qu'une seule
  voie d'acces.
- `tests/campaign-email.test.cjs` — 15 assertions, **verifiees par mutation**.
  ⚠️ Un temoin y a rattrape une erreur de test : l'apostrophe est echappee
  dans le HTML rendu (`&#x27;`), donc `doesNotMatch(/Ouvrir l'application/)`
  passait **sans rien prouver**. C'est le `assert.match` du cas contraire qui
  l'a revele — raison d'etre des temoins.


## Tout ce qui se lit est un bloc (Sept 2026)

Suite de la demande precedente : « on ne pourrait pas tout mettre comme ca ? ».
L'accueil, la signature **et le titre** ont rejoint les blocs.

⚠️ **Le titre appartient au bloc `message`, plus a l'ossature.** Sans ce
deplacement, une formule d'accueil posee en bloc serait forcement tombee
*sous* le titre : l'ordre n'aurait ete libre qu'a moitie, et le defaut aurait
ete invisible jusqu'au premier essai.

⚠️ **Repli, pas remplacement.** `greeting_named`, `greeting_plain` et
`signature` existent toujours comme champs d'habillage ; des qu'un modele
pose le bloc correspondant, le champ s'efface et le formulaire le dit. Meme
regle que le bouton : aucun modele existant ne perd son accueil, l'adoption
se fait modele par modele, et **aucune migration de donnees** n'est
necessaire.

**Ce qui reste hors des blocs, et pourquoi :**

- **Le pied de page** — « pourquoi ce message », le lien de desabonnement, la
  mention finale. Ce n'est pas du contenu, c'est l'ossature legale. En faire
  un bloc supprimable laisserait un super administrateur non technicien
  retirer le lien de desabonnement, qui est precisement l'element dont
  l'absence fait declasser un domaine par Gmail.
- **Les couleurs**, qui sont un reglage de tout le courriel : glisser une
  couleur n'a pas de sens.

⚠️⚠️ **Divergence d'hydratation corrigee : `<DndContext id="…">`.** dnd-kit
derive le `aria-describedby` de chaque poignee d'un **compteur de module**
(`useUniqueId(prefix, value)` incremente `ids[prefix]` quand aucune valeur
n'est fournie). Ce compteur repart de zero dans le navigateur mais pas sur le
serveur : le HTML rendu portait `DndDescribedBy-0`, l'hydrate
`DndDescribedBy-1`, et React signalait la divergence a chaque ouverture de
l'ecran. Fournir un `id` court-circuite le compteur. `tests/block-builder-ssr.test.cjs`
rend le compositeur **deux fois** et compare : c'est exactement ce que
reproduit la divergence, et la mutation (retirer l'`id`) fait reapparaitre le
couple `-0` / `-1`.

**L'etat de traduction se lit bloc par bloc.** Chaque bloc porte trois
pastilles `fr / en / ar`, allumees quand ce bloc a un texte dans cette langue,
et qui y emmenent d'un clic. ⚠️ « Rempli » veut dire **tous** ses champs
traduisibles : un bloc « deux colonnes » dont une moitie seulement est
traduite rendrait une colonne vide, et une pastille allumee le cacherait.
Un onglet de langue en haut de page dit quelle langue on edite, jamais
lesquelles sont faites — on decouvrait un bloc vide en arabe en basculant
dessus, c'est-a-dire trop tard.


## Passe de finition sur la diffusion (Sept 2026)

Six points, dont un defaut reel que la passe precedente avait introduit.

⚠️⚠️ **Perte de saisie silencieuse sur l'editeur de modele, corrigee.** Le
formulaire etait monte une fois et **remonte par `key={locale}`** a chaque
changement d'onglet de langue : une traduction a moitie tapee disparaissait
sans un mot des qu'on allait verifier la langue d'a cote. Il y a desormais
**un formulaire par langue, tous montes, un seul visible** — le navigateur
garde l'etat de chaque champ, et `hidden` sort les autres du flux comme de
l'ordre de tabulation. Consequence a connaitre : l'etat de la case « bouton »
est devenu une valeur **par langue** (`ctaOverrides`), un seul booleen
s'appliquant aux trois formulaires a la fois.

⚠️ **L'envoi test envoie maintenant le vrai courriel, a soi.** C'est le seul
garde-fou avant une diffusion qui ne se rappelle pas. Un test qui n'envoyait
que la version in-app ne disait rien de l'habillage, du modele choisi, de la
mise en forme ni du rendu chez un vrai client de messagerie — c'est-a-dire de
tout ce qui peut se voir mal. Il emprunte exactement le meme chemin que la
diffusion. ⚠️ Sa cle d'idempotence porte la **seconde** courante : reappuyer
sur « test » doit renvoyer, alors qu'une diffusion rejouee ne doit surtout
pas se doubler.

**Le composeur previsualise le courriel, en vrai.** Le panneau de droite a
deux onglets — ecran verrouille (texte brut, ce que le push affiche) et
e-mail — plus un selecteur de langue. Le rendu vient du serveur
(`previewCampaignEmail`), par le **meme** `renderCampaignEmail()` que
l'ecran de modele : reproduire le gabarit dans le navigateur donnerait un
apercu qui *ressemble* au courriel et finirait par en differer, justement la
ou l'on s'y fie pour appuyer sur « Envoyer ».

- ⚠️ **Tout `setState` de l'apercu vit dans le minuteur**, jamais dans le
  corps de l'effet : `react-hooks` refuse le second (« cascading renders »),
  et l'indicateur de rendu doit s'allumer quand la demande part, pas a chaque
  touche. Debounce 500 ms, reponse perimee ignoree par un drapeau
  `cancelled` — sans lui l'apercu clignoterait vers un etat passe.
- ⚠️ **La barre d'outils est un `role="toolbar"` a un seul arret de
  tabulation**, fleches a l'interieur (motif ARIA). Quinze boutons dans
  l'ordre de tabulation obligeraient un utilisateur au clavier a tous les
  traverser pour atteindre le champ de saisie.
- **`renameEmailTemplate` etait une action morte** — ecrite, exportee,
  appelee nulle part. Elle est branchee sur la carte de la galerie : un
  modele mal nomme se corrige la ou on le lit.
- **Les vignettes de la galerie sont rendues en parallele.** Trois rendus
  independants enchaines ajoutaient leurs durees pour rien.
- Mesure 375 → 1920 de la nouvelle colonne d'apercu et de la barre d'outils :
  rien de rabote, `scrollWidth === clientWidth` partout, la barre se replie
  sur deux lignes (quatre a 375 px) et les onglets tiennent sur une.

