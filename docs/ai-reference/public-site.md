# The public site at `/` — charte, hero, Scout Days, prism

> Reference for [`../../CLAUDE.md`](../../CLAUDE.md). **Read when:** touching
> anything under `components/site/`, the `.site-shell` palette, or the landing
> page's copy. Translated app screenshots and the 404 page are in
> [`localization-and-404.md`](localization-and-404.md).

## The charte graphique is the whole brief

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

## The footer and its two social accounts

**The footer carries the two official social accounts** (YouTube, Instagram —
client request, Oct 2026), as a row of two round icon links closing the brand
column, under the signature. Three things about them:

- ⚠️ **`lucide-react` v1 ships no brand icons** — they were deprecated through
  the 0.x series and removed — so the two marks are official paths written out
  in `components/site/site-footer.tsx`, in `fill-current`, the same convention
  as `AppleMark` in `store-buttons.tsx`. YouTube's play triangle is a
  **counter-wound subpath of the same `d`** — moving it into a second `<path>`
  would fill it in the plate's own colour and erase it. (The fill rule changes
  nothing: measured, `nonzero` and `evenodd` render the same image.) The two
  boxes are not the same size (20 px against 18 px) because
  YouTube's glyph is 24 wide for 17 high while Instagram's fills its square;
  at equal boxes Instagram reads bigger.
- ⚠️ **The `?si=…` of the supplied YouTube address was stripped.** It is the
  share token of whoever copied the link from the YouTube app — not part of the
  channel address — and it would attribute every arrival from the site to that
  one share.
- Icon-only links, so **`aria-label` is mandatory** (the label is translated in
  the three dictionaries, brand name kept in Latin even in Arabic) and the SVG
  is `aria-hidden`, or a screen reader announces the name twice.

## Scout Days, the second gesture, and the hero showcase

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
and `ScoutingShowcase` (beside the text from `xl`, below it under `xl`): our answer to the competitor's
"Scouting Card", in frosted glass over the hero video (client's reference, Oct
2026) — a player card in the middle, three `.site-glass` panels overlapping it
(overall gauge, "Évalué en Scout Day" — it replaced "Profil vérifié" at the
client's request, Oct 2026 — six-axis radar; a "Progression" sparkline
was removed at the client's request). The player is
**Yassine**, the fictitious testimonial character, with **his** profile from
`PRISM_PLAYERS[0]` — one face, one identity, one radar on the page. ⚠️ Those
scores are **invented on
purpose**. The pill above the name read "Exemple" until Oct 2026; at the
client's request it now reads just "Profil", so only the image's `alt`
("Exemple de fiche d'évaluation…") still says the scores are illustrative. The overall is their mean, like
`overall_score`. Never swap in a real player's scores without consent. ⚠️ Keep `opacity` < 1 off the glass's ancestors at
rest: it becomes the `backdrop-filter` root and the blur stops seeing the
video. The card is centred with `mx-auto`, not `-translate-*`, because
Tailwind v4 writes those to `translate`, which the panels' staggered entrance
uses.
Below `xl` the same showcase sits **under** the store buttons rather than
being hidden (client request, Oct 2026 — two original mobile-only treatments,
a compact card and a "recruiter viewfinder" overlay, were rejected: the client
wants the web composition itself). The hero container is `flex-col` until
`xl:flex-row`. The composition is drawn for 30rem and is shrunk whole with
`scale` by a factor `--s` set in width steps (`0.66` / `0.75` from 360 px /
`0.8` from 390 / `0.86` from 420 / `1` from 480); the outer `Reveal` reserves
`30rem × --s`. (`zoom` was used for one release and dropped: it is the less
reliable of the two on iOS Safari.) The steps make it span the full screen
width, gutters included, which is what keeps its text readable.
⚠️⚠️ **The fade-in lives on the glass itself (`.site-showcase-lift`), never on
an ancestor — not even during a transition.** It used to sit on each panel and
on the `Reveal` wrapper: for 700 ms the glass blurred nothing, then the blur
switched on at once at the end, panel by panel. On a phone, where the showcase
now appears under your thumb while scrolling instead of at load, that read as
a glitch (reported Oct 2026). An element's own opacity is applied after its
backdrop blur and does not cut it. `Reveal` is only a trigger there (its fade
is neutralised in `globals.css`), and the panels only slide. The floating
animation is limited to `xl`: three blurred panels re-rendered every frame
over a playing video is what a phone pays for during a scroll.

## The four step cards animate with the scroll

Its four step cards animate **with the scroll** (client request, Oct 2026):
each straightens up from a 3D tilt as it enters, then a lime line draws across
its top — CSS `animation-timeline: view()` (block 4b of `globals.css`), the
even card staggered on two columns; browsers without it keep `Reveal`'s fade.
⚠️ The section is `overflow-clip`, **not** `overflow-hidden`: `hidden` makes it
a scroll container, `view()` then tracks the section's own scroll — which never
moves — and the cards stay frozen. Measured: with `hidden` they were flat at
every scroll position.

## The testimonials are a sticky card stack

The testimonials are a **sticky card stack** (block 4c, Oct 2026 — a 3D
scroll entrance was tried first and rejected by the client): each card sticks
under the nav one notch lower than the previous, the next slides over it, and
the covered one recedes and darkens. Sticking is pure CSS; `CardStack` only
writes `--p`, how covered each card is, because a stuck card's own `view()`
timeline stops advancing exactly while it is being covered. A stuck card must
fit whole on screen or its name is covered unread: the mobile card is compact
for that (~550 px), and below a 41rem-high viewport the stack falls back to a
plain list.

## `ScoutDaysPrism`

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
⚠️⚠️ **Which side of a card shows is computed, not left to the browser**
(Oct 2026). In production a colleague of the client saw the cards that had gone
round show their player face **mirrored** instead of the logo:
`backface-visibility` is not honoured everywhere, and neither are its usual
patches (the property on every descendant, a back pushed 1 px behind for depth
sorting) — an engine that does not composite the scene in 3D has neither. Each
face now runs a `visibility` animation with the ring's period
(`--prism-period`), phased by `--k`, that shows the front while the card faces
the screen. The window is ±81°, not ±90°: with a 1200px perspective and a
13.86rem radius a card turns its back before it is edge-on — recompute it if
either changes (the formula is in `globals.css`). Hover and reduced motion
must pause the faces together with the ring, or they drift apart. The hover
pause is gated on `(hover: hover) and (pointer: fine)`: on a touch screen a
tap leaves a sticky `:hover`, and tapping a card froze the ring (Oct 2026).
