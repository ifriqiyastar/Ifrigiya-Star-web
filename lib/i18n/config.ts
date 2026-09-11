/**
 * Les trois langues du produit, alignees sur l'app mobile
 * (`~/ifriqiyastar/src/locales`) : francais (langue de reference du cahier
 * des charges), anglais, arabe.
 *
 * Le francais n'a pas de prefixe d'URL — `/` est francais, `/en` et `/ar`
 * portent les deux autres. C'est `proxy.ts` qui reecrit `/` vers `/fr` sans
 * changer l'adresse affichee.
 */
export const LOCALES = ["fr", "en", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/**
 * Le choix explicite de l'utilisateur. `auto` — l'absence de cookie — laisse
 * la negociation `Accept-Language` decider, ce qui est le pendant web du
 * reglage « Automatique » de l'ecran Langue mobile.
 */
export const LOCALE_COOKIE = "ifriqiya-langue";

/** Un an : le choix de langue n'a aucune raison d'expirer plus tot. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Le sens d'ecriture. Contrairement a l'app mobile — qui force `allowRTL(false)`
 * parce que miroiter trente ecrans React Native positionnes au pixel serait un
 * chantier a part entiere — le web bascule vraiment en RTL : `dir="rtl"` sur
 * `<html>` suffit des lors que les classes utilitaires sont logiques
 * (`ms-`/`me-`, `ps-`/`pe-`, `text-start`) plutot que physiques.
 */
export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = {
  fr: "ltr",
  en: "ltr",
  ar: "rtl",
};

/** Le nom de la langue, ecrit dans cette langue — jamais traduit. */
export const LOCALE_LABEL: Record<Locale, string> = {
  fr: "Francais",
  en: "English",
  ar: "العربية",
};

/** L'etiquette courte du selecteur. */
export const LOCALE_SHORT: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
  ar: "ع",
};

/**
 * L'etiquette BCP 47 pour `Intl`. L'arabe est en `ar-TN` et non `ar` nu :
 * la plateforme est tunisienne, et `ar-TN` date et compte en chiffres
 * occidentaux (0-9) la ou `ar-EG` rendrait des chiffres indo-arabes.
 */
export const LOCALE_TAG: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-GB",
  ar: "ar-TN",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Construit une adresse dans une langue donnee. Le francais reste sans
 * prefixe, sinon `/en/admin`, `/ar/contact`, etc.
 */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/**
 * L'inverse : retire le prefixe de langue d'un chemin pour retrouver la route
 * « neutre ». Sert au selecteur, qui doit rester sur la page courante.
 */
export function stripLocale(pathname: string): string {
  const segments = pathname.split("/");
  if (segments.length > 1 && isLocale(segments[1])) {
    const rest = `/${segments.slice(2).join("/")}`;
    return rest === "/" ? "/" : rest.replace(/\/$/, "");
  }
  return pathname;
}

/**
 * Negocie une langue a partir d'un en-tete `Accept-Language`. Volontairement
 * minimal — pas de dependance a Negotiator pour trois langues : on lit les
 * `q`, on trie, et on prend la premiere entree dont la base correspond.
 * `fr-CA` choisit donc le francais, `ar-MA` l'arabe.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((entry) => entry.tag && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/**
 * Ecrit (ou efface) le cookie de preference de langue.
 *
 * Volontairement hors composant : affecter `document.cookie` depuis un
 * gestionnaire d'evenement fait echouer la regle « This value cannot be
 * modified » du compilateur React, qui traite l'objet global comme une valeur
 * non modifiable. Isole ici, c'est un simple effet de bord de module.
 *
 * `null` supprime le cookie — c'est le mode « Automatique » : sans cookie,
 * `proxy.ts` renegocie `Accept-Language` a chaque requete.
 */
export function writeLocaleCookie(locale: Locale | null): void {
  const base = `${LOCALE_COOKIE}=`;
  document.cookie =
    locale === null
      ? `${base}; path=/; max-age=0; samesite=lax`
      : `${base}${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}
