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
   sitting beside the broader `events.manage`; `getAdminAccess()` resolves a role label plus permissions for
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
  one read so the two can never disagree. There is no read/unread state: a task
  leaves the list when it is handled. Do not point the bell back at
  `notifications` without the client asking.
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
