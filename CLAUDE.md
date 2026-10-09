# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server (Turbopack) on :3000
npm run build    # production build — also the only type-check in this repo
npm run lint     # eslint, flat config; no path needed (defaults to the cwd)
```

There is no test runner configured. `npm run build` type-checks the whole
project, so a build failure is usually a type error — treat it as the test suite.

## What this repo is

The **administrator back-office** (§12 of the client's cahier des charges) for
Ifriqiya Star, a football player/recruiter marketplace — plus, since the landing
page was added, the **public site** at `/`. `/admin` still redirects to
`/connexion` unless the session belongs to an admin; `/` is now a static
marketing page and no longer redirects.

The landing page follows the client's **charte graphique** (Wii Studio, August
2026, `~/Downloads/ifriqiya/guideline is_compressed_260819_104412.pdf`) and only
it: four colors — `#000000`, `#aff70f`, `#CCCCCC`, `#FFFFFF` — Nunito Sans for
headings, Poppins for body. Its palette lives in the `.site-shell` block of
`app/globals.css`, scoped exactly like `.admin-dashboard-shell`, so a marketing
tweak never repaints an admin screen. Its copy (services, mission, vision, the
five values, the slogan) is taken verbatim from the charte's "Marque" plate, and
its phone mockups are real screenshots of the mobile app in
`public/app/<langue>/`.
It carries **no audience figures and no testimonials** — inventing either on a
public page manufactures evidence.

**Scout Days are the page's second gesture** (client request, Oct 2026, after
comparing with ifreq.io, which leads with its detection event). A dedicated
`#scout-days` section sits right under the hero — organisation, eligibility,
the day, the six-axis evaluation — followed by the video rail; the
header, the drawer, the footer and the first carousel slide point at it (a
hero button did too, and was removed at the client's request).
⚠️ It is **explanatory, with no dates**: `anon` cannot read `scout_days`
(`42501` on `is_admin`), and listing real events publicly needs both a
`security definer` read exposing only safe columns and the client's consent on
what to show (organiser, price). Its six axes must follow `lib/evaluation-axes.ts`.
The hero carries a kicker ("La plateforme de scouting du football africain")
and, from `xl` only, `ScoutingShowcase`: our answer to the competitor's
"Scouting Card", in frosted glass over the hero video (client's reference, Oct
2026) — a player card in the middle, three `.site-glass` panels overlapping it
(overall gauge, "Profil vérifié", six-axis radar; a "Progression" sparkline
was removed at the client's request). The player is
**Yassine**, the fictitious testimonial character, with **his** profile from
`PRISM_PLAYERS[0]` — one face, one identity, one radar on the page. ⚠️ Those
scores are **invented on
purpose and labelled "Exemple" on the card**; the overall is their mean, like
`overall_score`. Never drop that pill, and never swap in a real player's
scores without consent. ⚠️ Keep `opacity` < 1 off the glass's ancestors at
rest: it becomes the `backdrop-filter` root and the blur stops seeing the
video. The card is centred with `mx-auto`, not `-translate-*`, because
Tailwind v4 writes those to `translate`, which the panels' staggered entrance
uses.
The Scout Days section shows `ScoutDaysPrism` instead of app screenshots: six
player cards turning in 3D (CSS only, modelled on the client's Mojo Fantasy
reference). Each card shows a player's name and role, then a six-axis
**radar** (`RadarChart`) of an invented profile with **no figures**. The people
are the three fictitious testimonial characters — Yassine, Karim, and Mehdi the
coach (added at the client's request, keeping his coach role) — and name and
role are read from `testimonials.items` so one face never carries two
identities on the page. Order Y-K-M twice: the three visible cards are always
three different people. Their photos are the AI portraits plus the "Pourquoi"
training shot — `carousel-dribble.jpg` shows a real club's player and must
never carry a score. The ring copies the reference video: spaced
cards (14.5 × 28rem), each with a dark **back** carrying the logo and the
brand name, the ring tilted forward so the backs of the
cards that went round show through the gaps, lower than the front card; thin
rims, no glow. ⚠️ Keep nothing but cards in that 3D scene. A central "core"
was tried (it was a misreading of those backs) and Chrome split each card along
the core panels' extended planes and dropped fragments — black bands across the
front card, measured with and without it.

**The mockups are translated, and the folder is the language.** The app speaks
the site's three languages, so `public/app/` holds one complete set per locale
(`fr`, `en`, `ar`) under identical file names, and `lib/app-screens.ts` resolves
`appScreen(locale, name)` rather than exporting a constant. A French capture
under Arabic copy does not show the product the visitor would download, and on
`/ar` it also runs against the page's own `dir="rtl"`. Adding a language is a
folder to drop in and nothing else. Two consequences: a client component that
shows a capture must read `locale` from `useI18n()` (`steps-time-machine.tsx`
does), and a Server Component must thread it down as a prop — `Fonctionnalites`
and `AppelFinal` take `locale` beside `dict` for that reason. The names describe
the *screen*, not the section that shows it, so two sections can point at the
same file.

⚠️ The September 2026 set is **413 px wide at the source** — an emulator in a
reduced window, not the device resolution. Past roughly 205 CSS px a
high-density screen asks for pixels that do not exist; the page shows them
larger because the layout requires it, and the only real fix is to recapture
(`adb exec-out screencap -p`). The figure is written in three places that must
agree: the header of `lib/app-screens.ts`, the `Phone` comment in
`components/site/pieces.tsx`, and the `Stack` comment in
`steps-time-machine.tsx`.

**The 404 page is served by `app/global-not-found.tsx`, and that is not a
stylistic choice.** Next only serves a global 404 from `app/not-found.tsx`,
which must render inside a *root layout* — and this repo's root layout is a
top-level dynamic segment (`app/[locale]/layout.tsx`), exactly the case its own
docs hand over to `global-not-found.js`. With `app/[locale]/not-found.tsx`
alone the response was a correct 404 wrapped in a bare `<html
id="__next_error__">` document: empty body server-side, no `dir="rtl"` in
Arabic, no `dark` class, no brand fonts — everything arrived only in the RSC
payload and was painted after hydration. That is still what happens for any
`notFound()` thrown inside the tree (the admin dossiers, `getLocale()` on an
unknown locale), and it is why `app/[locale]/admin/[...reste]/page.tsx` exists:
a mistyped admin URL is more useful inside the admin shell — behind
`requireAdmin()` — than on a marketing page, and the back-office is an
authenticated JavaScript screen where a hydration-time paint costs nothing.
Three consequences worth knowing before touching it:
`experimental.globalNotFound` must stay on in `next.config.ts` or the file is
ignored silently; `global-not-found.tsx` bypasses the layout, so it imports
`globals.css` and `lib/fonts.ts` itself and writes its own `<html>` — which is
why the fonts were extracted there rather than declared twice; and the locale
cannot come from the URL (it is the wrong URL) nor from `next/root-params` (no
segment), so `proxy.ts` passes the one it already resolved through
`SITE_LOCALE_HEADER`, deleted before being set like `ADMIN_LOCALE_HEADER`. The
priority order stays the proxy's own — URL prefix, then cookie, then
`Accept-Language` — so `/ar/adresse-fausse` answers in Arabic. The page itself
lives in `components/site/not-found-view.tsx` and takes `dict`/`locale` as
props, because its two callers resolve them differently; `SiteFooter` gained
the same optional props for that reason. Paths ending in an extension keep
Next's bare 404: `proxy.ts` short-circuits them as static files, and a missing
`.png` has no use for a marketing page.

Next.js 16 App Router · React 19 · Tailwind v4 · shadcn/ui (`base-sera` style,
built on **Base UI**, not Radix) · `@supabase/ssr`.

`README.md` maps each screen to the cahier des charges section it covers, and
documents the env vars and the "create the first admin" SQL. Read it before
adding a screen.

## The database lives in the mobile repo

This app talks to **the same Supabase project as the Expo mobile app at
`~/ifriqiyastar`** — same `auth.users`, same tables, same RLS policies.

- **Schema source of truth**: `~/ifriqiyastar/00_ALL_IN_ONE.sql` plus the
  numbered migrations (`0015_player_photos.sql` … `0018_player_search.sql`).
- **Product spec, enum semantics, onboarding state machine**:
  `~/ifriqiyastar/CLAUDE.md`.

`supabase/migrations/` here holds **only back-office-specific additions** — the
RBAC tables (`202608240001_admin_platform.sql`) and the admin INSERT policies
for `scout_days` / `scout_evaluations` (`202608240002`). Never redefine mobile
tables here. Anything added must be idempotent (`create … if not exists`,
`drop policy if exists`), because Supabase's SQL editor wraps the whole script
in one transaction and a single collision rolls everything back.

Verify against the live database before writing a query — the SQL file has
diverged at least once. An unauthenticated PostgREST probe with the publishable
key is enough: RLS returns `[]` for a valid column and
`42703 column … does not exist` for an invalid one.

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/<table>?select=<cols>&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

Known divergence: **`public.profiles` has no `avatar_url` column** despite
`00_ALL_IN_ONE.sql` declaring one. The photo lives on the business tables —
`player_profiles.profile_photo_url` and, since mobile migration `0039`,
`professional_profiles.photo_url` (same public `avatars` bucket) — and
`fetchProfilesByIds()` merges whichever applies as `avatar_url`, so a player and
a professional both get a thumbnail and only an admin has none. Both photo
lookups are queried apart from the identities on purpose: an un-applied `0039`
answers `42703`, and isolated it costs the row its thumbnail rather than its
whole line. `PROFILE_COLUMNS` in `lib/queries/profiles.ts` is the verified
column list; select through it.

## Authorization — four layers

Every one of them matters; don't collapse them.

1. `proxy.ts` at the repo root. In Next 16 middleware is **renamed Proxy** and
   the file must be `proxy.ts`. It only refreshes the Supabase token and rewrites
   cookies — it does no authorization, per Next's own guidance.
2. `requireAdmin()` in `lib/auth.ts`, called by `app/admin/layout.tsx` **and by
   every Server Action**. Server Actions are reachable by direct POST without
   passing through the UI, so the layout guard alone is not enough. It also
   handles the orphaned-session case (a valid JWT whose `profiles` row was
   deleted by hand) and the deactivated-admin case.
3. `requirePermission(perm)` — fine-grained RBAC on top, backed by the
   `admin_has_permission` RPC. `AdminPermission` in `lib/auth.ts` is the
   canonical list — note `events.validate`, held by `super_admin` alone,
   sitting beside the broader `events.manage`, and `content.validate`, which
   does the same for feed posts and comments beside the broader
   `moderation.manage`; `getAdminAccess()` resolves a role label plus permissions for
   the nav, and `components/admin/nav-items.ts` tags each section with the
   permission that reveals it. **Both degrade open on purpose**: if the RBAC
   migration is not applied (`PGRST202` / missing function, or no
   `admin_user_roles` table), any `profiles.role = 'admin'` keeps full access.
   Keep that fallback when touching this code — it is what lets the app run
   against an un-migrated project. **`getAdminAccess()` must degrade the same
   way**, and now does: it adds any `AdminPermission` missing from
   `admin_permissions` to the returned list. When the two disagreed, the
   Scout Day "Valider / Publier" button vanished from the screen while the
   Server Action would have accepted the call — leaving "Cloturer" as the only
   visible gesture on an event awaiting validation, which sent it to a state
   players never see. A permission gate that hides a button is only safe if it
   answers exactly like the one that guards the action.
4. Postgres RLS. `public.is_admin()` reads `profiles.role`, and the mobile
   schema already grants admins full access via that function. It has the last
   word.

Every mutation still calls `logAdminAction()` (`lib/auth.ts`), which wraps the
`log_admin_action` RPC. **The journal screen and its table were removed on the
client's request** (mobile migration `0045`); the calls are deliberately kept in
place so the journal refills by itself if it ever comes back, and
`logAdminAction()` now returns silently when the table or RPC is absent
(`42P01` / `PGRST202`). It never fails the business action.

### Feed posts and comments need super-admin approval (Sept 2026)

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

### ⚠️⚠️ No media bucket is public any more (Sept 2026)

Reported as three separate bugs — the preview popup showed no image, "Ouvrir le
media" led nowhere, and no player or professional photo appeared anywhere in
the back-office. **One cause**: the whole admin built `/object/public/...` URLs
for buckets that migration mobile `0051` made private.

Probed against the live project, and the method matters as much as the result:

```
GET  /storage/v1/object/public/avatars/__probe__  -> NoSuchBucket
POST /storage/v1/object/sign/avatars/__probe__    -> permission denied for function is_admin
```

⚠️ **`NoSuchBucket` on the public route does NOT distinguish "absent" from
"private"** — it is the *sign* probe that settles it: a Postgres/RLS error
means Storage reached the database, so the bucket exists and is private.
`avatars`, `post-media`, `player-videos` and `player-photos` are all four
private. `blog-media` answered `NoSuchKey`, i.e. it exists **and is still
public** — it belongs to the website, and nothing here routes it differently.

The fix, in `lib/supabase/config.ts`:

- `storagePathOf(bucket, value)` normalises what the database actually holds.
  ⚠️ **The columns are not homogeneous, and that is a mobile-side divergence,
  not a choice**: `player_profiles.profile_photo_url` and
  `professional_profiles.photo_url` hold a **complete public URL**, while
  `posts.media_url` and `player_videos.storage_path` hold sometimes a path and
  sometimes a URL. Both shapes are accepted; a stale signed URL has its token
  stripped and is re-signed; `dummy/photo/url.jpg` (the pre-upload sentinel,
  the same one the five mobile SQL functions exclude with `like 'http%'`)
  yields null instead of a guaranteed 404; and an **external** address — a
  YouTube thumbnail — is returned untouched rather than swallowed.
- `storageUrl(bucket, value)` returns the `/admin/documents` URL, the route
  that already signs private buckets with the admin session and redirects.
  `avatars`, `post-media` and `player-videos` were added to its allow-list.

⚠️ **Avatars are signed at the source, in `accountAvatarUrl()`
(`lib/queries/profiles.ts`), and every reader must go through it.** `avatar_url`
feeds roughly twenty `<UserCell>` call sites; **three** different files were
computing it (`fetchProfilesByIds`, `lib/queries/users.ts`, and the
`utilisateurs/[id]` page), which is three places to fix and three to forget.
They are now one function.

- **Cost, accepted**: one redirect per image, each re-running the admin check
  and a signing round-trip. Fine for a back-office, and it is the mechanism
  already used for identity documents — but not a path for a public page.
- **Except on `/admin/utilisateurs` (Oct 2026)**, where 25 rows meant 25 of
  those detours per load. `signAvatarUrls()` (`lib/queries/profiles.ts`) signs
  the whole page in **one** `createSignedUrls` call and the `<img>` points
  straight at Storage; `accountAvatarUrl()` stays the fallback for whatever it
  did not cover (external URL, sentinel, signing failure). ⚠️ The signed URLs
  are **cached in memory** and reused while ≥ 15 min of their hour remain: a
  signature carries a fresh token every call, and `AutoRefresh` replays the
  page every 30 s, so without the cache every `src` would change and the
  browser would re-download every thumbnail twice a minute. The export route
  passes `signAvatars: false` — it shows no image. `fetchProfilesByIds(ids,
  { signAvatars: true })` offers the same thing to any screen; `/admin/scout-days`
  uses it. It is **off by default** on purpose: one extra round trip only pays
  for itself on a list of thumbnails.
- `/admin/scout-days` also ran its six reads one after another and filtered
  `q` in JavaScript over the already-paginated page (the moderation bug again).
  The reads now go out together in one `Promise.all`, and the search is an
  `ilike` inside the query through `orLikeTerm()`.
- ⚠️ **In the popup the image is a plain `<img>`, not `next/image`.** The
  source is a route that **redirects**; Next's optimizer would try to fetch the
  original itself, from a host not declared in `next.config.ts`, and 400 a
  perfectly valid image.
- `tests/storage-url.test.cjs` transpiles the real `config.ts` and runs it —
  10 assertions, including a non-null witness and **verified by mutation**
  (putting `publicStorageUrl` back makes it fail 1/10). `npm test` runs both
  suites.

⚠️ **One thing this does not settle.** The probe above ran as `anon`, and
`permission denied for function is_admin` is the 0082 failure documented in the
mobile repo: one non-executable function poisons reads of *every* bucket,
because Postgres OR-expands all permissive policies on `storage.objects`. For
`anon` that refusal is intended (0070/0071 closed it deliberately). Whether
**`authenticated`** — which is what the back-office actually uses — hits the
same wall could not be measured without an admin session. If images still do
not appear after this change, that is the next thing to check: paste
`scripts/health-check.sql` from the mobile repo and read control n° 4, then
apply `0082_storage_policy_execute.sql`.

### The selectable queues run full width (Sept 2026)

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

### Validations is four routes too, and validated content is findable again (Sept 2026)

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

#### La pastille dit *ou*, et la file montre enfin ce qui est tranche (Oct 2026)

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

### Seeing what has been validated (Sept 2026)

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

### Moderation is four routes, and the rail carries them (Sept 2026)

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

### The moderation queue: search, priority and where decisions are taken (Sept 2026)

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

### The moderation search bar, and the 21-pixel dropdown (Sept 2026)

Reported as "the search bar isn't responsive". It is the **Signalements**
filter form in `app/[locale]/admin/moderation/page.tsx`, and the failure was
measured in a headless Chrome against the app's own compiled CSS:

| viewport | `<select>` width before | after |
|---|---|---|
| 768px | **21px / 30px** | 138px / 146px |
| 1024px | 83px / 92px | 262px / 270px |

⚠️ **The cause is that `md` (768px) is also where the 16rem rail becomes
`fixed`.** The content area drops from 608px to 480px at the exact breakpoint
where the form splits into twelve columns — and media queries read the
**viewport**, not the container, so `md:col-span-3` believed it had 768px to
share. The grid now goes `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`, and both
the label and the `<select>` carry `min-w-0`.

⚠️⚠️ **This class of bug does not show up as horizontal scrolling, which is
why looking for overflow finds nothing.** Tailwind's `grid-cols-*` is
`repeat(n, minmax(0, 1fr))`: the tracks *shrink below their content* instead of
overflowing. The symptom is a crushed control, and `document.scrollWidth` stays
equal to `clientWidth` throughout. Measure the **rendered width of the input
and the select**, not the overflow.

**`FilterBar` was measured too and left alone** — with three filters (the
Finances worst case) its input never drops below 186px and no value is clipped,
at any width from 320 to 1280. Do not "fix" it.

#### How to re-run that measurement

It costs ten minutes and it is the only thing that settles this kind of report.
The recipe, which also documents two traps paid for here:

1. `npm run build`, then take the **largest** `.next/static/chunks/*.css` — that
   is the app's real compiled Tailwind, not an approximation.
2. Build a static page with the component's exact class strings, **inside a
   shell that reproduces the 16rem rail** (`display:none` below 768px, then
   `flex: 0 0 16rem`) and `main`'s `p-3 sm:p-4 lg:p-5`. Without the rail the
   form measures fine at every width and the bug is invisible.
3. Drive Chrome from `~/.cache/puppeteer` over CDP and set the viewport with
   `Emulation.setDeviceMetricsOverride`. ⚠️ **`--dump-dom` in the historic
   headless mode reports a viewport of 0 and lays the page out at 200px**, so
   `sm:` / `lg:` never fire and every conclusion drawn from it is wrong.
4. ⚠️ **Do not let the probe write into the page.** A first attempt appended a
   one-line `<pre>` (`white-space: pre`) to read the result, and *that* widened
   the document to 874px at every width — a number I very nearly diagnosed as
   the bug. The control that would have caught it immediately, an empty page
   with the same CSS **and the same probe**, was not equivalent: it had no
   probe. A witness must differ from the subject by one thing only.
5. ⚠️ When simulating `cn()` by hand, remember it is **tailwind-merge**: writing
   `sm:max-w-md sm:max-w-2xl` in a harness measures whichever the stylesheet
   orders last, not what the component renders.

### Previewing a post before deciding (Sept 2026)

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

### La liste des publications est un registre, la popup la surface de decision (Oct 2026)

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

### Les commentaires suivent la meme regle (Oct 2026)

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

### The sign-in screen must send a captcha token

Supabase Auth's **CAPTCHA protection** (Authentication -> Attack Protection,
Cloudflare Turnstile) was turned on for the shared project on 2026-09-17 at the
client's request, for the mobile app. **That setting is project-wide**: it
applies to every GoTrue entry point at once, so `/connexion` here must send
`options.captchaToken` exactly like `~/ifriqiyastar/src/app/(auth)/sign-in.tsx`
does -- without it Supabase answers `captcha protection: request disallowed (no
captcha_token found)` and nobody can sign in to the back-office at all.

`components/captcha.tsx` holds `CAPTCHA_ENABLED`, `useCaptcha()` and
`<Captcha />`, mirroring the mobile component (web needs no WebView: the page
has a real origin, so the script is loaded directly). Three things about it:

- **The token proves nothing by itself.** GoTrue exchanges it against the
  **secret** key, which lives only in the Supabase dashboard. Removing the
  widget does not "unlock" anything -- it makes sign-in impossible.
- **A token is single-use.** Cloudflare marks it consumed as soon as GoTrue has
  verified it, so reusing one makes *every* later attempt fail -- which reads as
  an app outage when the password was simply wrong the first time. Hence
  `captcha.reset()` on **all** exit paths of a submit, refusals included.
- **The hostname must be declared on the key** (Cloudflare -> Turnstile -> the
  widget -> Hostname Management), or the widget refuses to load with `110200` --
  `localhost` for development, plus the deployed domain. That is a dashboard
  line, not a JS fix, which is why the console logs the origin the page actually
  declared next to the code.

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is the public key (the same one the mobile app
uses). Its absence disables the widget client-side only, so a workstation
without a full `.env` still builds -- but sign-in would then be refused by the
server.

### Resetting a password

Same mechanism as the mobile app (`~/ifriqiyastar/src/lib/password-reset.ts`),
ported to `lib/password-reset.ts`: **a six-digit code, never a link** — the
e-mail template is shared by both apps (one Supabase project, one template) and
the mobile app has no site a link could return to. The module takes the
Supabase client as an argument precisely because it has two callers with two
different clients.

`/connexion/mot-de-passe-oublie` is one screen in three steps (address, code,
new password) and a **sub-route of `/connexion`** on purpose: `isAdminPath()`
already covers `/connexion/...`, so it inherits the back-office language rule
without touching the proxy. `AuthShell` is the decor both screens share. Three
things not to undo: the code is *consumed* by `verifyOtp`, so a step that has
been passed cannot be replayed (hence local state, not three routes); the
session `verifyOtp` opens is **signed out** after the write, because it never
passed `requireAdmin()`; and a captcha token is single-use, so `captcha.reset()`
runs on every exit path of a send, refusals included.

The super-admin gesture on `/admin/utilisateurs/[id]` (`sendPasswordReset()`)
triggers the *same* e-mail to the account's address — it never chooses or
reveals a password. **It goes through `service_role`, which is the whole point
of the action**: the project's captcha protection covers `/recover`, a server
has no challenge to solve, and GoTrue only exempts calls carrying admin
credentials (verified against the shared project: publishable key -> `400
captcha_failed`, `service_role` -> `200`). That is the one gate in this
back-office with **no Postgres behind it**, which is why `isSuperAdmin()`
refuses by default and only degrades open when `is_super_admin()` itself is
missing from the project.

### The pending Scout Day alert (Oct 2026)

Client request: a Scout Day submitted by a professional waits for a super admin,
and a line in the bell was too easy to overlook — a forgotten event is a
detection day announced too late to players. `ScoutDayAlert`
(`components/admin/scout-day-alert.tsx`), mounted in the admin layout, opens a
dialog by itself on **every** admin page listing what waits, newest first, with
how long each has waited (amber past 4 h, red past 24 h), "Examiner" and
"Valider et publier".

- **Only for `events.validate`** — the exact permission `validateScoutDay`
  requires, so the button never shows to someone the action would refuse. The
  layout does not even read the list otherwise (`fetchPendingScoutDays()`,
  `lib/queries/scout-day-alert.ts`, tolerant: an error yields no alert rather
  than a broken back-office on every page).
- **The snooze is the feature.** Closing never dismisses: the admin picks
  30 min or 1 h, and closing without choosing (cross, Escape, overlay)
  means 15 min (client request, Oct 2026). The snooze also stores **which ids were seen**: a Scout Day
  submitted meanwhile reopens the alert at once. It lives in `localStorage`
  per account, like the bell's seen state — a per-device convenience; the
  Scout Days queue page remains the real safeguard.
- **It never opens over another dialog** (a form being typed must not be cut
  off) and decides only inside timers, never during render, so the server HTML
  never carries an open dialog and nothing differs at hydration.
- `validateScoutDay` arrives **as a prop** from the layout — a client component
  may not import `lib/actions/*` — and the shared type/limit live in
  `lib/scout-day-alert.ts`, which imports nothing, for the same reason.
- Refusal stays on the Scout Day page: it needs a written reason, which is the
  only explanation the organiser receives.
- **A chime plays when the alert opens** (not on every tick while it stays
  open): a rising C-E-G, twice, generated with Web Audio — no audio file. ⚠️
  Browsers block any sound until the page has had a click or a key press, so the
  audio context is created or resumed on the first gesture and the chime is
  skipped while it is not running: right after a reload the alert opens silent.
  "Son active / coupe" in the footer mutes it, per account in `localStorage`.

### Le preavis minimum d'un Scout Day (Oct 2026)

Demande client : un professionnel deposait un Scout Day pour le lendemain,
l'evenement sortait de la file de validation quelques heures avant, et aucun
joueur n'avait le temps de le voir. Le super administrateur fixe desormais un
nombre de jours — « au moins 7 jours avant » — sur `/admin/scout-days`.

| Fichier | Role |
|---|---|
| `supabase/migrations/202610070001_scout_day_min_notice.sql` | `platform_settings` + le trigger qui applique la regle |
| `lib/platform-settings.ts` | les bornes (0–365), pures, lisibles d'un composant client |
| `lib/queries/platform-settings.ts` · `lib/actions/platform-settings.ts` | lecture toleree, ecriture gardee |
| `components/admin/scout-day-notice-form.tsx` | le champ, sur l'ecran des Scout Days |

- ⚠️⚠️ **La regle est un trigger *supplementaire*, pas une retouche de
  `enforce_scout_day_validation()`** (migration mobile 0040). Reecrire une
  fonction du depot mobile depuis ici la perdrait en silence le jour ou 0040
  est rejoue.
- ⚠️⚠️ **Le nom du trigger est l'ordre d'execution.** Postgres classe les
  triggers d'un meme evenement par ordre alphabetique, et c'est
  `trg_enforce_scout_day_validation` qui bascule le brouillon d'un organisateur
  en `en_attente_validation` (la soumission est automatique depuis 0040, il n'y
  a pas de bouton). Un trigger nomme `trg_check_...` serait passe **avant**
  cette bascule et n'aurait vu qu'un brouillon : la regle n'aurait filtre
  personne. `trg_scout_day_min_notice` trie apres, donc lit le statut bascule.
- ⚠️ **L'administration est exempte, et c'est la voie de derogation.** La regle
  ne se declenche que pour `organizer_id = auth.uid()`. Sinon un evenement
  soumis dix jours a l'avance et valide la veille serait refuse **au moment de
  la validation** : le super administrateur se verrait interdire de publier ce
  qu'il vient d'accepter.
- ⚠️ **Elle ne mord que sur un geste qui la concerne** : entrer dans la file,
  ou deplacer la date. Corriger le titre d'un evenement imminent deja soumis
  reste possible — sans quoi un organisateur pris par la regle ne pourrait
  plus rien corriger du tout.
- ⚠️ **La lecture du reglage est ouverte a tout compte authentifie, et c'est le
  point.** Le professionnel est l'assujetti : sans pouvoir lire la valeur,
  l'application mobile ne peut ni grisier les dates interdites ni expliquer le
  refus, et il decouvre la contrainte par une erreur. L'ecriture, elle, demande
  `is_super_admin()` cote Postgres **et** `events.validate` cote action — les
  deux gardes repondent pareil, comme pour « Valider / Publier ».
- ⚠️ **`.select("id")` apres l'ecriture, encore.** Mesure sur un Postgres
  jetable : un `update` par un compte non super administrateur **reussit sans
  rien changer** (la RLS filtre la ligne). L'upsert, lui, leve bien `42501` —
  c'est la clause `with check` de la policy d'insertion qui parle en premier —
  et l'action nomme alors le role manquant plutot que de laisser
  `describeError()` parler d'une policy absente.
- Le defaut est **7 jours**, applique des que la migration tourne. Le reglage
  est visible en haut de `/admin/scout-days`, jamais une regle muette ; 0
  la desactive.
- **Ce que ce depot ne peut pas faire** : l'application mobile affiche le refus
  tel que Postgres le redige (message accentue, `hint = 'scout_day_min_notice'`,
  meme convention que `past_event_date`). Griser les dates interdites dans son
  formulaire demande une passe dans `~/ifriqiyastar`, qui lit desormais
  `platform_settings.scout_day_min_notice_days`.

Verifie sur un Postgres jetable (fixture reproduisant 0028/0040), migration
rejouee deux fois : 23 assertions — refus a J+1 et J+6, acceptation a J+7
(borne exacte), exemption de l'administration a la creation et a la
publication, renommage d'un evenement imminent accepte, redatation vers une
date proche refusee, correction d'un brouillon refuse re-soumise et verifiee,
preavis a 0 qui laisse tout passer, preavis a 2 qui refuse J+1 et accepte J+2,
`past_event_date` toujours actif, borne >365 refusee par la contrainte, et
l'ecriture du reglage refusee au professionnel — y compris le temoin du
« succes a zero ligne » cite plus haut.

### An administrator's own profile — `/admin/profil` (Oct 2026)

Reached from the rail's account menu ("Mon profil"), open to every admin with
no permission: it is one's own account, not a management screen.

- **Name and phone** go through `updateOwnProfile()` (`lib/actions/profile.ts`),
  the admin session, and `.select("id")`. Those two (plus `locale`) are the only
  `profiles` columns an account may write itself — mobile `0025` revoked table
  `update` and granted it back column by column.
- **Password** (`components/admin/profile/password-change-form.tsx`) is changed
  in the browser with `updateUser({ password })`, after checking the current one
  by **signing in again**, exactly like mobile `delete-account.tsx`: the
  project's captcha protection leaves no other check, hence the Turnstile widget
  on that form and `captcha.reset()` on every exit. ⚠️ `signInWithPassword()`
  replaces the session, so the e-mail is read from the open session (never
  typed) and the returned user id is compared with the previous one. The
  "password changed" e-mail is sent by mobile `0063`'s trigger, not from here.
- **E-mail** (`email-change-form.tsx`) is `updateUser({ email })`: nothing
  changes until the confirmation link is followed (from both addresses if
  "Secure email change" is on). The page shows the pending address from
  `auth.users.new_email`. ⚠️ **`profiles.email` does not follow by itself** —
  `202610060001_sync_profile_email.sql` adds the trigger; until it is applied the
  rail and header keep showing the old address. Its exception handler is
  load-bearing: it runs inside GoTrue's transaction, and an uncaught error would
  cancel the address change itself (same reasoning as mobile `0063`). Applied
  on the shared project on 2026-10-06 (reported by the client); it was not
  replayed against a throwaway Postgres first — no `psql`/Docker on the machine
  that wrote it. The "Change Email Address" template was switched the same day
  to one e-mail carrying French, English and Arabic: the template cannot pick a
  language, because nothing writes the locale into `user_metadata`.
- Not on the page, on purpose: a photo (no column or storage for admins), the
  role (SQL, `202608240006`), the language (`/admin/parametres`).

### Supabase clients

- `lib/supabase/client.ts` — browser (sign-in / sign-out only).
- `lib/supabase/server.ts` — Server Components, Server Actions, Route Handlers.
  `cookies()` is async in Next ≥ 15; writes throw during Server Component render
  and are deliberately swallowed (the proxy already refreshed the token).
- `lib/supabase/service.ts` — `service_role` client, returns `null` when
  `SUPABASE_SERVICE_ROLE_KEY` is unset. Three uses: permanent account deletion
  (Auth Admin API), the payment webhook, and **hiding a post or comment** —
  migrations 0033/0035 revoked `update (is_hidden)` from `authenticated` so an
  author cannot un-hide their own content, and a column privilege is checked
  *before* RLS, so the admin session is refused too. Never route a gesture
  Postgres must arbitrate on caller identity through it (`is_deleted`,
  publishing a Scout Day, validating a removal): those triggers read
  `auth.uid()`, which is null under `service_role`. Hiding now prefers the
  `admin_set_content_hidden` RPC (mobile migration 0042) and only falls back to
  `service_role` when that RPC is absent. There is no admin DELETE policy on `profiles`, and deleting only
  that row would leave the device's JWT valid.
- `lib/supabase/config.ts` — reads `NEXT_PUBLIC_*` **or** the legacy
  `EXPO_PUBLIC_*` names (the `.env` was copied from the Expo app), and exposes
  `publicStorageUrl()` for public buckets.

### Route handlers

- `app/admin/documents/route.ts` — mints a 5-minute signed URL for the private
  buckets (`identity-documents`, `professional-documents`,
  `guardian-documents`) against an explicit bucket allowlist.
- `app/admin/finances/export/route.ts` — CSV export, admin-guarded.
- `app/api/webhooks/payment-provider/route.ts` — the only unauthenticated
  entry point. HMAC-SHA256 over the raw body against `PAYMENT_WEBHOOK_SECRET`,
  compared with `timingSafeEqual`, then a `service_role` update of `payments`.
  Read the raw text before parsing — re-serialized JSON breaks the signature.

### Validating a dossier was refused by Postgres (Oct 2026)

Reported from the screen itself: *« Privilege Postgres manquant (GRANT) … Detail
Postgres : permission denied for table player_profiles »*. Every validation
gesture was dead — "Valider le compte", "Refuser", "Demander des pieces", the
bulk validation on `/admin/validations/joueurs`, the professional queue, and
step 2 of "Lever la suspension".

⚠️⚠️ **Mobile migration `0050` is the cause, and it is right.** It revoked
`update` on both profile tables from `authenticated` and re-granted the form's
columns one by one, deliberately leaving out `status`, `status_reason`,
`status_updated_by`, `status_updated_at` and `ranking_score` — without that, a
player ran `update player_profiles set status = 'valide' where id = auth.uid()`
and validated themselves, which makes the §6.1 manual review decorative. But a
column privilege only looks at the **Postgres role**, and an administrator's
session is an `authenticated` session like any other. 0050 concluded "those
columns belong to the back-office, which uses `service_role`" — this
back-office does not, and must not: `service_role` makes `auth.uid()` null, so
`status_updated_by` would stay empty and the decision untraceable. It is the
same scoping mistake `0079` had to repair after `0073`: a privilege withdrawn
on the evidence of the mobile repo alone, when two apps share this database.

`supabase/migrations/202610050001_admin_profile_status.sql` adds
`admin_set_profile_status(uuid[], text, text, boolean)` — the remedy of 0042
and 0044, a `security definer` function that checks `is_admin()` itself. Things
worth knowing:

- **One function for both tables and for the batch.** The four call sites
  shared one rule ("clear the reason when approving") that four RPCs would let
  drift. It takes an **array**, resolves the table from `profiles.role`, and
  returns **the ids actually modified** — PostgREST does not fail an update
  that touched no row, so the screen would otherwise announce "profil valide"
  with nothing changed. `writeProfileStatus()` in `lib/actions/users.ts` is its
  only caller.
- ⚠️ **`suspendu` is refused by the function.** Suspending also cuts
  `profiles.is_active`, which only `admin_set_account_active()` (0044) does;
  writing the status alone leaves the "suspended but active" hybrid the account
  screen already describes as an anomaly.
- **It falls back to the direct update on `PGRST202`**, so an installation
  without 0050 keeps working — same shape as hiding preferring
  `admin_set_content_hidden`. If that fallback then hits `42501`,
  `describeStatusError()` names *this* migration rather than the generic
  "needs a security definer function" copy.
- Verified on a throwaway Postgres reproducing 0050's grants: the reported
  error reproduced first (the witness), then 12 assertions — approval,
  rejection with a trimmed reason, `status_updated_by` stamped from
  `auth.uid()`, the batch skipping already-decided rows, an unknown id
  returning `{}` instead of a false success, a blank reason stored as null,
  and the refusals (ordinary player, `suspendu`, unknown status, `anon`) — plus
  the two controls that 0050's revoke still holds for a user and that what a
  player *may* write still works. Migration replayed twice.

### Evaluations are scored on SIX axes, not four (Sept 2026)

Reported as "we should use the new score formula"; what was on screen was
**`TEC 0 PHY 0 TAC 0 MEN 0`** on every evaluation written since the mobile app
moved. That string is the symptom, and the cause is one line.

Mobile migration **0091** (client decision 2026-09-24) replaced the four axes of
0030 — technique / physique / tactique / mental — with six: **Vitesse ·
Finition · Precision · Passe · Defense · Cognitif**. They are not a rename: the
first set are *categories of judgement*, the second are *phases of play and
measurable qualities*. The back-office was still writing and reading the old
four.

⚠️⚠️ **`Number(null)` is `0`, and that is the whole bug.** `ScoreSummary` read
`Number(row.technical_score)` unconditionally. On a 0091 row those columns are
`null`, so every report filed from the mobile app rendered as a player who
scored zero on everything — while its six real scores sat in the columns next
door. The Scout Day dossier had the same four fixed columns and the same zeroes.

⚠️⚠️ **No conversion exists between the two sets, and none is performed.**
Nobody can derive an "Accuracy" from a "technique". Rows written before 0091
keep their four scores and **keep displaying with four axes**; `axesOf()`
(`lib/evaluation-axes.ts`, the mirror of the mobile module of the same name)
reads whichever set the row actually carries, and returns nothing when a set is
incomplete — an empty grid rather than a grid of zeroes, which would lie the
same way. A player evaluated before and after therefore shows two differently
shaped profiles in their history. That is correct, and hiding it would be lying.

Consequences worth knowing before touching this:

- **`saveEvaluation()` writes the six**, and `chk_evaluation_axis_set` requires
  one **complete** set or the other — a partial six, or a mix of both, is
  refused by Postgres. `overall_score` is still never sent: it is
  `GENERATED ALWAYS STORED` and averages whichever set is present (over 6 or
  over 4), so the figure stays comparable across the change.
- **Editing a pre-0091 evaluation is refused, on purpose.** Re-scoring it on six
  axes would invent six numbers out of four, and leaving both sets filled would
  silently flip `overall_score` onto the six. There is no edit UI today; the
  guard is there for when there is one.
- **The select list is written out in full** (`EVALUATION_SCORE_COLUMNS`) rather
  than derived from the axis arrays, because supabase-js parses a `select`
  string **at the type level** and a `join()` yields a wide `string` its parser
  rejects. A cast would silence that check instead of performing it, so the two
  lists are compared in `tests/evaluation-axes.test.cjs` instead.
- ⚠️ **0091 is applied on the shared project — verified, and the method is the
  point.** An anonymous probe answers `42501 permission denied for function
  is_admin` for *every* existing column (the 0082 wall), so it proves nothing on
  its own. The negative control settles it: an invented column answers `42703`
  *before* RLS runs, while `speed_score` answers `42501`. The column therefore
  exists.
- `tests/evaluation-axes.test.cjs` transpiles the real module and runs it —
  6 assertions, **verified by mutation**: reading `null` as `0` (the original
  bug's mechanism) fails three of them. Note what it does *not* catch: the bug
  itself lived at the call site, so reversing the order of the two axis sets
  changes nothing, `axesOf` being order-insensitive by requiring a complete set.
  The test file says so rather than claiming coverage it does not have.

### Notifications : le composeur d'abord, et les canaux disent la verite (Sept 2026)

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
  fait les deux passes, dans cet ordre.
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

### Le canal email est branche (Sept 2026)

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

### Le choix des canaux, et un chiffre qui etait faux depuis le debut (Sept 2026)

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

### Le courriel se separe de la notification (Sept 2026)

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

### Tout ce qui se lit est un bloc (Sept 2026)

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

### Le corps du modele se compose par blocs (Sept 2026)

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

### Passe de finition sur la diffusion (Sept 2026)

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

### Couleurs du modele, et message mis en forme (Sept 2026)

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

### Plusieurs modeles d'e-mail, choisis a la diffusion (Sept 2026)

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

## Schema gotchas that shape the UI

- **Three similarly-named status enums.** `player_profiles.status` and
  `professional_profiles.status` gate access to the mobile app;
  `identity_verifications.status` (`identity_verification_status`) is a *separate*
  KYC-document review. Validating a KYC document does **not** validate the
  account — the back-office exposes the two gestures separately for this reason.
- **Content moderation uses flags, not DELETE.** The schema grants admins UPDATE
  but not DELETE on `posts` / `post_comments`, so moderation sets `is_hidden`
  (moderation) and `is_deleted` (author's own removal). Both are reversible and a
  removed item stays visible to admins. Player videos/photos *are* really
  deleted — row plus storage object together.
- **Removing reported content is a two-step, super-admin-validated gesture.**
  Since the mobile repo's migration `0041`, a moderator *proposes* a motivated
  removal (`reports.status = 'a_valider'`), which quarantines the target where a
  reversible flag exists, and only `is_super_admin()` confirms or refuses it.
  Postgres enforces the teeth: setting `is_deleted` on someone else's post or
  comment, and deleting someone else's `player_videos` / `player_photos` row,
  are super-admin-only. `moderation.manage` still covers the reversible
  `is_hidden`; `moderation.validate` covers the decision.
- **A reported account is judged on the reason, not on the conversation.**
  Mobile migration `0047` lets someone report their counterpart from a
  conversation; the report targets the account (`target_type = 'utilisateur'`)
  and stores the thread in `reports.context_conversation_id`, which opens that
  thread — and only that one — to admins via `is_reported_conversation()`.
  **The back-office deliberately does not use that access.** RLS would allow
  it; the client's rule is that a moderator instructs on the reason the
  reporter wrote. The dossier shows the report's *provenance* ("depose depuis
  une conversation privee") and never its messages. Do not wire
  `messages_readable` into `lib/queries/moderation.ts` without the client
  asking — that would reopen private conversations. Same rule for the
  `message` target type: `fetchReportTargets()` selects `sender_id` from
  `public.messages` so a suspension knows whose account it hits, and never
  `content` (which is encrypted anyway — see below).
- **Message text is encrypted.** Since 0022 `messages.content` is always null
  and the text lives in `content_encrypted`; only the `messages_readable` view
  decrypts it. A plain `select` on `public.messages` returns rows with empty
  bodies and no error at all — which is exactly why selecting `content` there
  looks like it works and silently returns nothing.
- **The report dossier follows its own mockup.** Breadcrumb + title with its
  state pills + the status-dependent gestures on the right (propose removal /
  dismiss, confirm / refuse, and *Suspendre le compte* whenever the target is an
  account), then a three-column grid: decision card, target card and timeline on
  the left; block signals and provenance on the right. "Antecedents de sanction"
  counts reports on the same target already handled with an action — a real
  query, unlike the mockup's "RISQUE FAIBLE" badge, which was dropped along with
  the PDF export, "Rouvrir l'instruction" (no such transition exists in the state
  machine) and the internal-notes textarea (no table stores them — it would take
  a migration the client has to apply).
- **The report dossier is a page, not a dialog.**
  `/admin/moderation/signalements/[id]` puts the decision gestures beside the
  evidence and gives each report a shareable URL. It is deliberately not a
  `DetailDialog`: that renders its children on the server whether or not
  anyone opens them, so per-report queries would run for every row of a
  200-report queue.
- **The header bell shows the admin work queue, never `public.notifications`.**
  That table is the *users'* inbox, and RLS lets an admin read all of it
  (`notifications_select_own` carries `or public.is_admin()`) — the bell used to
  list its last 20 rows, "X vous a envoye un message" included, with the
  recipient named. Same rule as private conversations: the technical right is
  not the use. `fetchAdminQueue()` (`lib/queries/admin-queue.ts`) counts what
  awaits a decision — validation queues, reports, removals to validate, Scout
  Days to validate, account-deletion requests — filters the lines by the
  admin's permissions, and feeds **both** the bell and the nav badges from that
  one read so the two can never disagree. The bell's own pill sums the task
  *counts*, not the number of task lines: several reports share one line
  ("2 signalements a instruire"), so counting lines froze the pill at 1 while
  the nav pill beside "Moderation" — which does sum dossiers — climbed. A task
  leaves the *list* only when it is handled; the bell's *pill*, though, goes out
  when the bell is opened and relights only for dossiers arrived since
  (`useQueueSeen()`, `components/admin/queue-seen.ts`, per-queue counts kept in
  `localStorage` per account, lowered whenever a queue shrinks so a handled
  dossier followed by a new one is not missed). Client request, Oct 2026: a pill
  that never went out was no longer read. The rail badges are unaffected — they
  still show the whole queue. Do not point the bell back at
  `notifications` without the client asking.
  The layout's read only *seeds* the display: `AdminQueueProvider`
  (`components/admin/queue-live.tsx`) wraps the shell and keeps it current
  through `/admin/file-attente` — the same `fetchAdminQueue()`, same permission
  filter — so a dossier deposited from the mobile app appears without a reload.
  **It does that two ways, and the second is not redundant.** A
  `postgres_changes` subscription on the seven counted tables makes the update
  immediate: Postgres pushes, the provider re-counts, and only the *event* is
  used — the payload is discarded, never rendered. A 10 s poll stays underneath
  it, because a subscription on a table absent from the `supabase_realtime`
  publication **succeeds and delivers nothing**, with no error to observe:
  dropping the poll on the assumption that push works would make the bell
  slower, not faster. Migration `202609090001_realtime_admin_queue.sql` is what
  publishes those seven tables (and sets `replica identity full`, since the
  signal is almost always an UPDATE); until it is applied on the shared project,
  10 s is the floor. Adding a queue to `fetchAdminQueue()` means adding its
  table to `QUEUE_TABLES` and to that migration, or the new queue silently
  keeps the polling latency.
  The provider holds still while the bell or a dialog is open, and a
  `revalidatePath` re-render always wins over the polled value.
  That keeps the *counters* live, not the screen under them — so
  `app/admin/layout.tsx` also mounts `AutoRefresh` (30 s) for every admin page:
  `router.refresh()` replays the current Server Component and its queries
  without a reload and without losing client state. The two are complementary
  and the split is deliberate — one cheap JSON read every 10 s for the badges,
  the page's full query set only every 30 s. Mount `AutoRefresh` once, in the
  layout: a second one on a page would double every query on that screen.
- **`user_blocks` is admin-readable and admin-untouchable.** `blocks_admin_read`
  lets the back-office count them; there is no admin gesture, and there must
  not be one — blocking is a user's own decision. It is displayed as a
  recidivism signal (report detail, account file), never as a sanction.
- **No nested PostgREST embeds toward `profiles`.** `player_profiles` and
  `professional_profiles` each have *two* FKs to `profiles` (`id` and
  `status_updated_by`), which makes `profiles(...)` ambiguous. Identities are
  loaded separately via `fetchProfilesByIds()` in `lib/queries/profiles.ts`.
- **Several columns are unwritable by an admin session, and the error looks
  like RLS but isn't.** Migration `0025` revoked `update` on `profiles` and
  re-granted only a whitelist — `is_active`, `deactivated_at` and `role` are
  deliberately excluded; `0033`/`0035` did the same for `is_hidden`, and
  **`0050` for the status columns of `player_profiles` /
  `professional_profiles`** (`status`, `status_reason`, `status_updated_by`,
  `status_updated_at`, plus `ranking_score`). A column
  privilege is checked *before* RLS and only looks at the Postgres role, so the
  back-office session is refused too, with `42501 permission denied for table
  …`. The remedy is a `security definer` RPC, never a policy: mobile migrations
  `0042` (hiding) and `0044` (account state, role, deletion request) provide
  them, `202610050001_admin_profile_status.sql` (this repo) provides
  `admin_set_profile_status()` for the status columns, and `describeError()`
  now tells the two causes apart.
- **Suspending an account is a product-level block, not an auth ban.**
  `admin_set_account_active` (mobile 0044) flips `profiles.is_active` **and**
  sets the business profile to `suspendu`. Nothing touches Supabase Auth:
  `signInWithPassword` still succeeds and still mints a JWT. What blocks the
  user is the mobile onboarding resolver, which reads
  `player_profiles.status` / `professional_profiles.status` — never
  `is_active` — and signs them straight back out on `suspendu`. Consequences:
  a session already open keeps working until the app restarts, and the
  refresh token stays valid, so RLS (which does not check `is_active` for
  ordinary users) would still serve a direct API call. A real ban needs
  `auth.admin.updateUserById({ ban_duration })` with the service key.
  **Reactivating does not restore access**: the RPC deliberately sends the
  profile back to `en_attente_validation`, itself a blocking status, so the
  dossier returns to the validation queue instead of being revalidated in
  passing. The UI says so on both gestures.
- **Publishing a Scout Day is a super-admin gesture.** Since the mobile repo's
  migration `0040`, a professional submits an event (`en_attente_validation`)
  and only `is_super_admin()` can move any Scout Day to `publie`; a refusal
  sends it back to `brouillon` and *requires* a `validation_reason`, which the
  organizer receives as a notification. The rule lives in the
  `trg_enforce_scout_day_validation` trigger, so the UI permission check is a
  courtesy, not the enforcement. `submitted_at` / `validated_by` /
  `validated_at` / `validation_reason` are written by that trigger — sending
  them from the client is silently overwritten.
- **Country/city pickers use the same source as the mobile app** —
  countriesnow.space (free, no key) plus `i18n-iso-countries` for the French
  names, ported to `lib/countries-api.ts`. Two traps carried over: the
  documented `POST /countries/cities` 301-redirects and a redirected POST is
  replayed as a GET, silently dropping the country filter (call the GET variant
  directly), and the cities endpoint only knows its own **English** country
  names while `player_profiles.country` stores the **French** one — `Country`
  carries both. Unlike mobile, the calls run **server-side** (a Server
  Component and `app/admin/geo/cities/route.ts`), so nothing depends on a third
  party's CORS headers; when the service is down the fields fall back to free
  text rather than blocking event creation.
- **`scout_days.eligibility_criteria` has a fixed shape**, frozen identically in
  mobile migration `0028`'s column comment and in `lib/football.ts`: `age_min`,
  `age_max`, `positions[]` (verbatim `FOOTBALL_POSITIONS` strings),
  `levels[]` (the `player_level` enum), `countries[]`/`cities[]` (French names,
  as `player_profiles` stores them), `free_agent_only`, `other`. The §8.2
  eligibility check compares those keys by string equality, so a criterion
  stored anywhere else filters nobody. The back-office form used to write
  `{ description: "<free text>" }` — readable on screen, invisible to the
  filter; it now writes the real keys through `cleanCriteria()`.
- **Admin-created Scout Days and evaluations carry a professional's id.**
  `scout_days.organizer_id` and `scout_evaluations.evaluator_id` reference
  `professional_profiles`, so the admin forms make you designate one; who
  actually entered the data is only recoverable from `admin_audit_log`.
- **Creating the first admin** requires temporarily disabling the
  `trg_prevent_self_role_escalation` trigger: it rejects any role change when
  `is_admin()` is false, and `auth.uid()` is null in the Supabase SQL editor. See
  README.md for the exact statement.

## Code conventions

- **Filter/tab state lives in the URL**, never in component state, so pages stay
  Server Components that re-query. `FilterBar` and `Pagination` receive the
  already-awaited `searchParams` as a plain `params` record and build hrefs from
  it — they never call `useSearchParams()`. Tabs are links (`SegmentedNav`), so
  each view only loads its own data.
- **Read queries live in `lib/queries/*.ts`** (`users`, `user-detail`,
  `dashboard`, `profiles`) and return already-shaped rows; pages compose them
  rather than calling `supabase.from()` inline. Page size constants live beside
  the query (`USERS_PAGE_SIZE`).
- **Server Actions** live in `lib/actions/*.ts`, call `requireAdmin()` /
  `requirePermission()` first, return a uniform `ActionResult = { ok, message }`
  (never throw for expected failures), and end with
  `revalidatePath("/admin", "layout")` so the nav's queue counters refresh.
- **Surface database errors through `describeError()`** (`lib/actions/result.ts`)
  instead of writing your own message. It maps SQLSTATEs to French copy and
  deliberately re-exposes Postgres' raw `42501` text, because that string names
  the table whose policy is missing — the caller is already an admin, so
  "access denied" would be the wrong diagnosis. Business rules raised by a
  trigger share that SQLSTATE, so they are told apart by their `hint`
  (`BUSINESS_RULE_HINTS`) and their own French message is passed through
  untouched; add the hint there when a migration introduces one.
- **Client callers of actions**: `ActionButton` (a bound action, optional
  confirm dialog), `ReasonDialog` (actions needing a `status_reason` /
  `rejection_reason`), `ServerForm` (`useActionState` + toast, for full forms).
  All three toast the `ActionResult` so RLS failures are visible.
- **Forms use native `<select>`** (`components/ui/native-select.tsx`) and plain
  `FormData`, not Base UI's `Select`, so no per-field client state is needed.
  Base UI's `Select` is used for filters, where the URL holds the state.
- **Enum labels** are centralized in `lib/labels.ts`: keys are the literal
  Postgres enum members (never translate them — they are what gets stored), and
  each carries a French label plus a `Tone` used by `StatusPill`. Use
  `entry()`/`label()`/`options()` rather than inlining strings. Dates, money and
  numbers go through `lib/format.ts` (`fr-FR` `Intl` instances).
- **UI kit**: `components/admin/*` holds the app-specific pieces (`Panel`,
  `PageHeader`, `StatCard`, `StatusPill`, `UserCell`, `DefinitionList`,
  `EmptyState`, …). `components/ui/*` is generated shadcn — prefer composing the
  admin pieces over restyling the primitives.
- The UI is French; comments and copy are written in French, unaccented in code.
- **No table, column, enum or function names in visible copy.** The audience is
  the client's administrators, not developers: `profiles.role` becomes "les
  comptes par type", `player_profiles.status` becomes "le statut du profil
  joueur", "au statut « active »" becomes "en cours", and a trigger or RLS
  policy is "la base de donnees". The identifiers stay where they are useful —
  in the code comments, in the queries, and in `describeError()`'s raw `42501`
  passthrough, which names the table on purpose. The one screen that still
  prints them is `/admin/acces-refuse`, where naming the missing permission and
  the RBAC table is the whole point of the page.

## Layout and design tokens

`app/admin/layout.tsx` is the shadcn sidebar shell: `SidebarProvider` →
`AppSidebar` (`components/app-sidebar.tsx` + `nav-main.tsx` + `nav-user.tsx`,
driven by `NAV_ITEMS` and filtered by permissions) → `SidebarInset` →
`SiteHeader`. The layout also runs `fetchAdminQueue()`, whose single read feeds
both the nav badges and the header bell.

**The logo is one file, `public/brand/ifriqiya-star.svg`, behind one
component** — `BrandMark` (`components/admin/brand-mark.tsx`). The public site
nav, the footer and the sign-in shell read the file directly; inside the
back-office four slots go through `BrandMark`: the rail header, the rail's
account block, the top bar's account block and the notification lock-screen
preview. Until Sept 2026 those drew a fake `IS` tile in `#84cc16` — Tailwind's
lime-500, not the charte's `#aff70f`.

- The file carries its own rounded black plate, so `BrandMark` adds **no**
  `rounded-*` and no pill: one laid over it crops its corners instead of
  framing it.
- `alt=""` everywhere, because a name or a role is always written beside it —
  naming it again has it announced twice.
- **In both account blocks it replaces the initials**, as the `AvatarFallback`.
  `app/[locale]/admin/layout.tsx` passes no `avatar` — an administrator's photo
  exists nowhere in the schema — so that fallback is what always renders, and it
  was showing a **single letter**: `initials()` keeps the first letter of each of
  the first two words, and an e-mail address is one word. `AvatarImage` stays
  above it so a real photo would still win if one were ever passed.
- **`nav.tagline` ("Scouting pro") was removed**, from the header and from both
  admin dictionaries: a marketing line has no business in an administration
  rail, and it pushed the brand name into the top half of a 40 px block. The
  name alone now centres on the logo. (`messages/{fr,en,ar}.json` keep their own
  `tagline` — that one belongs to the public footer and is unrelated.)
- It is served through `next/image` with no `dangerouslyAllowSVG` in
  `next.config.ts`, and that is fine: Next passes an SVG through untouched —
  verified, the emitted `src` is the raw path, never `/_next/image` — which is
  also why the optimizer's host rules do not apply to it.

Colors and type descend from the mobile app's
`~/ifriqiyastar/src/constants/theme.ts`: Nunito Sans headings (`--font-heading`),
Poppins body (`--font-sans`), lime accent `#aff70f`. `<html>` is pinned to
`class="dark"`; the light palette in `app/globals.css` exists but is unused.

Three token layers, in `app/globals.css` — know which one you are editing:

1. `:root` — the light palette (unused in practice).
2. `.dark` — the app-wide dark palette (`#0B0B0C` background, `#171718`
   surfaces, `#232326` borders, `--radius: 1.25rem`).
3. `.admin-dashboard-shell` — a **scoped override** applied by the admin layout
   only (`#0b0c0b` page / `#141614` panels / `#262a25` borders, `--radius:
   0.75rem`), plus the fixed-rail and sticky-first-column rules. `/connexion`
   deliberately keeps the `.dark` values, so a change made in `.dark` alone will
   not show inside `/admin`, and vice versa.

The gap between the rail's navigation and the signed-in account block carries
**only what is nowhere else**: `RailDiagnostics` renders the installation
defects that otherwise degrade the app in silence — no RBAC tables (every admin
gets every right, on purpose, which is exactly why it must be visible) and no
service key (permanent account deletion fails at the gesture, not before).
`fetchDiagnostics()` filters each item by the permission that makes it relevant,
and an empty list draws nothing — which is the normal state. That block is the
second place allowed to print technical names (`SUPABASE_SERVICE_ROLE_KEY`, the
migration file), for the same reason as `/admin/acces-refuse`: it exists to be
fixed.

**An unconfigured optional integration is not a defect.** `PAYMENT_WEBHOOK_SECRET`
was listed there for one turn and it was wrong: no provider is connected, so the
webhook refusing every call is the safe behaviour and payments are activated by
hand from the finances screen. A permanent warning about something nobody chose
yet burns attention and ends up hiding the real defects. Only add a check here
when its absence breaks a gesture the UI actually offers.

Shared visual idioms are utilities, not repeated classes: `.bg-brand-gradient`
(`--brand-from` → `--brand-mid` → `--brand-to`, used by primary buttons),
`.glow-lime` / `.glow-teal` for stat-tile halos, `.micro-label` for the
uppercase wide-tracked micro-typography (breadcrumbs, table headers, tile
labels, rail sections), and `.row-flagged` for a table row awaiting a decision.

### The September 2026 mockups

The back-office follows the client's redesign screenshots (`~/Downloads/screen`,
September 2026): breadcrumb + large title + context pill, six-across stat tiles
with a square icon chip and a micro label, pill tabs carrying counts, panels
with an icon in the header, uppercase table headers, and a band of explanatory
`NoteCards` closing each operational screen. `PageHeader` / `HeaderMeta`,
`StatCard`, `PanelHeader` and `NoteCards` carry that language — restyle those
four rather than re-inventing it per screen.

Two screens also carry the mockups' **structure**, not only their skin:

- `/admin/validations` follows the client's HTML mockup closely: metric strips
  (`MetricStrip`), pill tabs carrying an icon and a count, a GET filter strip,
  then a 12-column grid — the queue on `col-span-8`, `DossierRail`
  (`components/admin/dossier-rail.tsx`) on `col-span-4` with the identity
  document preview, the read attributes, the compliance checks and
  `DossierDecision`. The selection lives in the URL (`?dossier=<id>`, defaulting
  to the first row), so the page stays a Server Component; it replaced the
  per-row `DetailDialog`, which also means the queue no longer server-renders one
  dossier per row.
  Two things about that screen are worth knowing before editing it:
  **the note field cannot ride along with an approval** — `setPlayerStatus`
  clears `status_reason` on `valide` by design, so `DossierDecision` wires the
  note to the two gestures that transmit it (piece request, rejection) and says
  so in the label; and **bulk validation is not a shortcut** —
  `bulkValidatePlayers` runs the same update through the same permission, RLS and
  triggers, filtered on `status = 'en_attente_validation'`, and reports how many
  rows actually changed rather than echoing the selection size.
  Data the mockup shows and the schema does not have was dropped, not faked: AI
  score, FaceMatch, CIN number, document expiry, FTF federation match, the
  biometric/OCR resolver panel, the "Synchroniser KYC" button. The completeness
  bar in the queue is a count of five present fields, labelled as such — not an
  authenticity score.
- `/admin/notifications` composes the message and previews it side by side
  (`NotificationComposer`). The fields keep their `name`, so `FormData` still
  carries `title` / `body`; only the preview is client state.
- `/admin/notifications` puts the composer (`col-span-8`) beside the lock-screen
  preview and a **reach** panel (`col-span-4`), all inside one client component
  because the preview follows the typing. The target segments show their real
  audience (active accounts, active players, active professionals, registrations
  per Scout Day) and the resolved line names it, so nobody sends blind.
  `sendTestNotification` broadcasts the draft to the admin's own account — the
  only honest "test" the schema allows, since the RPC always writes a real
  notification; it deliberately writes nothing to the campaign history.
  Removed from the mockup: the `{nom_joueur}` variable buttons (nothing
  substitutes them — the recipient would read the braces), the email channel
  toggle (shown disabled instead: no provider), "99.4 % délivrabilité", the open
  rate, "Broker Sync ACTIF", the queue counter, and the whole push-gateway
  telemetry panel (Firebase/APNs uptime, latency sparkline, socket count) —
  replaced by the one delivery fact the database knows: how many accounts have
  registered a push token.
- `/admin/utilisateurs/[id]` follows the three detail mockups: a breadcrumb bar
  carrying the profile-completion figure, one **identity card** (photo, name,
  state pills, context line, two figures, then `AccountActions` under a rule),
  pill tabs with real counts, and a two-column "Fiche" tab — read-only account
  activity on the left, the editable forms on the right. The dossier tab opens
  with the KYC decoupling notice, because that is the costliest confusion on the
  screen.
  Both header figures are computed, not scored: **completion** is the share of a
  named field list (so it can be checked by eye — it is not a quality grade), and
  **note moyenne** is the average `overall_score` of the evaluations actually
  recorded for that player, with the count beside it. Everything the mockups
  invent was dropped: the DTN ranking score, FaceMatch percentage and biometric
  confidence, the MRZ strip and document expiry, "SYNC LIVE DTN", the performance
  index (top speed, key passes, dribbles, stamina), morphological percentiles and
  coverage radar, the active-session panel with device and IP, the SHA-256 hash
  and eIDAS wording, "visible par +450 clubs", the PDF dossier export and the
  "send message" button. The only biometric signal the schema has is
  `identity_verifications.facial_check_provider` / `facial_check_passed`, shown as
  a pass/fail pill with its provider — never as a percentage.
- `/admin/moderation` follows its mockup: two `MetricStrip` measures in the
  header (average time to decision from `handled_at - created_at`, and the share
  of handled reports that carried a `moderation_action`), a filter hub holding
  the tabs and a GET filter form, then the queue with its toolbar, legend and
  footer. `Exporter le registre` hits `/admin/moderation/export`, which replays
  the screen's `statut` / `cible` filters and exports **identifiers, the
  reporter's reason and the decision trail only** — never the reported content,
  which would turn an export into a distribution.
  The **Priorité** column is derived, not stored: `a_valider` → Critique, more
  than one report on the same target → Niveau 2, otherwise Niveau 1. The
  toolbar legend states that rule; there is no severity column in the schema, so
  do not present it as one. The mockup's "taux d'expulsion", encrypted audit
  journal, automatic DM freeze on 5+ reports, and "suspension revokes active
  sessions and Scout Day invitations" were all rewritten — the last one is the
  exact opposite of what suspension does.
- `/admin/utilisateurs` follows its own mockup: four `KpiTile` headers (label +
  icon, value + coloured qualifier, proportion bar), a GET filter toolbar built
  from native `<select>`s (no client state at all), then the directory table with
  the mockup's seven columns — identity + contact, role pill, conformity, detail
  / affiliation, account state, signup date, operational actions. The conformity
  column shows the *business* status for players and professionals and the RBAC
  role for admins (read from `admin_user_roles` / `admin_roles`, degrading to
  "Administrateur" when the RBAC migration is absent). `Exporter CSV` hits
  `/admin/utilisateurs/export`, which replays the screen's own filters through
  `listUsers()` so the file matches what is on screen.
  Not carried over: "Créer un compte" (signup happens in the mobile app, no
  invitation-email provider is configured, and admin role assignment moved to
  SQL with `202608240006`), the "edit role" pencil for the same reason, "Flux
  synchronisé en temps réel", and the three footer notes — the mockup's version
  claims biometric extracts, radar export quotas, and that a suspension
  "revokes active sessions immediately", which is precisely what it does not do.
- `/admin` follows the client's dashboard mockup: eight `StatCard` tiles (icon
  chip + title, arrow, value + qualifier pill, foot line, per-tile `accent`),
  then a 12-column analytics row — financial flows on `col-span-8` with a real
  `?flux=` segment (it filters the series *and* the total above it, so the two
  always agree), account split on `col-span-4` — then the player funnel and the
  offer catalogue side by side, and the next published Scout Day as a closing
  bar. The average approval delay and the plan prices come from
  `getDashboard()`; the delay is `null`, rendered "—", when no profile has been
  validated yet, because a "0" would read as an instant decision.
  Dropped from that mockup for the same reason as elsewhere: the "Flux temps
  réel" badge (the page is server-rendered per request, not live), the "Console
  Pro v2.4" version pill, the Stripe Connect / national gateway mention, the
  "Simuler un paiement" and "Configuration passerelle" buttons, the projected
  basket, the "Optimal" verdict on the approval delay, and the invented plan
  copy — the catalogue shows the labels and prices that `subscription_plans`
  actually stores.

**What was deliberately not copied.** The mockups are dressed with figures and
modules that do not exist behind them: an AI score and a FaceMatch percentage
on the validation queue, a biometric/OCR resolver, push-gateway telemetry
(`14,280 envois`, `98.4 %`, Firebase/APNs uptime), average handling times, an
expulsion rate, an accounting projection. None of it is implemented, so none of
it is displayed — the same rule that keeps invented audience figures off the
landing page. Every number on screen still comes from a query, and
`StatCard.progress` is only passed a ratio of a real total. If the client wants
those indicators, they need the data first, and that is a schema conversation,
not a styling one.

Chart series colors are `--viz-1` / `--viz-2`, deliberately **distinct** from
the brand accent (the accent is a state color for buttons and active tabs, not a
series identity), and defined per palette because they are validated against
their own surface. The pair is checked for lightness band, chroma floor,
colorblind separation and contrast — re-validate before changing it, and keep
legends and numeric labels so color never carries information alone.
