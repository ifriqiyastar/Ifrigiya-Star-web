import type { Metadata } from "next";

import { NotFoundView } from "@/components/site/not-found-view";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

/**
 * La 404 levee par un `notFound()` **a l'interieur** du site public — par
 * exemple `getLocale()` sur une langue inconnue.
 *
 * Les adresses qui ne correspondent a aucune route, elles, ne passent pas
 * par ici : la racine de ce depot etant un segment dynamique
 * (`app/[locale]/layout.tsx`), Next n'a pas de mise en page statique ou
 * accrocher une 404 globale, et rend ce fichier dans un document d'erreur nu
 * — sans `<html lang>`, sans `dir`, sans polices, et sans aucun HTML rendu
 * par le serveur. C'est le cas que la doc de `not-found.js` renvoie
 * explicitement a `global-not-found.js`, et c'est `app/global-not-found.tsx`
 * qui les sert.
 */
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: dict.notFound.metaTitle,
    description: dict.notFound.metaDescription,
  };
}

export default async function SiteNotFound() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return <NotFoundView dict={dict} locale={locale} />;
}
