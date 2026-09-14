import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import {
  ADMIN_LOCALE_HEADER,
  DEFAULT_LOCALE,
  isAdminPath,
  isLocale,
  LOCALE_COOKIE,
  negotiateLocale,
  toAdminLocale,
} from "@/lib/i18n/config";

/**
 * Depuis Next 16 le Middleware s'appelle **Proxy** et le fichier doit etre
 * `proxy.ts` a la racine (cf. node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
 *
 * Il fait deux choses, et toujours aucune autorisation — la doc Next le
 * deconseille explicitement, et l'autorisation reelle reste dans
 * `requireAdmin()` cote serveur, a chaque page et chaque Server Action, puis
 * in fine dans le RLS Postgres (`public.is_admin()`) :
 *
 * 1. il rafraichit le token Supabase et reecrit les cookies sur la reponse ;
 * 2. il resout la langue et amene la requete sous le segment `[locale]`.
 *
 * Pour la langue, trois cas et un seul ordre de priorite :
 *
 * - l'URL porte deja `/en` ou `/ar` : elle gagne sur tout le reste, y compris
 *   sur le cookie. Sans cela un lien partage s'ouvrirait dans la langue du
 *   destinataire plutot que dans celle de l'expediteur ;
 * - sinon on lit le cookie de preference, pose par le selecteur ;
 * - sinon on negocie `Accept-Language` — c'est la detection automatique, le
 *   pendant web du reglage « Automatique » de l'ecran Langue de l'app mobile.
 *
 * Le francais n'ayant pas de prefixe, il est **reecrit** (`rewrite`) vers
 * `/fr/...` : l'adresse affichee reste `/`. Les deux autres langues sont
 * **redirigees** vers leur prefixe, pour que l'URL dise la langue et reste
 * partageable et indexable.
 */
/**
 * Tout chemin qui se termine par une extension est un fichier servi depuis
 * `public/` — video, image, police, sous-titre — et non une page.
 *
 * On teste l'extension plutot que d'en tenir la liste, parce que c'est
 * exactement une liste qui a casse : le `matcher` ci-dessous n'excluait que
 * les extensions d'images, ecrites avant que le site ne serve des videos. Les
 * `.mp4` arrivaient donc jusqu'a la resolution de langue, qui les reecrivait
 * vers `/fr/videos/...` ou les redirigeait vers `/ar/videos/...` — deux
 * chemins qui n'existent pas. Resultat : 404, et le lecteur affichait « la
 * video est momentanement indisponible ».
 */
const PUBLIC_FILE = /\.[a-zA-Z0-9]+$/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Avant tout le reste, et sans meme rafraichir la session : un fichier
  // statique n'a ni langue ni token a renouveler.
  if (PUBLIC_FILE.test(pathname)) return NextResponse.next();

  // Les webhooks ne sont pas une page : ils n'ont pas de langue, et le
  // prestataire de paiement ne suivrait de toute facon pas une redirection
  // signee. On les laisse passer intacts.
  if (pathname.startsWith("/api/")) {
    return withSupabaseSession(request, NextResponse.next({ request }));
  }

  const segments = pathname.split("/");
  const urlLocale = segments.length > 1 && isLocale(segments[1]) ? segments[1] : null;
  // Le chemin sans son prefixe de langue : c'est lui qui dit si l'on entre
  // dans le back-office, que l'adresse soit /admin, /en/admin ou /ar/admin.
  const bare = urlLocale ? pathname.slice(urlLocale.length + 1) || "/" : pathname;
  const adminPath = isAdminPath(bare);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(ADMIN_LOCALE_HEADER);

  // Le back-office ne parle pas arabe. Plutot que de rendre une page a moitie
  // traduite, on **retire le prefixe** et on laisse la branche ci-dessous
  // choisir entre francais et anglais : rediriger directement vers /fr/admin
  // figerait la langue, alors que l'administrateur a peut-etre choisi
  // l'anglais. Retirer le prefixe ne peut pas boucler, puisque cette meme
  // branche force ensuite une langue du back-office.
  if (urlLocale && adminPath && toAdminLocale(urlLocale) !== urlLocale) {
    const target = request.nextUrl.clone();
    target.pathname = bare;
    return NextResponse.redirect(target);
  }

  if (!urlLocale) {
    const cookieValue = request.cookies.get(LOCALE_COOKIE)?.value;
    const negotiated =
      cookieValue && isLocale(cookieValue)
        ? cookieValue
        : negotiateLocale(request.headers.get("accept-language"));
    // Sous /admin, une preference arabe retombe sur le francais sans que le
    // cookie soit touche : le site public la retrouve intacte en sortant.
    const preferred = adminPath ? toAdminLocale(negotiated) : negotiated;

    if (preferred !== DEFAULT_LOCALE) {
      const target = request.nextUrl.clone();
      target.pathname = `/${preferred}${pathname === "/" ? "" : pathname}`;
      return NextResponse.redirect(target);
    }

    // Francais : on reecrit sans toucher a l'adresse affichee.
    const rewritten = request.nextUrl.clone();
    rewritten.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
    if (adminPath) requestHeaders.set(ADMIN_LOCALE_HEADER, DEFAULT_LOCALE);
    return withSupabaseSession(request, NextResponse.rewrite(rewritten, {
      request: { headers: requestHeaders },
    }));
  }

  if (adminPath) requestHeaders.set(ADMIN_LOCALE_HEADER, toAdminLocale(urlLocale));
  return withSupabaseSession(request, NextResponse.next({
    request: { headers: requestHeaders },
  }));
}

/**
 * Rafraichit la session Supabase et reporte les cookies sur la reponse deja
 * construite (`next` ou `rewrite`). Extrait de `proxy()` parce que la
 * resolution de langue produit trois reponses differentes qui doivent toutes
 * porter les memes cookies — une redirection exceptee, qui sera de toute
 * facon rejouee par le navigateur.
 */
async function withSupabaseSession(request: NextRequest, initial: NextResponse) {
  const response = initial;

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
        // On ne recree PAS la reponse ici : `initial` peut etre une
        // reecriture vers /fr/..., et un `NextResponse.next()` nu la
        // remplacerait par un passe-plat, renvoyant la requete vers une route
        // qui n'existe pas hors du segment [locale].
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
