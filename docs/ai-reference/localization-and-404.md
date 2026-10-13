# Locales, translated mockups, and the 404 page

> Reference for [`../../CLAUDE.md`](../../CLAUDE.md). **Read when:** adding or
> changing a locale, showing an app screenshot, or touching 404 / `proxy.ts`
> locale resolution.

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
