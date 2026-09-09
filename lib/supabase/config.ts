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
