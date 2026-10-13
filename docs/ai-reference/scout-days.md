# Scout Days and evaluations

> Reference for [`../../CLAUDE.md`](../../CLAUDE.md). **Read when:** touching
> `/admin/scout-days`, the pending-event alert, the minimum-notice setting, or
> anything that reads or writes an evaluation's scores.

## The pending Scout Day alert (Oct 2026)

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

## Le preavis minimum d'un Scout Day (Oct 2026)

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


## Evaluations are scored on SIX axes, not four (Sept 2026)

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

