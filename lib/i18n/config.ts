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
export const ADMIN_LOCALE_HEADER = "x-ifriqiya-admin-locale";

/**
 * La langue que `proxy.ts` a resolue pour la requete courante.
 *
 * Elle n'existe que pour `app/global-not-found.tsx` : cette page court-circuite
 * la mise en page — donc le segment `[locale]`, donc `next/root-params` — et
 * n'a pas non plus d'URL fiable a lire, puisque l'adresse demandee est
 * justement fausse. Sans cet en-tete, `/ar/page-inconnue` repondait une 404 en
 * francais a qui n'avait pas de preference arabe, alors que partout ailleurs
 * le prefixe d'URL l'emporte sur le cookie.
 */
export const SITE_LOCALE_HEADER = "x-ifriqiya-locale";

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

/**
 * Le code court affiche sur le declencheur du selecteur.
 *
 * Les trois sont des codes ISO latins, y compris pour l'arabe : « ع » n'est
 * pas un code, c'est une lettre, et melanger deux abreviations ISO avec un
 * caractere arabe isole donnait trois choses de nature differente alignees
 * comme si elles etaient comparables. Le nom dans sa propre ecriture —
 * العربية — est ce que le menu affiche, la ou il est reellement lu.
 */
export const LOCALE_SHORT: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
  ar: "AR",
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

/**
 * Les langues du **back-office**, qui ne sont pas celles du site public.
 *
 * Le tableau de bord ne parle que francais et anglais. L'arabe reste servi sur
 * le site public — c'est la langue d'une partie du public vise — mais il a ete
 * retire de l'administration a la demande du client, et le retirer a moitie
 * aurait ete pire que de le garder : un ecran d'administration en arabe
 * signifie miroiter en RTL des tableaux a sept colonnes, des rails de dossier
 * et des graphiques, puis maintenir cette traduction a chaque geste metier
 * ajoute. Une seule liste ici, et le reste du code s'y conforme.
 */
export const ADMIN_LOCALES = ["fr", "en"] as const;

export type AdminLocale = (typeof ADMIN_LOCALES)[number];

export const DEFAULT_ADMIN_LOCALE: AdminLocale = "fr";

export function isAdminLocale(value: string): value is AdminLocale {
  return (ADMIN_LOCALES as readonly string[]).includes(value);
}

/**
 * Ramene n'importe quelle langue du site a une langue du back-office.
 *
 * Concretement : l'arabe retombe sur le francais, la langue de reference du
 * cahier des charges. Le repli est volontairement **silencieux** — quelqu'un
 * qui lit le site en arabe et ouvre l'administration doit y entrer, pas se
 * heurter a un message d'erreur.
 */
export function toAdminLocale(locale: Locale): AdminLocale {
  return isAdminLocale(locale) ? locale : DEFAULT_ADMIN_LOCALE;
}

/**
 * Vrai pour les chemins servis en francais/anglais uniquement : le
 * back-office et l'ecran de connexion qui y mene. Le prefixe de langue est
 * deja retire quand cette fonction est appelee depuis le proxy.
 */
export function isAdminPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    // L'ecran de connexion est la porte du back-office et rien d'autre : le
    // site public n'y renvoie nulle part, seules la deconnexion et la garde
    // `requireAdmin()` y menent. Le laisser hors de la regle affichait une
    // page arabe a qui venait de se faire deconnecter d'une administration
    // qui, elle, ne parle que francais et anglais.
    pathname === "/connexion" ||
    pathname.startsWith("/connexion/")
  );
}

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
 * L'image de partage (WhatsApp, X, LinkedIn...) de la langue donnee —
 * `public/og/{fr,en,ar}.png`. Ce ne sont **pas** des `localePath()` : ce sont
 * de simples fichiers statiques, jamais prefixes par la langue de l'URL.
 *
 * Pre-rendues une fois (voir `docs/og-image.md`) plutot que generees a la
 * volee par `next/og` : dans ce projet, `ImageResponse` ignore silencieusement
 * les polices personnalisees (satori retombe sur sa police par defaut sans
 * erreur), quel que soit le rasteriseur (sharp ou resvg) — bogue confirme,
 * pas une limitation qu'on pourrait contourner par la config.
 */
export function ogImagePath(locale: Locale): string {
  return `/og/${locale}.png`;
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

/**
 * Lit la preference explicite, ou `null` quand il n'y en a pas — c'est-a-dire
 * le mode « Automatique ».
 *
 * Cote navigateur uniquement : elle sert a l'ecran Parametres, qui doit
 * distinguer « j'ai choisi le francais » de « je suis en automatique et
 * l'automatique donne le francais ». Les deux rendent la meme page, seul le
 * cookie les separe, et le serveur ne peut donc pas trancher sans faire
 * diverger l'hydratation.
 */
export function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`),
  );
  const value = match?.[1];
  return value && isLocale(value) ? value : null;
}
