import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Depuis Next 16 le Middleware s'appelle **Proxy** et le fichier doit etre
 * `proxy.ts` a la racine (cf. node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
 *
 * Son unique role ici est de rafraichir le token Supabase et de reecrire les
 * cookies sur la reponse. L'autorisation reelle n'est PAS faite ici — la doc
 * Next le deconseille explicitement — mais dans `requireAdmin()`, cote serveur,
 * a chaque page et chaque Server Action, et in fine par le RLS Postgres
 * (`public.is_admin()`).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Appel volontaire : c'est lui qui declenche le refresh du token expire.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
