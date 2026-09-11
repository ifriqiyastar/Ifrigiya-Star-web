import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";

import { DEFAULT_LOCALE, isLocale, LOCALE_DIR, LOCALE_TAG, type Locale } from "./config";

import fr from "@/messages/fr.json";

/**
 * Les dictionnaires. Le francais est importe statiquement parce qu'il sert
 * aussi de **type de reference** : toute cle absente d'`en.json` ou d'`ar.json`
 * devient une erreur de compilation, et `npm run build` est le seul
 * verificateur de types de ce depot.
 *
 * Les deux autres sont charges dynamiquement : une page rendue en francais
 * n'embarque jamais l'anglais ni l'arabe.
 */
const dictionaries = {
  fr: async () => fr,
  en: () => import("@/messages/en.json").then((m) => m.default),
  ar: () => import("@/messages/ar.json").then((m) => m.default),
} satisfies Record<Locale, () => Promise<Dictionary>>;

export type Dictionary = typeof fr;

/**
 * La langue de la requete courante.
 *
 * `next/root-params` la lit depuis le segment `[locale]` sans la faire
 * descendre de props en props — ce qui compte ici, ou le back-office fait
 * pres de 20 000 lignes et ou la langue est necessaire jusqu'au fond de
 * l'arbre. Elle n'est utilisable que dans un Server Component : ni client,
 * ni Server Action, ni Route Handler (cf. la doc de `next/root-params`).
 */
export async function getLocale(): Promise<Locale> {
  const value = await localeParam();
  // `proxy.ts` ne laisse passer que nos trois codes ; une URL forgee a la main
  // comme /de/admin arrive quand meme jusqu'ici et doit finir en 404 plutot
  // qu'en page a moitie traduite.
  if (!value || !isLocale(value)) notFound();
  return value;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()]();
}

/** Le sens d'ecriture de la requete courante. */
export async function getDirection(): Promise<"ltr" | "rtl"> {
  return LOCALE_DIR[await getLocale()];
}

/** L'etiquette `Intl` de la requete courante, pour dates et montants. */
export async function getIntlTag(): Promise<string> {
  return LOCALE_TAG[await getLocale()];
}

export { DEFAULT_LOCALE };
