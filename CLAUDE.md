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
its phone mockups are real screenshots of the mobile app in `public/app/`.
It carries **no audience figures and no testimonials** — inventing either on a
public page manufactures evidence.

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
- **Both lists stay newest-first; the two queues are oldest-first**, so the
  content that has waited longest comes up first. Same convention as the Scout
  Day queue.
- **"Voir la publication" opens the same popup**, from the comment queue and
  from the comment list alike — a comment is judged on what it sits under, and
  "bien joue" under an announcement is not "bien joue" under an insult. The
  parent posts are loaded in **one** query for the whole page (`.in("id", …)`
  through `selectWithModeration`), never one per row, and their authors are
  folded into the same `fetchProfilesByIds` call — the post's author is not the
  comment's. ⚠️ **It was previously a link to
  `?vue=publications&q=<post_id>`, which could never work**: `q` is a full-text
  filter on `content`, so searching an id matched nothing. When the parent is
  unreachable (removed, or filtered by RLS) **nothing** is rendered rather than
  an inert button — a control that opens nothing casts doubt on the whole
  screen.
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
  the nav pill beside "Moderation" — which does sum dossiers — climbed. There is
  no read/unread state: a task leaves the list when it is handled. Do not point the bell back at
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
  deliberately excluded; `0033`/`0035` did the same for `is_hidden`. A column
  privilege is checked *before* RLS and only looks at the Postgres role, so the
  back-office session is refused too, with `42501 permission denied for table
  …`. The remedy is a `security definer` RPC, never a policy: mobile migrations
  `0042` (hiding) and `0044` (account state, role, deletion request) provide
  them, and `describeError()` now tells the two causes apart.
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
