# Moderation and content validation — `/admin/moderation/*`

> Reference for [`../../CLAUDE.md`](../../CLAUDE.md). **Read when:** touching
> reports, posts, comments, player media, the super-admin content approval, the
> preview popup or the moderation rail group.
> The filter bar's responsive failure and the measurement recipe live in
> [`design-system.md`](design-system.md).

## Feed posts and comments need super-admin approval (Sept 2026)

Client request, mirroring Scout Days: **every post and every comment waits for a
super administrator** before anyone but its author can see it. Mobile migration
`0089_content_moderation.sql` carries the rule; this repo carries the screen and
the fine-grained permission.

| File | Role |
|---|---|
| `supabase/migrations/202609240001_content_validation_permission.sql` | seeds `content.validate`, super admin only |
| `lib/actions/content-validation.ts` | approve / reject a post or a comment |
| `app/[locale]/admin/moderation/page.tsx` | the queue + preview, in the existing `publications` and `commentaires` views |

Where it lives, and why not a new nav section: `/admin/moderation` **already
had** `vue=publications` and `vue=commentaires`. A queue panel was added at the
top of each — same shape as the Scout Days pending queue — rather than a
seventh rail entry for a module the CDC calls secondary. `moderation.manage`
opens the screen; `content.validate` reveals the buttons. Exactly the
`events.manage` / `events.validate` split.

Things that will bite whoever touches this next:

- ⚠️ **Asking for `moderation_status` on a project without 0089 fails the whole
  query in `42703`** — the entire post list would vanish from the back-office,
  not just the new column. `selectWithModeration()` therefore retries without
  the columns and returns `available: false`; the status pill, the two extra
  filters and the buttons disappear together. Same reasoning as the Scout Days
  list deliberately not selecting 0040's columns.
- ⚠️ **Write with the admin's session (`createClient`), never
  `createServiceClient`.** `service_role` bypasses RLS **and makes
  `auth.uid()` null**, so the trigger could not stamp `moderated_by` and the
  decision would be untraceable — the very objection mobile migration 0042
  raised against moderating through a service key.
- **`.select("id")` after the update, always.** PostgREST does not fail when
  RLS filters the targeted row: the update touches zero rows and returns
  success. The screen would announce "post approved" with nothing changed —
  the trap already paid on `professional_documents` and then on `scout_days`.
- **The rejection reason is mandatory here and in Postgres**
  (`moderation_reason_required`): it is the only explanation the author gets,
  delivered by the `notify_content_moderation` trigger. Do not also queue an
  `admin_notification_campaigns` row — that would send the notice twice.
- **Every list and every queue is newest-first** (client request, Oct 2026).
  The queues used to be oldest-first so that what waited longest came up
  first; the client chose one order everywhere. Each queue card still shows
  how long it has waited, which is now the only cue for what is late. The one
  exception is a comment thread, which stays chronological — it is read like a
  conversation.
- **"Examiner" opens the same popup**, from the comment queue and from the
  comment list alike — a comment is judged on what it sits under, and
  "bien joue" under an announcement is not "bien joue" under an insult. The
  parent posts are loaded in **one** query for the whole page (`.in("id", …)`
  through `selectWithModeration`), never one per row, and their authors are
  folded into the same `fetchProfilesByIds` call — the post's author is not the
  comment's. ⚠️ **It was previously a link to
  `?vue=publications&q=<post_id>`, which could never work**: `q` is a full-text
  filter on `content`, so searching an id matched nothing. ⚠️ It was then a
  **"Voir la publication" button that disappeared when the parent was
  unreachable** (removed, or filtered by RLS) — defensible while the row still
  carried the comment's own buttons, fatal once it did not: the comment became
  unmoderable. Since Oct 2026 the popup opens anyway and says the post is
  missing; an incomplete file is not an absent one.
- `content.validate` was added to `ALL_ADMIN_PERMISSIONS`, so on a project
  where the permission migration has not run `getAdminAccess()` treats it as
  unseeded and the buttons still show — matching `requirePermission()`, which
  lets unknown codes through. That is the fix documented above for the Scout
  Day "Valider" button; it only works because the code is in that array.

Verified: `npm run build` green, `npm run lint` clean for the touched files
(the remaining errors pre-date this change, in `tests/admin-i18n.test.cjs` and
`app/[locale]/blog/page.tsx`), `npm run test:i18n` 7/7 including fr/en parity,
and the permission migration replayed twice against a throwaway Postgres —
including the guard-rail case where a previous deployment had granted it to
`moderator`, which it strips.


## Moderation is four routes, and the rail carries them (Sept 2026)

`/admin/moderation` was one 1 800-line page serving four views behind `?vue=`.
The rail showed a single line, so Publications, Commentaires and Medias joueurs
only existed for whoever knew to click a tab; switching tabs did not change the
address; and the four datasets were described in the same file — which is how
the same client-side search bug came to be written three times.

| Route | Screen |
|---|---|
| `/admin/moderation` | redirect only — translates `?vue=` to the new path |
| `/admin/moderation/signalements` | reports queue, list, register export, the four `NoteCards` |
| `/admin/moderation/publications` | posts |
| `/admin/moderation/commentaires` | comments |
| `/admin/moderation/medias` | player videos and photos |

The report dossier stays at `/admin/moderation/signalements/[id]`, now a child
of its own list rather than of a tab.

⚠️ **The index page cannot be deleted.** `lib/queries/admin-queue.ts`, the
dashboard tile and anything an administrator bookmarked still carry `?vue=`.
It maps the old address onto the new one and forwards every other parameter —
a redirect costs a round trip, a 404 costs a case nobody finds.

**Shared code moved out rather than being copied four times.**
`lib/queries/moderation-content.ts` holds the reads (`selectWithModeration`,
`fetchPendingContent`, `fetchContentReports`, `fetchReportCounts`,
`hasModerationColumns`, `likeTerm`, the row types and column lists);
`components/admin/moderation/pieces.tsx` holds `ContentWhy`,
`RefuseContentDialog`, `ModerationFilters`, `previewOf`. Four copies of
`likeTerm` is how the search bug comes back.

**The rail's Moderation entry is a collapsible group.** `NAV_ITEMS` gained
`children`, and `navLabel()` now types parent and child keys alike, so adding
an entry without its label still breaks the build. Four things decided here:

- ⚠️ **With children, the parent row toggles and does not navigate.** A row that
  did both would move you to another screen when you aimed at the chevron.
  Nothing is lost — the parent route only redirects to the first child.
- ⚠️ **Except when the rail is collapsed to icons**, where the stylesheet hides
  `SidebarMenuSub` entirely: a toggle-only parent would then do *nothing at
  all*, where it used to reach the section. In that state it is a link again.
- ⚠️ **A badge counts what awaits on the line it labels** (corrected Oct 2026).
  Signalements was the only child carrying one, and it summed *all four*
  moderation queues — so a publication awaiting a super admin was added to the
  Signalements figure, where it is not reviewed: you clicked the number and
  landed on a screen that had nothing. `badges` now carries `moderation` (the
  group total), `signalements` (reports + removals), `publications` and
  `commentaires`. Medias joueurs still has none, because `fetchAdminQueue()`
  counts no queue for it — inventing one means adding its tables to
  `QUEUE_TABLES` **and** to the realtime migration, or the number silently
  lags. The group shows the total while closed and drops it while open, so the
  figure is never printed twice. `DANGER_BADGES` (`nav-items.ts`) is what keeps
  the red tone on all of moderation: it used to be `badge === "signalements"`,
  which would have rendered the two new counts in lime.
- ⚠️ **`posts` and `post_comments` were missing from `QUEUE_TABLES`** since
  0089 added their two queues, so those counters only ever moved on the 10 s
  poll while their moderation neighbours updated instantly. They need no entry
  in `202609090001`: **mobile migration 0090 already publishes them** for the
  feed. It does so deliberately *without* `replica identity full`, so an
  UPDATE may be dropped at RLS re-evaluation and a status change waits for the
  poll — the INSERT, i.e. a post that has just been submitted, comes through.
  Forcing `full` on the product's two busiest tables would cost continuous WAL
  to win ten seconds on a counter; same arbitration 0026 and `202609090001`
  state explicitly for `public.messages`.
- ⚠️ **`usePathname()` returns the locale prefix and `NAV_ITEMS` does not.**
  `pathname.startsWith("/admin/moderation")` was false on `/en/admin/...`, so
  the active highlight never lit in English or Arabic — a pre-existing bug the
  auto-expand would have inherited. `stripLocale()` now normalises it.
- The open state is derived during render (React's documented pattern for
  state that follows a prop), not in an effect — `react-hooks/set-state-in-effect`
  rejects the effect version, and rightly.

## The moderation queue: search, priority and where decisions are taken (Sept 2026)

Four changes to `/admin/moderation`, two of them corrections of a defect that
had been written three times.

⚠️⚠️ **A list filter must be part of the query, never a pass over the result.**
All three list views paginated first and filtered in JavaScript afterwards:

```ts
.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)   // 20 lignes
const visible = rows.filter((row) => row.reason?.includes(params.q))
```

So a term present in the 200th report was never found, `count` — which drives
`Pagination` *and* the panel footer — ignored the filter entirely, and the
footer read "3 affiches sur 214" when 194 had not been looked at. In
`ReportsView` the empty check tested `rows` (the page) while the body mapped
`visible` (the matches), so a search matching nothing on the current page
rendered **a table with headers and no rows** instead of `EmptyState`. On a
moderation queue a search that answers "nothing" wrongly is worse than no
search. It is now `.ilike(...)` inside the query builder, so count, pagination
and the empty state cannot disagree. `likeTerm()` escapes `%`, `_` and `\`:
commas and parentheses need no escaping — they are only reserved inside
PostgREST's `or=(...)` — but `%` left raw makes a search for "100%" match
everything starting with "100". Verified against the real `postgrest-js`
builder, not assumed.

⚠️ **The Priorite column was computed on the page, and the column exists
precisely for the case that makes that wrong.** "Niveau 2 — signalements
multiples" came from a `reduce` over the twenty displayed rows: a target
reported five times, spread across pages 1 and 3, read "Niveau 1" on both.
`fetchReportCounts()` now counts over the whole table, bounded to the targets
actually on screen, and never returns zero for a row that is on screen.

**Signalements has a queue, like the two tabs beside it.** Publications and
Commentaires both open on what is blocked; Signalements had nothing, and a
removal awaiting a super admin — content already quarantined — was a lime row
border somewhere inside two hundred rows sorted by arrival. The `a_valider`
reports now sit in a `Panel highlighted` above the list, newest-first, carrying
confirm and refuse. The queue ignores the list's filters, same convention as
`fetchPendingContent()`.

**The table row is a register, not a decision surface.** It carried up to three
buttons, including "Proposer le retrait" — irreversible for the author, requires
a written reason, and was being taken from an excerpt truncated to 56
characters. That is the same argument that made a post open in a popup and a
comment drag its thread along: you do not judge content outside its context.
The dossier page already carries all four gestures with the evidence in view,
and what is blocked is handled in the queue above. The row keeps the link to the
dossier (now the primary button) and "Classer", the one gesture that needs no
reason.

**…but the row now shows what was reported, in a popup** (Oct 2026, client
request: "the same preview popup as on subscriptions and payments").
`ReportTargetPopup` turns the excerpt of both lists — the table and the
removals-to-validate queue — into a trigger that opens a short card, laid out in
the four blocks of the dossier it leads to: **the signals** (moderation state
already applied, quarantine, report count, messaging provenance, blocks
received, and the short reference), **the evidence** in one frame (media on top,
the full 400-character excerpt below, author band with the date and a link to
the target's own record at the bottom), **the reason written by the reporter**
in full, and the way out to the dossier.

Two things the first version got wrong, both worth remembering:

- **The title repeated the trigger.** It was the excerpt, which the body then
  showed again in full — the same sentence twice, once truncated. The title now
  names the *type* ("Publication", "Commentaire"), the body shows the thing.
- **The reason was missing.** A report is two halves — what was posted and what
  someone says about it — and the card only carried the first. The reason is the
  only piece a report brings of itself, and the neighbouring column cuts it at
  the available width. It is already loaded on the row, so carrying it costs
  nothing.

**⚠️ The reported media did not display, and the cause was in
`fetchReportTargets()`** (Oct 2026). It kept `posts.media_url` as-is whenever it
started with `http` — and the mobile app stores a **full public URL** there
(`getPublicUrl()`, `~/ifriqiyastar/src/lib/feed.ts`). So the dossier and the
queue preview pointed at `/object/public/post-media/…` instead of going through
the repo's own resolution, which is exactly what the rule forbids since the
media buckets changed regime (mobile 0051). Publications displayed fine because
it already did it properly: `signStorageUrls()` first, `storageUrl()` as the
fallback. Both screens now read the media the same way — one batched signing
request per page, only when there is media to sign, and `storageUrl()` still
catches what signing misses, so a failed batch costs speed and never the image.

**The author column opens the account preview** (`UserCell preview`), the same
one Publications, Commentaires, Medias, Scout Days, Evaluations and Abonnements
already use, and the removals queue shows it for the moderator who proposed the
removal. This screen is where "who is this, and is the account sound?" is asked
most, and it was the one list without it. Same rule as everywhere: it shows
exactly the `ProfileSummary` fields the page already loads, so it adds no round
trip.

Two constraints decided its shape:

- **It queries nothing.** `fetchReportTargets()` already resolves all of that
  for every row of the page — it was being read, paid for, then thrown away at
  render time by a `max-w-64 truncate`. `DetailDialog` renders its children
  server-side, so the card arrives already rendered. This is exactly why
  `PostPreviewDialog` was *not* reused here: it needs a comment thread, which
  would have meant one read per row of a 200-row queue.
- **It carries no decision gesture**, deliberately. The paragraph above is still
  the rule: recognising content and judging it are two different acts, and the
  second one happens in the dossier with the evidence in view. The popup is the
  first act only.

**One filter bar for the four tabs.** There were two: a hand-rolled GET `<form>`
in the header hub for Signalements, and `FilterBar` — client component, Base UI
`Select`, applied on change — rendered *inside* the panel for the other two.
Same screen, same gesture, two components, two positions, two ways to submit.
Worse, both wrote `q`, and `SegmentedNav` carries `q` across tabs: searching
"insulte" in report *reasons* then clicking Publications filtered post *content*
on a word nobody typed there. `ModerationFilters` is now the single bar, the
`q` hand-off is stripped on this screen only (`SegmentedNav` is shared — other
screens do want it), and the `etat` options that come from 0089 are gated on one
`hasModerationColumns()` probe per render rather than being offered and failing.
Keep the `sm:grid-cols-2 xl:grid-cols-*` shape: `md` is where the 16rem rail
becomes fixed, which is what produced the 21-pixel dropdown below.

Verified: `npm run build` green, `npm test` 17 + 7, `eslint` clean on the
touched files. The `ilike` escaping was checked by building the real query and
reading the emitted URL, not by reasoning about it.

**A post now says why it is in front of you.** The list showed a state
("Masquee", "Refusee") and never its cause, while three facts existed and never
reached the screen: `moderation_reason` was selected, typed and passed to the
popup but only rendered *inside* it — so the one trace of a refusal decision
(the journal is gone, and Postgres makes the reason mandatory) required opening
each row; the reports targeting a post appeared nowhere, so a post hidden after
a report looked exactly like one hidden by hand; and a direct hide records no
reason at all, which the row now states rather than leaving as a gap.
`fetchContentReports()` reads them in one query for the page — never one per
row — and `ContentWhy` renders the band before the text on a post card and
after it in the comments table (a bordered block in a ~130 px cell would fight
the text it annotates). Nothing renders when nothing targets the row, and that
is an answer: the list is the whole feed, most rows have no reason to be looked
at.

⚠️ **The report count is the link, and that is a layout constraint, not a
preference.** A separate "Ouvrir le signalement" label measured ~150 px and was
`shrink-0`; in the comments table the text cell drops to ~122 px at 768 px —
the width where the 16rem rail becomes fixed — so it could not fit and spilled
**under the neighbouring column**, with `document.scrollWidth` unchanged. Same
invisible failure as the 21-pixel dropdown below. Measured at 375 / 768 / 1024 /
1280 / 1440 against the compiled stylesheet before and after.


## Previewing a post before deciding (Sept 2026)

Client request: the administrator should read a post **in a popup**, and be
able to delete it and act on it from there.
`components/admin/post-preview-dialog.tsx` carries it — author, status pills,
the full text in its own scrollable region, the image inline, and every gesture
in the footer: approve, reject with a reason, hide, delete. The pending queue
and the post list open the *same* dialog, built by one `previewOf()` factory,
so the two cannot drift.

- ⚠️⚠️ **A client component may not import `lib/actions/*` nor `UserCell`.**
  Both reach `lib/i18n/admin.ts`, hence `server-only` / `next/headers` /
  `next/root-params`, and the build fails with *"'server-only' cannot be
  imported from a Client Component module"*. The four Server Actions arrive
  **bound, as props** (`onApprove={approvePost.bind(null, row.id)}`), exactly
  the convention `ActionButton` already follows, and the author block is
  redrawn inline. `npm run test:i18n` guards this — its last case is
  *"client component imports never pull in request-only translation modules"*,
  and it is what caught both mistakes here.
- **Rejection is a step inside the dialog, not a second dialog.** Stacking two
  `Dialog`s works on a desktop and misbehaves the moment a keyboard or a screen
  reader is involved — the second steals focus from the first, which stays
  mounted underneath. The reason is typed in place.
- ⚠️ **`DialogFooter` defaults to `flex-col-reverse`**, which on a phone would
  have put the destructive group (hide / delete) *above* the approval group —
  the irreversible gesture first under the thumb. Overridden to `flex-col`.
- **"Delete" writes `is_deleted`; it is not a `DELETE`.** The schema has no
  admin DELETE policy on `posts`, deliberately: a removed post stays readable
  by the administration, which is what instructing a report requires.
- `next/image` with `unoptimized`: the media lives on Supabase Storage, whose
  host is not declared in `next.config.ts`, so the optimizer would 400 a
  perfectly valid image.
- **A comment's thread comes with it.** When the popup is opened from a
  comment, it also renders that post's discussion — root then replies, one
  indent level (0093 allows no more) — with the comment under moderation
  highlighted. ⚠️ **A moderator cannot judge a reply alone**: "bien joué" under
  an announcement and "bien joué" under an insult are not the same decision,
  and the list only ever showed the reply's own text. Same reasoning that made
  the post open in a popup, and it applies harder here.
  - The threads are loaded in **one query for the whole page**, and that query
    is **tolerant of failure**: `parent_comment_id` comes from 0093, so on a
    project without it the read returns `42703`. The thread then disappears and
    the page stays whole — a moderation convenience must not cost the screen.
    That is why the 0093 columns are requested separately from `COMMENT_COLUMNS`
    rather than appended to it.
  - The queue and the table also show **the parent's author and excerpt inline**,
    before the reply's own text, so the context arrives before the decision does.
- Measured from 320px to 1280px: the dialog scales from 288px to 672px with no
  child escaping its frame. (At 320px `scrollWidth` exceeds `clientWidth` by
  6px — that is the vertical scrollbar gutter of `overflow-y-auto`, which
  `clientWidth` excludes and `scrollWidth` does not. Not an overflow.)
  ⚠️ Chiffres d'origine : la popup est passee a 768 px et a une seule zone
  defilante — voir la section suivante, remesuree 375 → 1920.

## La liste des publications est un registre, la popup la surface de decision (Oct 2026)

Demande client : « on pourrait mieux montrer ces donnees, utilise la popup ».
`/admin/moderation/publications` affichait, par ligne : l'identite, les
pastilles, le bandeau de mise en cause, trois lignes de texte, un bouton
« Ouvrir le media » **et cinq boutons de decision**. Sur une page de vingt
publications, cela faisait une centaine de boutons, dont « Supprimer », pris
sur un extrait tronque — exactement ce qui avait deja ete corrige sur le
tableau des signalements, et qui avait ete reecrit ici.

| Avant | Apres |
|---|---|
| 3 lignes de texte + un bouton « Ouvrir le media » | la ligne ne porte plus de contenu du tout |
| 5 boutons par ligne, hauteur variable | un seul bouton, « Examiner », a cote des pastilles |
| popup = texte + media + fil | popup = mise en cause, contenu, media, **faits**, fil, gestes |

**La ligne ne montre plus la publication, et c'est la demande du client**
(deux allers-retours : d'abord une carte d'apercu vignette + extrait, puis son
retrait pur et simple). Elle ne dit que ce qui la **qualifie** — qui, quand,
dans quel etat, ce qui la met en cause — et le contenu se lit dans la popup.
⚠️ Ce que cela coute, et qu'il faut savoir avant de « corriger » : on ne peut
plus parcourir les textes du regard ; reperer une publication se fait par le
bandeau de mise en cause, les pastilles d'etat et la recherche plein texte,
pas en lisant la liste. `MediaThumb` a ete supprime avec l'apercu — l'image
reste dans la popup, signee par le meme chemin.

- ⚠️ **Aucun geste n'est perdu.** « Valider », « Refuser », « Masquer » et
  « Supprimer » vivent tous dans la popup, au-dessus de la publication
  complete. Le repechage d'un refus — le seul chemin de rattrapage d'un
  contenu refuse par erreur, son auteur ne pouvant que le supprimer — s'y
  trouve aussi ; il demande desormais d'ouvrir la ligne, c'est-a-dire de lire
  le motif avant de revenir dessus.
- ⚠️ **La pastille « En ligne » a disparu des deux listes** (demande client,
  Oct 2026), pour la meme raison que la trace de validation : elle etait posee
  sur presque toutes les lignes — c'est l'etat normal du fil — donc elle ne
  distinguait rien et banalisait les pastilles qui, elles, appellent un geste
  (En attente, Refusee, Masquee, Supprimee). **L'etat normal est desormais
  l'absence de pastille.** Elle n'etait d'ailleurs pas une mesure : elle se
  deduisait de `is_hidden = false`, `is_deleted = false` et
  `moderation_status = 'approuve'` — les trois conditions que le fil mobile
  filtre — et ne disait rien de l'audience. Le filtre « En ligne » du bandeau
  reste le chemin pour ne lister que ce qui est visible, et il n'a pas bouge.
- ⚠️ **La trace de validation ne remonte plus sur la ligne** (demande client,
  Oct 2026). « Validee — <date> par <compte> » s'affichait sous chaque
  publication approuvee, donc sous l'immense majorite d'entre elles : un
  bandeau pose partout ne signale plus rien, et il repoussait les deux seules
  lignes qui demandent un regard — un signalement, un refus motive. Elle n'est
  pas perdue : la popup la porte (c'est la qu'on verifie qui a tranche et
  quand) et le filtre « Validee » reste le chemin pour retrouver ce qui a ete
  approuve — ce que demandait la section « Seeing what has been validated ».
  Le filtrage se fait **a l'affichage de la ligne**, pas dans `whyLines()` :
  la popup et la liste partagent le meme calcul, et seule la liste en retire
  ce qui n'est pas une alerte. L'ecran des commentaires, lui, l'affiche
  toujours — personne ne l'a signale la-bas, et sa table se lit autrement.
- ⚠️⚠️ **Le bandeau de mise en cause manquait precisement la ou la decision se
  prend.** `ContentWhy` est un composant serveur ; la popup est un composant
  client et ne peut ni `await` le dictionnaire ni recevoir une icone. Les
  lignes sont donc construites une fois par `whyLines()` et voyagent
  **serialisees** (`kind` plutot qu'un composant d'icone) ; la liste et la
  popup dessinent la meme chose. `lib/moderation-why.ts` porte le type et les
  deux tables sorte → icone → couleur, dans un module neutre : une valeur
  importee d'un module `"use client"` par un composant serveur n'est pas la
  valeur mais une reference client, donc la dependance ne peut pas aller dans
  l'autre sens.
- **La popup dit enfin les faits** : date de depot, nature du media,
  reference. La date est **mise en forme par le serveur et passee en
  accessoire** — la formater dans le navigateur ferait dependre le rendu du
  fuseau du poste, donc diverger a l'hydratation.
- ⚠️ **Une seule zone defilante.** La popup defilait en entier *et* contenait
  deux boites a defilement interne : trois ascenseurs imbriques, et des gestes
  qui sortaient de l'ecran des qu'une publication etait longue. Entete et pied
  sont fixes, le corps seul defile (`grid-rows-[auto_minmax(0,1fr)_auto]` +
  `min-h-0`). Seul le fil de discussion garde sa boite — c'est un bloc
  secondaire.
- ⚠️⚠️ **Un libelle pose sous l'extrait se lit comme une suite du texte.**
  Etape intermediaire, gardee ici parce qu'elle se reproduira : la ligne
  entiere etait le declencheur, avec « Lire et decider » sous l'extrait.
  Signale par le client sur un cas qui le montre d'un coup — « scoot day
  aujourd hui !! » puis, juste dessous et dans la meme colonne, « Lire et
  decider » : rien ne disait que l'un etait la publication et l'autre une
  commande. Une commande est un **bouton nomme**, jamais une ligne de texte
  posee dans la colonne du contenu.
- ⚠️ **Le declencheur est un `<button>` du DOM, pas le composant `Button`.**
  `PostPreviewDialog` le clone pour y poser `data-slot` et Base UI le compose
  via `render` : un composant serveur a cette place recevrait les proprietes et
  les jetterait, et la popup ne s'ouvrirait jamais. Il porte les classes de
  `buttonVariants` pour avoir l'allure des autres boutons sans en etre un, et
  il est ecrit **une fois** pour la file d'attente et pour la liste.
- **Le bouton vit avec les pastilles d'etat**, dans le meme `flex-wrap` a
  droite de l'identite : sous 1024 px le groupe passe a la ligne entier plutot
  que d'ecraser l'identite, qui garde 234 px partout.
- ⚠️ **Les vignettes sont signees en une demande pour la page entiere.**
  `post-media` est prive (mobile 0051) : sans cela, vingt lignes auraient fait
  vingt detours par `/admin/documents`, chacun refaisant un controle
  d'administration et une signature — toutes les 30 s, puisque `AutoRefresh`
  rejoue la page. `signStorageUrls()` (`lib/queries/signed-media.ts`) est la
  generalisation de `signAvatarUrls()`, qui n'en est plus qu'une
  specialisation : **une seule implementation**, un seul cache, et sa cle
  porte le bucket — sans quoi un meme chemin servirait l'URL d'un autre bucket,
  donc une image qui ne repond pas. Ce que la signature ne couvre pas (adresse
  externe, echec) retombe sur `storageUrl()`.
- `tests/signed-media.test.cjs` — 5 assertions, **verifiees par mutation** :
  retirer le bucket de la cle de cache fait tomber le temoin des deux buckets.

**Mesure 375 → 1920 contre la feuille compilee**, dans une coque reproduisant
le rail de 16rem (recette ci-dessous). Deux defauts trouves et corriges, tous
deux invisibles a `document.scrollWidth` :

- ⚠️⚠️ **`line-clamp-2 block` n'ecrete rien.** `line-clamp-*` pose
  `display:-webkit-box` ; `block` est du **meme groupe** pour tailwind-merge et
  l'ecrasait. Mesure : l'extrait faisait 159 px de haut (sept lignes) a 375 px
  au lieu de 46. La classe se suffit a elle-meme.
- ⚠️ **Une colonne de grille `auto` ne descend pas sous la largeur minimale de
  son contenu.** La popup debordait de 3 px a 375 px — une barre de defilement
  horizontale dans une fenetre modale. `grid-cols-1`, soit
  `repeat(1, minmax(0,1fr))`, la laisse retrecir. Meme mecanisme que les
  `grid-cols-*` du bandeau de filtres, dans l'autre sens.

Aux six largeurs, etat final : `scrollWidth === clientWidth` sur la page comme
dans la popup, ligne a 108 px au-dessus de 1024 px (164-180 px en dessous,
quand pastilles et bouton se replient), identite et bouton jamais rabotes,
pied de popup toujours visible et corps qui defile quand il le faut.
⚠️ Le sondeur signale aussi `scrollWidth > clientWidth` sur les elements
`truncate` : c'est **le fonctionnement de la troncature**, pas un debordement —
ne pas le corriger.

## Les commentaires suivent la meme regle (Oct 2026)

« Do the same for commentaire ». `/admin/moderation/commentaires` etait un
tableau de cinq colonnes portant le commentaire entier, son parent, le bandeau
de mise en cause **et quatre boutons de decision par ligne**. Il est devenu la
meme liste que les publications : identite, etat, bouton « Examiner », bandeau
dessous — et tout le reste dans la popup.

⚠️⚠️ **La popup ouverte depuis cet ecran moderait la PUBLICATION, pas le
commentaire.** « Valider », « Masquer », « Supprimer » y agissaient sur le
billet ; les gestes du commentaire, eux, vivaient sur la ligne — donc pris sur
un texte tronque, sans le fil, ce que la popup existe precisement pour eviter.
`PostPreviewDialog` accepte desormais un **sujet** : `comment ?? post`.
L'entete, les pastilles, les faits et les quatre gestes suivent le sujet ;
quand c'est un commentaire, la publication devient le **contexte** (libelle
« Sous la publication de X », cadre plus sourd) et le fil garde son
surlignage.

- ⚠️ **`post` est devenu facultatif.** Un commentaire dont la publication est
  introuvable doit rester moderable ; la popup le dit au lieu de ne pas
  s'ouvrir. Si ni l'un ni l'autre n'est fourni, elle ne rend rien — un
  declencheur qui ouvre une fenetre vide fait douter de tout l'ecran.
- **La nature du media disparait des faits pour un commentaire** : 0093 n'en
  attache aucun, et afficher « Aucun » sur toutes les lignes serait du bruit.
- **Le tableau est devenu une liste**, ce qui regle au passage la cellule de
  commentaire qui tombait a ~130 px a 768 px — le point ou le rail de 16rem
  devient fixe — et y ecrasait a la fois le texte et le bandeau.
- Mesure 375 → 1920 de la popup en mode commentaire : `scrollWidth ===
  clientWidth`, « En reponse a » et « Sous la publication de X » jamais
  rabotes, pied visible partout, corps qui defile a 375 px.
- **Ce que l'ecran ne fait plus** : moderer la publication parente depuis la
  liste des commentaires. C'est l'ecran des publications qui porte ce geste, et
  l'ambiguite — quatre boutons dont on ne savait pas sur quoi ils portaient —
  etait le defaut corrige ici.

