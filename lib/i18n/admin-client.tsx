"use client";

import { createContext, useContext, useMemo } from "react";

import type { AdminDictionary } from "./admin-shared";
import { fill, plural } from "./admin-shared";
import { makeAdminI18n } from "./admin-shared";
import fr from "@/messages/admin/fr.json";
import { DEFAULT_ADMIN_LOCALE, type AdminLocale } from "./config";
import { makeLabels, type Labels } from "@/lib/labels";

/**
 * Le pendant client de `getAdminDict()`.
 *
 * `next/root-params` est interdit aux composants client, donc la langue et le
 * dictionnaire descendent une seule fois depuis `app/[locale]/admin/layout.tsx`
 * et vivent ensuite dans un contexte. Les faire transiter par des props
 * traverserait des composants qui n'en utilisent aucun — le bandeau, le rail,
 * les dialogues de decision, les formulaires.
 *
 * Le contexte porte aussi `labels`, les libelles d'enums deja lies a la
 * langue : un formulaire qui remplit un `<select>` de statuts a besoin des
 * deux, et les separer ferait lire la langue a deux endroits.
 */
type AdminI18nValue = {
  locale: AdminLocale;
  dict: AdminDictionary;
  labels: Labels;
  fill: typeof fill;
  plural: typeof plural;
};

const AdminI18nContext = createContext<AdminI18nValue | null>(null);

export function AdminI18nProvider({
  locale,
  dict,
  children,
}: {
  locale: AdminLocale;
  dict: AdminDictionary;
  children: React.ReactNode;
}) {
  const value = useMemo<AdminI18nValue>(
    () => ({ locale, dict, labels: makeLabels(locale), fill, plural }),
    [locale, dict],
  );

  return <AdminI18nContext.Provider value={value}>{children}</AdminI18nContext.Provider>;
}

export function useAdminI18n(): AdminI18nValue {
  const value = useContext(AdminI18nContext);
  // Un composant client rendu hors du fournisseur n'a aucun texte a afficher :
  // mieux vaut une erreur nette au developpement qu'un ecran vide en ligne.
  if (!value) {
    throw new Error("useAdminI18n doit etre appele sous <AdminI18nProvider>.");
  }
  return value;
}

/**
 * Variante tolerante, pour les deux ecrans qui peuvent se rendre **hors** du
 * fournisseur : `error.tsx` et `not-found.tsx`.
 *
 * Une limite d'erreur ne capture pas les erreurs de sa propre mise en page —
 * si `admin/layout.tsx` echoue, c'est celle du niveau au-dessus qui rend, sans
 * `AdminI18nProvider`. `useAdminI18n()` y jetterait « doit etre appele sous
 * <AdminI18nProvider> », masquant l'erreur reelle derriere la sienne. Le repli
 * est le francais, langue de reference du projet.
 */
export function useAdminI18nSafe(): AdminI18nValue {
  const value = useContext(AdminI18nContext);
  return value ?? FALLBACK;
}

export function useAdminTranslations() {
  const { locale, dict } = useAdminI18nSafe();
  return useMemo(() => makeAdminI18n(locale, dict), [locale, dict]);
}

const FALLBACK: AdminI18nValue = {
  locale: DEFAULT_ADMIN_LOCALE,
  dict: fr,
  labels: makeLabels(DEFAULT_ADMIN_LOCALE),
  fill,
  plural,
};

export { DEFAULT_ADMIN_LOCALE };
export type { AdminLocale, AdminDictionary };
