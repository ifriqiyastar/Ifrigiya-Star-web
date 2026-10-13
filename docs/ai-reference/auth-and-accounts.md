# Sign-in, password reset, and an administrator's own account

> Reference for [`../../CLAUDE.md`](../../CLAUDE.md). **Read when:** touching
> `/connexion`, the captcha, a password or e-mail change, or `/admin/profil`.

## The sign-in screen must send a captcha token

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

## Resetting a password

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


## An administrator's own profile — `/admin/profil` (Oct 2026)

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

