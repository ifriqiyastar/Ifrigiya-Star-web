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
 * URL publique d'un objet de stockage. Reservee aux buckets publics
 * (`avatars`, `player-videos`, `player-photos`, `player-cv`, `post-media`) ;
 * pour les buckets prives, passer par la route `/admin/documents` qui signe
 * l'URL avec la session administrateur.
 */
export function publicStorageUrl(bucket: string, path: string | null | undefined) {
  if (!SUPABASE_URL || !path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
