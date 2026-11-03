# Admin write privileges — when Postgres refuses an administrator

> Reference for [`../../CLAUDE.md`](../../CLAUDE.md). **Read when:** a gesture
> fails with `42501`, or you are adding a mutation that writes a column the
> mobile repo revoked. The four authorization layers themselves are in the root
> `CLAUDE.md`; this file is the incident and the remedy.

## Validating a dossier was refused by Postgres (Oct 2026)

Reported from the screen itself: *« Privilege Postgres manquant (GRANT) … Detail
Postgres : permission denied for table player_profiles »*. Every validation
gesture was dead — "Valider le compte", "Refuser", "Demander des pieces", the
bulk validation on `/admin/validations/joueurs`, the professional queue, and
step 2 of "Lever la suspension".

⚠️⚠️ **Mobile migration `0050` is the cause, and it is right.** It revoked
`update` on both profile tables from `authenticated` and re-granted the form's
columns one by one, deliberately leaving out `status`, `status_reason`,
`status_updated_by`, `status_updated_at` and `ranking_score` — without that, a
player ran `update player_profiles set status = 'valide' where id = auth.uid()`
and validated themselves, which makes the §6.1 manual review decorative. But a
column privilege only looks at the **Postgres role**, and an administrator's
session is an `authenticated` session like any other. 0050 concluded "those
columns belong to the back-office, which uses `service_role`" — this
back-office does not, and must not: `service_role` makes `auth.uid()` null, so
`status_updated_by` would stay empty and the decision untraceable. It is the
same scoping mistake `0079` had to repair after `0073`: a privilege withdrawn
on the evidence of the mobile repo alone, when two apps share this database.

`supabase/migrations/202610050001_admin_profile_status.sql` adds
`admin_set_profile_status(uuid[], text, text, boolean)` — the remedy of 0042
and 0044, a `security definer` function that checks `is_admin()` itself. Things
worth knowing:

- **One function for both tables and for the batch.** The four call sites
  shared one rule ("clear the reason when approving") that four RPCs would let
  drift. It takes an **array**, resolves the table from `profiles.role`, and
  returns **the ids actually modified** — PostgREST does not fail an update
  that touched no row, so the screen would otherwise announce "profil valide"
  with nothing changed. `writeProfileStatus()` in `lib/actions/users.ts` is its
  only caller.
- ⚠️ **`suspendu` is refused by the function.** Suspending also cuts
  `profiles.is_active`, which only `admin_set_account_active()` (0044) does;
  writing the status alone leaves the "suspended but active" hybrid the account
  screen already describes as an anomaly.
- **It falls back to the direct update on `PGRST202`**, so an installation
  without 0050 keeps working — same shape as hiding preferring
  `admin_set_content_hidden`. If that fallback then hits `42501`,
  `describeStatusError()` names *this* migration rather than the generic
  "needs a security definer function" copy.
- Verified on a throwaway Postgres reproducing 0050's grants: the reported
  error reproduced first (the witness), then 12 assertions — approval,
  rejection with a trimmed reason, `status_updated_by` stamped from
  `auth.uid()`, the batch skipping already-decided rows, an unknown id
  returning `{}` instead of a false success, a blank reason stored as null,
  and the refusals (ordinary player, `suspendu`, unknown status, `anon`) — plus
  the two controls that 0050's revoke still holds for a user and that what a
  player *may* write still works. Migration replayed twice.


## « fetch failed » faisait dire a la garde que le compte n'existait pas (Nov 2026)

Remonte par la console du serveur de dev :
`admin_guard: "TypeError: fetch failed"` depuis `loadAdminGuard`, sur le
rendu de `AdminLayout`. Rien de casse cote base : sonde faite au meme moment,
DNS en 66 ms, connexion en 0,5 s, et `admin_guard` repond `42501` a un appel
anonyme — donc la fonction est bien semee. C'est le lien qui avait saute.

⚠️⚠️ **Le defaut n'est pas la panne, c'est ce que le code en concluait.**
`loadAdminGuard()` rendait `null` pour *toute* erreur, et `null` veut dire
« reprends le chemin long ». Ce chemin relit `profiles` **sur le meme lien**,
echoue pareil, et sa branche d'echec est
`redirect("/connexion?erreur=compte-introuvable")` : un administrateur se
retrouvait deconnecte, avec pour explication que son compte n'existe pas,
parce que le reseau avait coupe une seconde.

**Les deux erreurs se distinguent par leur code, et la forme a ete verifiee
contre le vrai client, pas supposee** (`@supabase/supabase-js`, un hote qui ne
resout pas contre le projet reel) :

| | `code` | `message` |
|---|---|---|
| transport (hors ligne, lien coupe) | `""` | `TypeError: fetch failed` |
| PostgREST / Postgres | `42501` | `permission denied for function admin_guard` |

Une erreur PostgREST porte **toujours** un code — un SQLSTATE ou un `PGRST…`.
`isTransportFailure()` (`lib/auth.ts`) est donc `Boolean(error) && !error.code`.

- Une **fonction absente** se degrade a l'ouverture : c'est la regle du depot,
  elle vaut pour une migration non appliquee.
- Un **lien coupe** ne se degrade pas : il n'autorise aucune conclusion, ni
  sur le role du compte ni sur son existence. La garde jette desormais, avec
  une phrase sans identifiant technique, et `app/[locale]/admin/error.tsx`
  l'affiche avec son bouton « reessayer ».
- ⚠️ Le test est pose **aux deux endroits** : dans `loadAdminGuard()` et dans
  la relecture de `profiles`, la garde rapide ayant pu rendre `null` pour une
  raison legitime avant que la base cesse de repondre.
- ⚠️ Ce que cela ne couvre pas : `AdminLayout` est la mise en page **du meme
  segment** que `error.tsx`, qui ne rattrape donc pas sa propre couche. Une
  panne pendant le rendu du layout remonte au-dessus ; dans un Server Action,
  en revanche, `ActionButton` rattrape le rejet et affiche une alerte — la ou
  il envoyait l'administrateur sur l'ecran de connexion.
