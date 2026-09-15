import type { Metadata } from "next";
import { cookies, headers } from "next/headers";

import "./globals.css";
import { NotFoundView } from "@/components/site/not-found-view";
import { FONT_CLASSNAMES } from "@/lib/fonts";
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_DIR,
  negotiateLocale,
  SITE_LOCALE_HEADER,
  type Locale,
} from "@/lib/i18n/config";
import { getDictionaryFor } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * La 404 des adresses qui ne correspondent a **aucune** route.
 *
 * POURQUOI CE FICHIER PLUTOT QU'UN SIMPLE `not-found.tsx`. Next ne sert de
 * 404 globale que depuis `app/not-found.tsx`, qui doit se rendre dans une
 * mise en page racine — or la racine de ce depot est un segment dynamique
 * (`app/[locale]/layout.tsx`), exactement le cas que la doc de `not-found.js`
 * designe comme impossible a composer et renvoie ici
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md).
 * Avec `not-found.tsx` seul, `/adresse-inconnue` repondait bien 404 mais
 * rendait un document `__next_error__` : corps vide cote serveur, pas de
 * `dir="rtl"` en arabe, pas de classe `dark`, pas de polices de marque.
 *
 * CE FICHIER COURT-CIRCUITE LA MISE EN PAGE, donc il doit fournir lui-meme ce
 * qu'elle fournissait : le document complet (`<html>`, `<body>`), la feuille
 * de style globale, les polices et la langue.
 *
 * La langue ne peut pas venir du segment `[locale]` — il n'y en a pas ici —
 * et l'ordre de priorite reste celui de `proxy.ts` : le prefixe d'URL
 * l'emporte, puis le cookie de preference, puis `Accept-Language`. Le prefixe
 * arrive par l'en-tete que le proxy a pose, seul endroit ou il a encore ete
 * lu ; les deux replis servent les requetes qui ne sont pas passees par lui.
 * Quelqu'un qui lit le site en arabe reste en arabe, y compris sur une
 * adresse qui n'existe pas.
 */
async function resolveLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const viaUrl = headerList.get(SITE_LOCALE_HEADER);
  if (viaUrl && isLocale(viaUrl)) return viaUrl;
  const choisi = cookieStore.get(LOCALE_COOKIE)?.value;
  if (choisi && isLocale(choisi)) return choisi;
  return negotiateLocale(headerList.get("accept-language"));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionaryFor(await resolveLocale());
  return {
    title: `${dict.notFound.metaTitle} — Ifriqiya Star`,
    description: dict.notFound.metaDescription,
  };
}

export default async function GlobalNotFound() {
  const locale = await resolveLocale();
  const dict = await getDictionaryFor(locale);

  return (
    // Les memes attributs que `app/[locale]/layout.tsx`, et pour les memes
    // raisons : `dir` porte tout le miroitage RTL, `dark` porte la palette.
    <html lang={locale} dir={LOCALE_DIR[locale]} className={cn("dark h-full antialiased", FONT_CLASSNAMES)}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <NotFoundView dict={dict} locale={locale} />
      </body>
    </html>
  );
}
