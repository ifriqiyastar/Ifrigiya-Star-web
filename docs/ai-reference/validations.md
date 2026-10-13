# Validation queues — `/admin/validations/*`

> Reference for [`../../CLAUDE.md`](../../CLAUDE.md). **Read when:** touching
> the player / professional / supporting-document / identity queues, their
> badges, their state filter or the dossier rail.

## Validations is four routes too, and validated content is findable again (Sept 2026)

**`/admin/validations` was split the same way as moderation**, for the same
reason: one page of 1 300 lines serving four queues behind `?vue=`, a rail
showing a single line, and three of the four screens existing only for whoever
knew to click a tab.

| Route | Queue |
|---|---|
| `/admin/validations` | redirect only — translates `?vue=` to the new path |
| `…/joueurs` | player profiles |
| `…/professionnels` | professional accounts |
| `…/justificatifs` | professional supporting documents |
| `…/identite` | identity (KYC) documents |

What differs from moderation: the four header measures are **cross-queue**
("les quatre files reunies", average review delay, approval rate), so they are
a shared `ValidationMetrics` component rendered by each page rather than
per-page copies. `ValidationFilter` and `ValidationNotes` follow the same rule;
`PAGE_SIZE`, `EMPTY_ID`, `groupBy`, `countBy` moved to
`lib/queries/validations-shared.ts`. The rail entry gained the same
collapsible `children`.

⚠️ The index page cannot be deleted, same as moderation: `admin-queue.ts`, the
account menu and bookmarks still carry `?vue=`.

### La pastille dit *ou*, et la file montre enfin ce qui est tranche (Oct 2026)

Deux defauts signales par le client sur le meme ecran, et les deux etaient
documentes ici comme des choix.

⚠️ **« Le chiffre a cote de Validations ne dit pas ou il est. »** Exact : le
compte restait sur le parent, et cette page affirmait que le repartir
« demanderait une pastille par file dans `NavBadges` ». C'est precisement ce
qu'il fallait faire — la meme correction avait deja ete faite pour la
moderation en Oct 2026, pour la meme raison : un nombre qu'on ne peut pas
situer fait ouvrir les quatre ecrans pour trouver les deux dossiers. `badges`
porte desormais `joueurs`, `professionnels`, `justificatifs` et `identite` a
cote du total `validations`, `NAV_ITEMS` les pose sur les quatre sous-entrees,
et `NavMain` retire celle du parent quand le groupe est deplie pour que le
meme nombre ne soit pas imprime deux fois. Rien a ajouter a `QUEUE_TABLES` ni
a la migration temps reel : les quatre files y etaient deja, seules leurs
pastilles manquaient.

⚠️⚠️ **Les quatre ecrans ne montraient QUE ce qui attend**, `status` etant
pose en dur dans la requete. Une fois le dossier tranche il sortait de
l'ecran, et **plus rien dans le back-office ne le montrait** — ni pour
verifier une decision, ni pour la reprendre, ni pour repondre a quelqu'un qui
la conteste. C'est le meme manque que la moderation avait corrige en Sept 2026
avec le filtre « Validee ». `ValidationFilter` porte maintenant un `<select>`
d'etat, et `validationStatus(scope, etat)` ramene ce qui vient de l'URL a une
valeur que la table connait.

- ⚠️ **Deux familles de statuts, et les confondre ne leve aucune erreur.** Les
  deux tables de profil disent `en_attente_validation` (enum
  `player_profile_status`), les deux tables de pieces disent `en_attente` :
  interroger l'une avec la valeur de l'autre rend une file **vide, sans
  message** — PostgREST n'a rien a redire a un statut qui n'existe pas, il ne
  trouve simplement rien. D'ou `ValidationScope` et une table unique des
  valeurs permises.
- **L'etat par defaut reste « en attente »** : ce sont des files de travail,
  elles s'ouvrent sur ce qui attend. Une valeur inventee dans l'URL y retombe.
- ⚠️ **Le vide doit nommer le filtre qui le produit.** « Aucun profil joueur en
  attente » affiche sur une file reglee sur « Valides » ferait croire que rien
  n'a jamais ete valide. Les quatre `EmptyState` basculent sur « Aucun dossier
  dans cet etat ».
- ⚠️ **Un geste qui ne peut rien changer n'est plus propose** : « Valider » sur
  un dossier deja valide, « Refuser » sur un dossier deja refuse. Le chemin
  inverse reste ouvert — reprendre un refus est exactement ce pour quoi on
  vient lire l'historique. La validation en masse, elle, filtre deja
  `status = 'en_attente_validation'` cote serveur et rend le nombre de lignes
  reellement changees.
- `etat` voyage dans `Pagination` : sans lui, la page 2 revenait a la file en
  attente.
- Mesure 375 → 1920 du bandeau contre la feuille compilee : le `<select>`
  garde 143 px partout (c'est le controle qui etait tombe a 21 px sur la
  moderation), le champ de recherche ne descend pas sous 206 px, et sous
  1024 px le `<select>` passe a la ligne au lieu d'ecraser la recherche.

## Seeing what has been validated (Sept 2026)

Asked as "why don't we see things we have validated in moderation". Because
nothing on the screen ever read the columns that record it.

0089 writes **`moderated_by` and `moderated_at`** alongside `moderation_status`,
stamped by its trigger. The back-office selected neither. Since the admin
journal was removed at the client's request, those two columns are the *only*
trace of who decided and when — so the screen could say "en attente" and
"refusee" but had no way to show, or find, anything that had been approved.

- `selectWithModeration()` now requests them, and `ContentWhy` renders a
  **Validée — date · par X** line, so a decision is visible on the row it was
  taken on.
- The `etat` filter gained **Validée**, which no filter covered before: "En
  ligne" means `is_hidden = false`, which is not the same as "somebody approved
  this".
- ⚠️ **That filter requires `moderated_at is not null`, and the line only
  renders when a trace exists.** 0089 approves all pre-existing content by
  default (`default 'approuve'`, then the default flips to `en_attente`), with
  no decider and no date. Showing "Validée" on those rows would present a
  migration default as a human decision, and filtering on
  `moderation_status = 'approuve'` alone would return the entire pre-0089
  archive as "things you validated".
- Verified against the live project that both columns exist, with the negative
  control described under the six-axis section: an invented column answers
  `42703` before RLS, `moderated_by` answers `42501`.


## The selectable queues run full width (Sept 2026)

Client request. `/admin/validations/joueurs` and `…/professionnels` were a
12-column grid — queue on `col-span-8`, `DossierRail` on `col-span-4` — so the
queue that carries the **multiple selection** (checkboxes, identity, position,
document, timestamp and the quick decisions) had two thirds of the usable
width. The queue now takes the whole width and the dossier reads **underneath**
it: you pick in the list, then you read the file.

Three things came with it, and none is cosmetic:

- **`DossierRail` lost `xl:sticky xl:top-4` and `self-start`.** Sticky existed
  because it was a column beside a longer list and had to stay in view while
  you scrolled it; under the list it sticks to nothing. `self-start` would
  shrink it to its content width inside a flex column.
- **`<main>` gained `xl:px-8`.** 20 px of padding was fine for a
  two-thirds-width panel; a full-width table pressed against the edge on a
  large screen. Vertical rhythm is untouched.
- Measured 768 → 1920 against the compiled stylesheet: at 1280 the queue goes
  from ~640 px to 960 px, `document.scrollWidth` never exceeds `clientWidth`,
  and below `xl` the table keeps scrolling inside its own
  `overflow-x-auto` as before.

⚠️ **What this does not solve**: `DossierRail`'s children were written for a
narrow column and now stack down a very wide card. That reads sparse at 1600 px
and probably wants a multi-column pass — but the right number of columns
depends on what the dossier actually holds for a real player, which cannot be
seen without an admin session. Left alone rather than guessed at.

