import "server-only";

import { cookies, headers } from "next/headers";
import { locale as localeParam } from "next/root-params";

import {
  ADMIN_LOCALE_HEADER,
  ADMIN_LOCALES,
  DEFAULT_ADMIN_LOCALE,
  isAdminLocale,
  isLocale,
  LOCALE_COOKIE,
  negotiateLocale,
  toAdminLocale,
  type AdminLocale,
} from "./config";

import fr from "@/messages/admin/fr.json";
import type { AdminDictionary } from "./admin-shared";
import { makeAdminI18n } from "./admin-shared";

/**
 * Le dictionnaire du **back-office**, distinct de celui du site public
 * (`messages/*.json`).
 *
 * Deux dictionnaires plutot qu'un seul, pour deux raisons qui tiennent
 * toutes les deux au type :
 *
 * - le back-office ne parle que francais et anglais. Les fusionner obligerait
 *   `messages/ar.json` a porter les quelque six mille mots de l'administration
 *   pour satisfaire le type de reference, c'est-a-dire a traduire en arabe
 *   exactement ce que le client a demande de ne pas servir en arabe ;
 * - une page publique n'a rien a faire du vocabulaire des files de validation,
 *   et le chargement dynamique ci-dessous fait que la page d'accueil ne
 *   l'embarque jamais.
 *
 * Le francais est importe statiquement : c'est lui le **type de reference**,
 * donc toute cle absente d'`en.json` casse `npm run build`, seul verificateur
 * de types de ce depot.
 */
const dictionaries = {
  fr: async () => fr,
  en: () => import("@/messages/admin/en.json").then((m) => m.default),
} satisfies Record<AdminLocale, () => Promise<AdminDictionary>>;

export type { AdminDictionary } from "./admin-shared";
export { fill, plural } from "./admin-shared";

/**
 * La langue du back-office pour la requete courante, depuis le segment
 * `[locale]`.
 *
 * ⚠️ Server Components uniquement (`next/root-params`). Une Server Action ou
 * un Route Handler doit appeler `getRequestAdminLocale()`.
 *
 * L'arabe retombe sur le francais au lieu de finir en 404 : `proxy.ts` en
 * detourne deja les URL, mais un rendu declenche autrement — une action
 * revalidee, un lien interne forge — ne doit pas casser la page pour autant.
 */
export async function getAdminLocale(): Promise<AdminLocale> {
  const value = await localeParam();
  if (!value || !isLocale(value)) return DEFAULT_ADMIN_LOCALE;
  return toAdminLocale(value);
}

export async function getAdminDict(): Promise<AdminDictionary> {
  return dictionaries[await getAdminLocale()]();
}

export async function getAdminI18n() {
  const locale = await getAdminLocale();
  return makeAdminI18n(locale, await dictionaries[locale]());
}

export async function getRequestAdminI18n() {
  const locale = await getRequestAdminLocale();
  return makeAdminI18n(locale, await dictionaries[locale]());
}

/**
 * La langue d'une **Server Action** ou d'un **Route Handler**, ou
 * `next/root-params` est interdit : il n'y a pas de segment de route a lire,
 * seulement la requete.
 *
 * Meme ordre de priorite que le proxy, moins l'URL : le cookie de preference
 * d'abord, la negociation `Accept-Language` ensuite. Une preference arabe
 * retombe sur le francais, comme partout ailleurs sous `/admin`.
 *
 * Cela compte pour les messages d'erreur : une action rendue depuis un ecran
 * anglais doit repondre en anglais, sinon le premier refus de la base fait
 * surgir une phrase francaise au milieu d'un formulaire traduit.
 */
export async function getRequestAdminLocale(): Promise<AdminLocale> {
  const requestHeaders = await headers();
  const routeLocale = requestHeaders.get(ADMIN_LOCALE_HEADER);
  if (routeLocale && isAdminLocale(routeLocale)) return routeLocale;
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (cookieValue && isAdminLocale(cookieValue)) return cookieValue;
  if (cookieValue && isLocale(cookieValue)) return toAdminLocale(cookieValue);
  return toAdminLocale(negotiateLocale(requestHeaders.get("accept-language")));
}

export async function getRequestAdminDict(): Promise<AdminDictionary> {
  return dictionaries[await getRequestAdminLocale()]();
}

export { ADMIN_LOCALES, DEFAULT_ADMIN_LOCALE, type AdminLocale };
