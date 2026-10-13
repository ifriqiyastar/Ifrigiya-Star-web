# Layout, design tokens, the mockups, and responsive measurement

> Reference for [`../../CLAUDE.md`](../../CLAUDE.md). **Read when:** restyling an
> admin screen, editing `app/globals.css`, following one of the client's
> September 2026 mockups, or investigating a "it isn't responsive" report.

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


## The September 2026 mockups

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

## The moderation search bar, and the 21-pixel dropdown (Sept 2026)

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

### How to re-run that measurement

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

