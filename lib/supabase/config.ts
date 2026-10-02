/**
 * Le projet Supabase est *le meme* que celui de l'app mobile (`~/ifriqiyastar`) :
 * memes utilisateurs `auth.users`, memes tables, memes policies RLS. Le
 * back-office n'a donc aucun schema a lui — il lit et ecrit dans les tables
 * decrites par `00_ALL_IN_ONE.sql` cote mobile, et tout son pouvoir vient du
 * fait que `public.is_admin()` renvoie `true` pour la session utilisee.
 *
 * Le `.env` de ce depot a ete copie de l'app Expo et porte donc encore les
 * noms `EXPO_PUBLIC_*` ; Next.js n'exposant au navigateur que `NEXT_PUBLIC_*`,
 * on lit les deux pour rester tolerant.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function requireSupabaseEnv(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Configuration Supabase manquante : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans .env",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };
}

/**
 * ⚠️⚠️ **LES BUCKETS DE MEDIAS NE SONT PLUS PUBLICS.** Sonde du 2026-09-24
 * contre le projet live, avec la cle anon :
 *
 *   GET  /storage/v1/object/public/avatars/__sonde__  -> NoSuchBucket
 *   POST /storage/v1/object/sign/avatars/__sonde__    -> erreur Postgres
 *
 * La seconde est celle qui tranche : Storage a atteint la base et evalue la
 * RLS, donc **le bucket existe et il est prive**. `NoSuchBucket` sur la route
 * publique ne distingue pas « absent » de « prive » — ne jamais conclure sur
 * cette sonde seule. `avatars`, `post-media`, `player-videos` et
 * `player-photos` sont tous les quatre prives (migration mobile 0051).
 *
 * `blog-media`, lui, reste **public** (`NoSuchKey`, donc il existe et il sert
 * ses URL) : c'est le bucket du site web, et rien ici ne doit le router
 * autrement.
 *
 * Consequence : toute URL construite par `publicStorageUrl()` pour un bucket
 * de medias repond 400, et l'image ne s'affiche pas. Utiliser `storageUrl()`.
 */

/**
 * Le chemin de l'objet, quelle que soit la forme stockee en base.
 *
 * Les colonnes ne sont pas homogenes, et c'est une divergence de l'app mobile,
 * pas un choix : `player_profiles.profile_photo_url` et
 * `professional_profiles.photo_url` portent une **URL publique complete**
 * (l'app les ecrit ainsi depuis le formulaire de profil), tandis que
 * `posts.media_url` et `player_videos.storage_path` portent tantot un
 * **chemin**, tantot une URL. On accepte donc les deux.
 */
export function storagePathOf(bucket: string, value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  for (const kind of ["public", "sign"]) {
    const marker = `/storage/v1/object/${kind}/${bucket}/`;
    const at = raw.indexOf(marker);
    if (at >= 0) {
      // Le jeton d'une URL signee expiree ne doit pas suivre : on resigne.
      const tail = raw.slice(at + marker.length).split("?")[0];
      return tail ? decodeURIComponent(tail) : null;
    }
  }

  // Une URL http qui ne designe pas ce bucket est une adresse externe
  // (vignette YouTube, media heberge ailleurs) : on la laisse telle quelle,
  // c'est a l'appelant de decider. `null` dirait a tort « rien a afficher ».
  if (/^https?:\/\//i.test(raw)) return null;

  // ⚠️ Les lignes anterieures au vrai televersement portent encore le chemin
  // bidon `dummy/photo/url.jpg` — meme sentinelle que le `like 'http%'` des
  // cinq fonctions SQL cote mobile. Une requete de signature dessus ne peut
  // que rendre 404.
  if (raw === "dummy/photo/url.jpg") return null;

  return raw;
}

/**
 * URL affichable d'un objet de bucket **prive**, passant par la route
 * `/admin/documents` qui signe avec la session administrateur puis redirige.
 * Convient a un `<img src>` comme a un `<a href>`.
 *
 * Rend `null` quand il n'y a rien a montrer, et **l'URL externe telle quelle**
 * quand la valeur stockee pointe ailleurs (YouTube).
 *
 * ⚠️ Cout assume : une redirection par image, chacune refaisant un controle
 * d'administration et une signature. C'est acceptable pour un back-office et
 * c'est le mecanisme deja en place pour les justificatifs ; ce n'est pas un
 * chemin a emprunter pour une page publique.
 */
export function storageUrl(bucket: string, value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  const path = storagePathOf(bucket, raw);
  if (path) return privateStorageUrl(bucket, path);
  // Adresse externe conservee (une vignette YouTube, par exemple).
  return /^https?:\/\//i.test(raw) ? raw : null;
}

/**
 * URL publique d'un objet de stockage.
 *
 * ⚠️ **Reservee aux trois buckets reellement publics** : `avatars`,
 * `player-videos` et `post-media`. Verifie contre la base le 2026-08-31 —
 * `select id, public from storage.buckets` — parce que le commentaire
 * precedent listait aussi `player-photos` et `player-cv`, qui sont **prives**
 * (le bucket des photos a ete cree a la main sans la case « public », comme le
 * note le CLAUDE.md mobile). Resultat : toutes les photos de joueur et tous
 * les CV du back-office pointaient sur une URL qui ne repond pas.
 *
 * Pour un bucket prive, utiliser `privateStorageUrl()`.
 */
export function publicStorageUrl(bucket: string, path: string | null | undefined) {
  if (!SUPABASE_URL || !path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/**
 * URL d'un objet de bucket **prive**, servie par la route `/admin/documents`
 * qui signe l'acces avec la session administrateur (5 minutes) et redirige.
 * Convient aussi bien a un `<a href>` qu'a un `<img src>` : le navigateur suit
 * la redirection.
 */
export function privateStorageUrl(bucket: string, path: string | null | undefined) {
  if (!path) return null;
  return `/admin/documents?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;
}
