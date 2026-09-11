"use client";

import { createContext, useContext } from "react";

import type { Dictionary } from "./dictionaries";
import { DEFAULT_LOCALE, LOCALE_DIR, LOCALE_TAG, type Locale } from "./config";

/**
 * Le pendant client de `getDictionary()`.
 *
 * `next/root-params` est interdit aux composants client, donc la langue et son
 * dictionnaire descendent une seule fois depuis la mise en page de `[locale]`
 * et vivent ensuite dans un contexte. Les composants client lisent
 * `useI18n()` au lieu de recevoir leurs textes en props : la barre de
 * navigation, le carrousel et le formulaire de contact en ont tous besoin, et
 * les faire transiter par des props traverserait des composants qui n'en
 * utilisent aucun.
 */
type I18nValue = {
  locale: Locale;
  dict: Dictionary;
  dir: "ltr" | "rtl";
  intlTag: string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <I18nContext.Provider
      value={{ locale, dict, dir: LOCALE_DIR[locale], intlTag: LOCALE_TAG[locale] }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  // Un composant client rendu hors du fournisseur n'a aucun texte a afficher :
  // mieux vaut une erreur nette au developpement qu'une page vide en ligne.
  if (!value) {
    throw new Error("useI18n doit etre appele sous <I18nProvider>.");
  }
  return value;
}

export { DEFAULT_LOCALE };
export type { Locale };
