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
2026) and only it — four colors (`#000000`, `#aff70f`, `#CCCCCC`, `#FFFFFF`),
Nunito Sans headings, Poppins body — with its palette scoped to `.site-shell`
in `app/globals.css` so a marketing tweak never repaints an admin screen.
It carries **no audience figures and no testimonials** — inventing either on a
public page manufactures evidence. The same rule governs the back-office: every
number on screen comes from a query. See
[`public-site.md`](docs/ai-reference/public-site.md).

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

## Rules that apply to almost every change

These were each learned from a specific incident. The incident and its measured
evidence stay in the linked reference; the rule is here because it bites
everywhere.

- ⚠️ **`.select("id")` after every update, always.** PostgREST does not fail
  when RLS filters the targeted row: the update touches zero rows and returns
  success, so the screen announces "profil valide" with nothing changed. The
  trap was paid on `professional_documents`, then `scout_days`, then content
  moderation, then `platform_settings`. Report the rows that actually changed,
  never the size of the selection.
- ⚠️⚠️ **`42501` has two different causes and they need opposite fixes.** A
  missing RLS policy, *or* a column privilege revoked from `authenticated`
  (mobile migrations `0025` on `profiles`, `0033`/`0035` on `is_hidden`, `0050`
  on the profile status columns). A column privilege is checked *before* RLS and
  only looks at the Postgres role, so the back-office's admin session is refused
  too. The remedy for the second is a `security definer` RPC, never a policy;
  `describeError()` tells the two apart. See
  [`authorization.md`](docs/ai-reference/authorization.md).
- ⚠️⚠️ **`service_role` bypasses RLS *and* makes `auth.uid()` null.** Never
  route a gesture Postgres must arbitrate on caller identity through it
  (`is_deleted`, publishing a Scout Day, validating a removal, moderation
  decisions) — the trigger would have no one to stamp and the decision would be
  untraceable. Its three legitimate uses are listed in
  [`database.md`](docs/ai-reference/database.md).
- ⚠️⚠️ **A client component may not import `lib/actions/*` nor `UserCell`.**
  Both reach `lib/i18n/admin.ts`, hence `server-only` / `next/headers` /
  `next/root-params`, and the build fails. Server Actions arrive **bound, as
  props** (`onApprove={approvePost.bind(null, row.id)}`); shared types and
  limits live in neutral modules that import nothing. `npm run test:i18n`
  guards this and has caught it twice.
- ⚠️⚠️ **A list filter belongs in the query, never in a pass over the
  already-paginated result.** Otherwise a term in the 200th row is never found,
  `count` ignores the filter, and the footer disagrees with the table. Escaping
  is `likeTerm()` / `orLikeTerm()`: `%`, `_` and `\` for `ilike`, **and a second
  pass** inside `or=(...)`, where PostgREST strips one level of `\` on leaving
  the quotes. Verified by reading the emitted URL, not by reasoning about it.
- ⚠️⚠️ **Tailwind's `grid-cols-*` is `repeat(n, minmax(0, 1fr))`: tracks shrink
  *below* their content instead of overflowing.** The symptom is a crushed
  control, and `document.scrollWidth` stays equal to `clientWidth` throughout —
  so looking for horizontal scrolling finds nothing. Measure the rendered width
  of the input and the select. The recipe, and the two traps it cost, are in
  [`design-system.md`](docs/ai-reference/design-system.md).
- **Degrade open when a migration is absent, and degrade *consistently*.** A
  column a project may not have is selected separately and the read retried
  without it, so the feature disappears instead of the whole screen
  (`selectWithModeration`, the 0093 thread columns, the avatar lookups).
  `getAdminAccess()`, `requirePermission()` and `logAdminAction()` follow the
  same rule. ⚠️ **A permission gate that hides a button is only safe if it
  answers exactly like the one that guards the action** — when the two
  disagreed, "Valider / Publier" vanished from the screen while the Server
  Action would have accepted the call.
- ⚠️ **What a screen costs is round trips, not queries.** The database is
  remote and the link is slow: measured 2.2 s of pure network for one admin
  screen on warm connections, 12.5 s on cold ones, for work Postgres does in
  milliseconds. Nothing reaches the browser until the last wave returns, so a
  new `await` on a Supabase call in a layout or a guard is paid by every page.
  Group reads into one RPC rather than adding a wave — `admin_queue_counts()`
  and `admin_access()` did that for 18 round trips — and **do not restore
  `auth.getUser()` in `requireAdmin()` or `proxy.ts`**: `getClaims()` verifies
  the same token locally instead of calling the auth server twice per request.
  See [`database.md`](docs/ai-reference/database.md).
- **Every list and every queue is newest-first** (client request, Oct 2026).
  The one exception is a comment thread, which stays chronological — it is read
  like a conversation.
- **No table, column, enum or function name in visible copy.** The audience is
  the client's administrators, not developers. The two deliberate exceptions are
  `/admin/acces-refuse` and `RailDiagnostics`, which exist to be fixed, plus
  `describeError()`'s raw `42501` passthrough, which names the table on purpose.
- **Every mutation calls `logAdminAction()`** (`lib/auth.ts`). The journal
  screen and its table were removed at the client's request (mobile `0045`); the
  calls are deliberately kept so the journal refills by itself if it ever comes
  back, and the helper returns silently when the table or RPC is absent. It
  never fails the business action.
- **Tests are verified by mutation.** Every suite in `tests/` states which
  deliberate break makes it fail, and says plainly what it does *not* cover. A
  test still green after the bug is reintroduced proves nothing — that has
  happened here twice (the HTML-escaping witness, the `axesOf` ordering).
- **Do not widen access just because RLS allows it.** An admin may read
  `public.notifications`, a reported private conversation, and `user_blocks`;
  the back-office reads none of them as content. The technical right is not the
  use, and reopening one needs the client to ask.

## Business rules that are not visible in the code

- **Validating a KYC document does not validate the account.**
  `identity_verifications.status` is a separate review from
  `player_profiles.status` / `professional_profiles.status`; the two gestures
  are deliberately exposed apart.
- **Content moderation uses flags, not DELETE** (`is_hidden`, `is_deleted`),
  both reversible and both still visible to admins. Player videos and photos
  *are* really deleted — row plus storage object.
- **Removing reported content is a two-step, super-admin gesture** (mobile
  `0041`): a moderator *proposes* a motivated removal, which quarantines the
  target, and only `is_super_admin()` confirms or refuses.
- **Every post and every comment waits for a super administrator** before anyone
  but its author sees it (mobile `0089`). The rejection reason is mandatory in
  Postgres — it is the only explanation the author gets.
- **Publishing a Scout Day is a super-admin gesture** (mobile `0040`), and a
  minimum notice period (default 7 days) keeps an event from being announced too
  late for players to see it.
- **Evaluations are scored on SIX axes since mobile `0091`** — Vitesse,
  Finition, Precision, Passe, Defense, Cognitif. No conversion exists from the
  four old axes and none is performed. ⚠️ `Number(null)` is `0`: reading a
  missing axis unconditionally renders a player who scored zero on everything.
- **Suspending an account is a product-level block, not an auth ban.** Nothing
  touches Supabase Auth, so a session already open keeps working; reactivating
  deliberately sends the dossier back to the validation queue.
- **Message text is encrypted** since mobile `0022`: a plain `select` on
  `public.messages` returns empty bodies with no error at all.
- **No nested PostgREST embeds toward `profiles`** — two FKs make the embed
  ambiguous. Identities load separately through `fetchProfilesByIds()`.
- **No media bucket is public any more** (mobile `0051`). Never build an
  `/object/public/...` URL; go through `storageUrl()` / `signStorageUrls()`.

Each of these is developed, with its migration and its measured evidence, in the
references below.

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

## Design tokens live in three layers

In `app/globals.css` — know which one you are editing:

1. `:root` — the light palette (unused in practice; `<html>` is pinned to
   `class="dark"`).
2. `.dark` — the app-wide dark palette. `/connexion` deliberately keeps these
   values.
3. `.admin-dashboard-shell` — a **scoped override** applied by the admin layout
   only, plus the fixed-rail and sticky-first-column rules.

A fourth, `.site-shell`, is the public site's. A change made in `.dark` alone
will not show inside `/admin`, and vice versa. Shared idioms are utilities
(`.bg-brand-gradient`, `.glow-lime`, `.micro-label`, `.row-flagged`), not
repeated classes, and the logo is one file behind `BrandMark`. Full detail,
including the September 2026 mockups and what was deliberately **not** copied
from them, is in [`design-system.md`](docs/ai-reference/design-system.md).

## Reference documentation

These files are **not** imported into the session. Open the one that matches
the work in hand; each opens with what it covers.

| Read when you are touching… | File |
|---|---|
| any query or mutation — enum traps, RLS, encrypted columns, Supabase clients, route handlers | [`database.md`](docs/ai-reference/database.md) |
| a gesture Postgres refused with `42501`, or a column the mobile repo revoked | [`authorization.md`](docs/ai-reference/authorization.md) |
| reports, posts, comments, player media, the preview popup, the moderation rail | [`moderation.md`](docs/ai-reference/moderation.md) |
| the four validation queues, their badges, their state filter, the dossier rail | [`validations.md`](docs/ai-reference/validations.md) |
| `/admin/scout-days`, the pending-event alert, the notice period, evaluation scores | [`scout-days.md`](docs/ai-reference/scout-days.md) |
| the notification composer, audiences, in-app / push / email channels | [`notifications.md`](docs/ai-reference/notifications.md) |
| Resend sending, `emails/*`, the template catalogue, blocks, colours, rich text | [`email-campaigns.md`](docs/ai-reference/email-campaigns.md) |
| any image, video or document served from Supabase Storage | [`storage-and-media.md`](docs/ai-reference/storage-and-media.md) |
| `/connexion`, the captcha, a password or e-mail change, `/admin/profil` | [`auth-and-accounts.md`](docs/ai-reference/auth-and-accounts.md) |
| admin styling, `app/globals.css`, a mockup, or an "it isn't responsive" report | [`design-system.md`](docs/ai-reference/design-system.md) |
| the public landing page at `/` | [`public-site.md`](docs/ai-reference/public-site.md) |
| locales, translated app screenshots, or the 404 page | [`localization-and-404.md`](docs/ai-reference/localization-and-404.md) |
