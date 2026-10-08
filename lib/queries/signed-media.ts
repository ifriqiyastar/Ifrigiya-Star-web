import { storagePathOf } from "@/lib/supabase/config";
import type { createClient } from "@/lib/supabase/server";

/**
 * Signe en UNE demande tous les objets d'un bucket prive affiches par une page.
 *
 * `storageUrl()` fait pointer chaque image vers `/admin/documents`, qui refait
 * un controle d'administration, signe, puis redirige : vingt lignes, vingt
 * detours, que le navigateur ne mene que quelques-uns a la fois. Ici le
 * serveur, qui a deja verifie la session pour rendre la page, demande toutes
 * les signatures d'un coup (`createSignedUrls`) et l'image pointe directement
 * sur le stockage.
 *
 * ⚠️ Les adresses signees sont gardees en memoire et reutilisees tant qu'il
 * leur reste au moins un quart d'heure. Une signature porte un jeton qui change
 * a chaque appel, et `AutoRefresh` rejoue la page toutes les 30 s : sans ce
 * cache, chaque rafraichissement changerait le `src` de toutes les vignettes,
 * et le navigateur les retelechargerait toutes les 30 s. Le cache ne sert que
 * des pages deja gardees par `requirePermission()`, et une adresse signee ne
 * donne acces qu'a l'objet qu'elle designe.
 *
 * ⚠️ **Une seule implementation, volontairement.** Elle etait ecrite pour
 * `avatars` seul ; `post-media` en avait exactement le meme besoin, et une
 * seconde copie aurait donne deux caches, deux durees et deux endroits a
 * corriger le jour ou un bucket change de regime.
 *
 * Rend une `Map` valeur stockee → adresse signee. Ce qui manque (adresse
 * externe, sentinelle `dummy/photo/url.jpg`, echec de signature) n'y est pas :
 * l'appelant retombe alors sur `storageUrl()`, qui gere ces cas — une
 * signature groupee qui echoue coute la rapidite, jamais l'image.
 */
const SIGNED_TTL = 60 * 60; // secondes
const SIGNED_MIN_LEFT = 15 * 60 * 1000; // millisecondes
const signedCache = new Map<string, { url: string; expiresAt: number }>();

export async function signStorageUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  values: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const now = Date.now();
  const toSign = new Map<string, string[]>(); // chemin → valeurs stockees

  for (const value of values) {
    if (!value) continue;
    const path = storagePathOf(bucket, value);
    if (!path) continue;
    // La cle porte le bucket : deux buckets peuvent heberger le meme chemin.
    const cached = signedCache.get(`${bucket}:${path}`);
    if (cached && cached.expiresAt - now > SIGNED_MIN_LEFT) {
      result.set(value, cached.url);
      continue;
    }
    toSign.set(path, [...(toSign.get(path) ?? []), value]);
  }

  if (!toSign.size) return result;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls([...toSign.keys()], SIGNED_TTL);
  if (error) {
    console.error(`${bucket} createSignedUrls:`, error);
    return result;
  }

  const expiresAt = now + SIGNED_TTL * 1000;
  for (const item of data ?? []) {
    if (!item.path || !item.signedUrl || item.error) continue;
    signedCache.set(`${bucket}:${item.path}`, { url: item.signedUrl, expiresAt });
    for (const value of toSign.get(item.path) ?? []) result.set(value, item.signedUrl);
  }
  return result;
}
