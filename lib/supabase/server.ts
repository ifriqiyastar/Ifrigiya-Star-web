import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { requireSupabaseEnv } from "./config";

/**
 * Client Supabase pour Server Components, Server Actions et Route Handlers.
 *
 * `cookies()` est asynchrone depuis Next 15, d'ou le `await` ici. En rendu de
 * Server Component l'ecriture de cookies est interdite : `setAll` echoue alors
 * avec une exception qu'on avale volontairement — le rafraichissement du token
 * est deja assure par `proxy.ts`, qui tourne avant le rendu.
 */
export async function createClient() {
  const { url, key } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appele depuis un Server Component : ignore (cf. commentaire ci-dessus).
        }
      },
    },
  });
}
