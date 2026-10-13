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

