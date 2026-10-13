# Schema constraints, Supabase clients and route handlers

> Reference for [`../../CLAUDE.md`](../../CLAUDE.md). **Read when:** writing any
> query or mutation. Where the schema lives and how to probe it is in the root
> `CLAUDE.md`; this file is what the schema *does* to the UI.

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


## Supabase clients

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


## Route handlers

- `app/admin/documents/route.ts` — mints a 5-minute signed URL for the private
  buckets (`identity-documents`, `professional-documents`,
  `guardian-documents`) against an explicit bucket allowlist.
- `app/admin/finances/export/route.ts` — CSV export, admin-guarded.
- `app/api/webhooks/payment-provider/route.ts` — the only unauthenticated
  entry point. HMAC-SHA256 over the raw body against `PAYMENT_WEBHOOK_SECRET`,
  compared with `timingSafeEqual`, then a `service_role` update of `payments`.
  Read the raw text before parsing — re-serialized JSON breaks the signature.

