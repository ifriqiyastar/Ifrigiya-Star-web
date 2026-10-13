# Storage buckets, signed URLs and media

> Reference for [`../../CLAUDE.md`](../../CLAUDE.md). **Read when:** displaying
> any image, video or document that lives in Supabase Storage, or debugging a
> picture that does not appear in the back-office.

## ⚠️⚠️ No media bucket is public any more (Sept 2026)

Reported as three separate bugs — the preview popup showed no image, "Ouvrir le
media" led nowhere, and no player or professional photo appeared anywhere in
the back-office. **One cause**: the whole admin built `/object/public/...` URLs
for buckets that migration mobile `0051` made private.

Probed against the live project, and the method matters as much as the result:

```
GET  /storage/v1/object/public/avatars/__probe__  -> NoSuchBucket
POST /storage/v1/object/sign/avatars/__probe__    -> permission denied for function is_admin
```

⚠️ **`NoSuchBucket` on the public route does NOT distinguish "absent" from
"private"** — it is the *sign* probe that settles it: a Postgres/RLS error
means Storage reached the database, so the bucket exists and is private.
`avatars`, `post-media`, `player-videos` and `player-photos` are all four
private. `blog-media` answered `NoSuchKey`, i.e. it exists **and is still
public** — it belongs to the website, and nothing here routes it differently.

The fix, in `lib/supabase/config.ts`:

- `storagePathOf(bucket, value)` normalises what the database actually holds.
  ⚠️ **The columns are not homogeneous, and that is a mobile-side divergence,
  not a choice**: `player_profiles.profile_photo_url` and
  `professional_profiles.photo_url` hold a **complete public URL**, while
  `posts.media_url` and `player_videos.storage_path` hold sometimes a path and
  sometimes a URL. Both shapes are accepted; a stale signed URL has its token
  stripped and is re-signed; `dummy/photo/url.jpg` (the pre-upload sentinel,
  the same one the five mobile SQL functions exclude with `like 'http%'`)
  yields null instead of a guaranteed 404; and an **external** address — a
  YouTube thumbnail — is returned untouched rather than swallowed.
- `storageUrl(bucket, value)` returns the `/admin/documents` URL, the route
  that already signs private buckets with the admin session and redirects.
  `avatars`, `post-media` and `player-videos` were added to its allow-list.

⚠️ **Avatars are signed at the source, in `accountAvatarUrl()`
(`lib/queries/profiles.ts`), and every reader must go through it.** `avatar_url`
feeds roughly twenty `<UserCell>` call sites; **three** different files were
computing it (`fetchProfilesByIds`, `lib/queries/users.ts`, and the
`utilisateurs/[id]` page), which is three places to fix and three to forget.
They are now one function.

- **Cost, accepted**: one redirect per image, each re-running the admin check
  and a signing round-trip. Fine for a back-office, and it is the mechanism
  already used for identity documents — but not a path for a public page.
- **Except on `/admin/utilisateurs` (Oct 2026)**, where 25 rows meant 25 of
  those detours per load. `signAvatarUrls()` (`lib/queries/profiles.ts`) signs
  the whole page in **one** `createSignedUrls` call and the `<img>` points
  straight at Storage; `accountAvatarUrl()` stays the fallback for whatever it
  did not cover (external URL, sentinel, signing failure). ⚠️ The signed URLs
  are **cached in memory** and reused while ≥ 15 min of their hour remain: a
  signature carries a fresh token every call, and `AutoRefresh` replays the
  page every 30 s, so without the cache every `src` would change and the
  browser would re-download every thumbnail twice a minute. The export route
  passes `signAvatars: false` — it shows no image. `fetchProfilesByIds(ids,
  { signAvatars: true })` offers the same thing to any screen; `/admin/scout-days`
  uses it. It is **off by default** on purpose: one extra round trip only pays
  for itself on a list of thumbnails.
- `/admin/scout-days` also ran its six reads one after another and filtered
  `q` in JavaScript over the already-paginated page (the moderation bug again).
  The reads now go out together in one `Promise.all`, and the search is an
  `ilike` inside the query through `orLikeTerm()`.
- ⚠️ **In the popup the image is a plain `<img>`, not `next/image`.** The
  source is a route that **redirects**; Next's optimizer would try to fetch the
  original itself, from a host not declared in `next.config.ts`, and 400 a
  perfectly valid image.
- `tests/storage-url.test.cjs` transpiles the real `config.ts` and runs it —
  10 assertions, including a non-null witness and **verified by mutation**
  (putting `publicStorageUrl` back makes it fail 1/10). `npm test` runs both
  suites.

⚠️ **One thing this does not settle.** The probe above ran as `anon`, and
`permission denied for function is_admin` is the 0082 failure documented in the
mobile repo: one non-executable function poisons reads of *every* bucket,
because Postgres OR-expands all permissive policies on `storage.objects`. For
`anon` that refusal is intended (0070/0071 closed it deliberately). Whether
**`authenticated`** — which is what the back-office actually uses — hits the
same wall could not be measured without an admin session. If images still do
not appear after this change, that is the next thing to check: paste
`scripts/health-check.sql` from the mobile repo and read control n° 4, then
apply `0082_storage_policy_execute.sql`.

