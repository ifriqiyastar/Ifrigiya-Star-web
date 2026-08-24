# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server (Turbopack) on :3000
npm run build    # production build — also the only type-check in this repo
npm run lint     # eslint (flat config, eslint-config-next)
npx eslint .     # `npm run lint` passes no path; use this to lint everything
```

There is no test runner configured. `npm run build` runs `tsc` as part of the
pipeline, so a build failure is usually a type error — treat it as the test suite.

## What this repo is

The **administrator back-office** (§12 of the client's cahier des charges) for
Ifriqiya Star, a football player/recruiter marketplace. There is no public-facing
surface: `/` redirects to `/admin`, which redirects to `/connexion` unless the
session belongs to an admin.

Next.js 16 App Router · React 19 · Tailwind v4 · shadcn/ui (`base-sera` style,
built on **Base UI**, not Radix) · `@supabase/ssr`.

## The database is not in this repo

This app talks to **the same Supabase project as the Expo mobile app at
`~/ifriqiyastar`** — same `auth.users`, same tables, same RLS policies. This repo
owns no schema and should not add migrations.

- **Schema source of truth**: `~/ifriqiyastar/00_ALL_IN_ONE.sql` plus the
  numbered migrations (`0015_player_photos.sql` … `0018_player_search.sql`).
- **Product spec, enum semantics, onboarding state machine**:
  `~/ifriqiyastar/CLAUDE.md`.

Read those before writing a query. But **verify against the live database** — it
has diverged from the SQL file at least once. An unauthenticated PostgREST probe
with the publishable key is enough, because RLS returns `[]` for a valid column
and `42703 column … does not exist` for an invalid one:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/<table>?select=<cols>&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

Known divergence: **`public.profiles` has no `avatar_url` column** despite
`00_ALL_IN_ONE.sql` declaring one. The only photo available is
`player_profiles.profile_photo_url`, which `fetchProfilesByIds()` merges in as
`avatar_url` — so avatars exist for players only.

## Authorization — three redundant layers

Every one of them matters; don't collapse them.

1. `proxy.ts` at the repo root. In Next 16 middleware is **renamed Proxy** and
   the file must be `proxy.ts`. It only refreshes the Supabase token and rewrites
   cookies — it does no authorization, per Next's own guidance.
2. `requireAdmin()` in `lib/auth.ts`, called by `app/admin/layout.tsx` **and by
   every Server Action**. Server Actions are reachable by direct POST without
   passing through the UI, so the layout guard alone is not enough. It also
   handles the orphaned-session case (a valid JWT whose `profiles` row was
   deleted by hand).
3. Postgres RLS. `public.is_admin()` reads `profiles.role`, and the mobile
   schema already grants admins full access via that function. It has the last
   word.

Every mutation also calls `logAdminAction()` (`lib/auth.ts`), which wraps the
`log_admin_action` RPC and feeds `/admin/journal`.

### Supabase clients

- `lib/supabase/client.ts` — browser (sign-in / sign-out only).
- `lib/supabase/server.ts` — Server Components, Server Actions, Route Handlers.
  `cookies()` is async in Next ≥ 15; writes throw during Server Component render
  and are deliberately swallowed (the proxy already refreshed the token).
- `lib/supabase/service.ts` — optional `service_role` client, returns `null`
  when `SUPABASE_SERVICE_ROLE_KEY` is unset. **Only** used for permanent account
  deletion (the Auth Admin API); callers fall back to a reversible deactivation.
  There is no admin DELETE policy on `profiles`, and deleting only that row would
  leave the device's JWT valid.

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
- **No nested PostgREST embeds toward `profiles`.** `player_profiles` and
  `professional_profiles` each have *two* FKs to `profiles` (`id` and
  `status_updated_by`), which makes `profiles(...)` ambiguous. Identities are
  loaded separately via `fetchProfilesByIds()` in `lib/queries/profiles.ts`.
- **Private buckets** (`identity-documents`, `professional-documents`,
  `guardian-documents`) have no public read. The route handler
  `app/admin/documents/route.ts` mints a 5-minute signed URL against an explicit
  bucket allowlist. Public buckets use `publicStorageUrl()` from
  `lib/supabase/config.ts`.
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
- **Server Actions** live in `lib/actions/*.ts`, return a uniform
  `ActionResult = { ok, message }` (never throw for expected failures), and end
  with `revalidatePath("/admin", "layout")` so the nav's queue counters refresh.
  Client callers are `ActionButton` (bound action, optional confirm dialog) and
  `ReasonDialog` (actions needing a `status_reason` / `rejection_reason`).
- **Forms use native `<select>`** (`components/ui/native-select.tsx`) and plain
  `FormData`, not Base UI's `Select`, so no per-field client state is needed.
  Base UI's `Select` is used for filters, where the URL holds the state.
- **Enum labels** are centralized in `lib/labels.ts`: keys are the literal
  Postgres enum members (never translate them — they are what gets stored), and
  each carries a French label plus a `Tone` used by `StatusPill`. Use
  `entry()`/`label()`/`options()` rather than inlining strings.
- **UI kit**: `components/admin/*` holds the app-specific pieces (`Panel`,
  `PageHeader`, `StatCard`, `StatusPill`, `UserCell`, `DefinitionList`,
  `EmptyState`). `components/ui/*` is generated shadcn — prefer composing the
  admin pieces over restyling the primitives.
- The UI is French; comments and copy are written in French, unaccented in code.

## Design tokens

Colors and type are copied verbatim from the mobile app's
`~/ifriqiyastar/src/constants/theme.ts`: `#000000` background, `#212225`
surfaces, `#333333` borders, lime accent `#aff70f`, Nunito Sans headings,
Poppins body, 16px card radius. `<html>` is pinned to `class="dark"`; the light
palette exists in `app/globals.css` but is unused.

Chart series colors are `--viz-1` / `--viz-2`, deliberately **distinct** from
the brand accent (the accent is a state color for buttons and active tabs, not a
series identity). The pair is validated for lightness band, chroma floor,
colorblind separation and contrast against the dark card surface — re-validate
before changing it, and keep legends and numeric labels so color never carries
information alone.
