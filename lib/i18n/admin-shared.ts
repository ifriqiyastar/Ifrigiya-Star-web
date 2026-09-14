import type fr from "@/messages/admin/fr.json";
import { makeFormat } from "@/lib/format";
import { makeLabels } from "@/lib/labels";
import { localePath, stripLocale, type AdminLocale } from "./config";

// Types et helpers purs, utilisables sur le serveur comme dans le navigateur.
export type AdminDictionary = typeof fr;

/** Source-keyed screen copy; only application text is passed to this translator. */
export function makeAdminI18n(locale: AdminLocale, dict: AdminDictionary) {
  return {
    locale,
    t: (source: keyof AdminDictionary["screens"], values: Record<string, unknown> = {}) =>
      fill(dict.screens[source], Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, String(value)]),
      )),
    format: makeFormat(locale),
    labels: makeLabels(locale),
    path: (path: string) => localePath(locale, stripLocale(path)),
  };
}

export type AdminTranslations = ReturnType<typeof makeAdminI18n>;

/**
 * Remplit les trous `{nom}` d'un modele. Volontairement minimal : le projet
 * n'a pas d'ICU MessageFormat, et les rares pluriels sont ecrits a la main
 * dans le dictionnaire (`one` / `other`), la ou le francais et l'anglais
 * s'accordent sur la meme regle.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/**
 * Pluriel a deux formes, avec le compte injecte. Francais et anglais
 * basculent tous les deux a partir de 2 — le francais ecrit « 1 dossier »,
 * « 2 dossiers », l'anglais « 1 file », « 2 files » — donc une seule regle
 * suffit ici, et il n'y a pas lieu d'importer `Intl.PluralRules` pour ca.
 */
export function plural(
  count: number,
  forms: { one: string; other: string },
  values: Record<string, string | number> = {},
): string {
  return fill(count > 1 ? forms.other : forms.one, { count, ...values });
}
