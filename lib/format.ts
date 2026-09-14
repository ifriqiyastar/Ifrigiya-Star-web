import { DEFAULT_ADMIN_LOCALE, LOCALE_TAG, type AdminLocale } from "@/lib/i18n/config";

/**
 * Formatage partage par tout le back-office, dans la langue de l'ecran.
 *
 * Les instances `Intl` sont **construites une fois par langue** et mises en
 * cache : `new Intl.DateTimeFormat()` est couteux, et une page de tableau en
 * appelle plusieurs centaines de fois.
 *
 * Comme `makeLabels()`, les fonctions sont liees une fois par module :
 *
 *   const { formatDate, formatAmount } = makeFormat(locale);
 *
 * de sorte que les appels gardent la forme qu'ils avaient quand le
 * back-office etait monolingue.
 *
 * Les quelques mots que ces fonctions produisent (« il y a 3 j », « moins
 * d'une minute ») vivent ici et non dans `messages/admin/*.json` : ce sont des
 * primitives de formatage, comme les libelles d'enums de `lib/labels.ts`, et
 * `lib/format.ts` est importe par des modules qui n'ont aucune raison de
 * charger un dictionnaire d'ecran.
 */

const RELATIVE = {
  fr: {
    now: "a l'instant",
    minutes: (n: number) => `il y a ${n} min`,
    hours: (n: number) => `il y a ${n} h`,
    days: (n: number) => `il y a ${n} j`,
    underMinute: "moins d'une minute",
    durationMinutes: (n: number) => `${n} min`,
    durationHours: (n: number) => `${n} h`,
    durationDays: (n: number) => `${n} j`,
  },
  en: {
    now: "just now",
    minutes: (n: number) => `${n} min ago`,
    hours: (n: number) => `${n} h ago`,
    days: (n: number) => `${n} d ago`,
    underMinute: "less than a minute",
    durationMinutes: (n: number) => `${n} min`,
    durationHours: (n: number) => `${n} h`,
    durationDays: (n: number) => `${n} d`,
  },
} as const;

type Formatters = {
  date: Intl.DateTimeFormat;
  dateTime: Intl.DateTimeFormat;
  month: Intl.DateTimeFormat;
  shortDay: Intl.DateTimeFormat;
  number: Intl.NumberFormat;
};

const cache = new Map<AdminLocale, Formatters>();

function intl(locale: AdminLocale): Formatters {
  const cached = cache.get(locale);
  if (cached) return cached;

  const tag = LOCALE_TAG[locale];
  const built: Formatters = {
    date: new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", year: "numeric" }),
    dateTime: new Intl.DateTimeFormat(tag, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    month: new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }),
    shortDay: new Intl.DateTimeFormat(tag, { day: "2-digit", month: "short" }),
    number: new Intl.NumberFormat(tag),
  };
  cache.set(locale, built);
  return built;
}

export function makeFormat(locale: AdminLocale = DEFAULT_ADMIN_LOCALE) {
  const f = intl(locale);
  const words = RELATIVE[locale];

  function formatDate(value: string | null | undefined) {
    if (!value) return "—";
    return f.date.format(new Date(value));
  }

  /** Jour et mois abrege, pour les cartouches ou la date est secondaire. */
  function formatShortDay(value: string | null | undefined) {
    if (!value) return "—";
    return f.shortDay.format(new Date(value));
  }

  function formatDateTime(value: string | null | undefined) {
    if (!value) return "—";
    return f.dateTime.format(new Date(value));
  }

  function formatMonth(value: string | null | undefined) {
    if (!value) return "—";
    return f.month.format(new Date(value));
  }

  /**
   * Montants : la devise par defaut du projet est le TND (cf. les colonnes
   * `price_currency` / `currency`, `default 'TND'`).
   */
  function formatAmount(amount: number | string | null | undefined, currency = "TND") {
    const value = typeof amount === "string" ? Number(amount) : amount;
    if (value == null || Number.isNaN(value)) return "—";
    try {
      return new Intl.NumberFormat(LOCALE_TAG[locale], {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      // Devise non reconnue par Intl : on retombe sur un affichage neutre.
      return `${f.number.format(value)} ${currency}`;
    }
  }

  const formatNumber = (value: number | null | undefined) => f.number.format(value ?? 0);

  /** Date relative courte ("il y a 3 j"), pour les files d'attente. */
  function timeAgo(value: string | null | undefined) {
    if (!value) return "—";
    const diffMs = Date.now() - new Date(value).getTime();
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return words.now;
    if (minutes < 60) return words.minutes(minutes);
    const hours = Math.round(minutes / 60);
    if (hours < 24) return words.hours(hours);
    const days = Math.round(hours / 24);
    if (days < 31) return words.days(days);
    return formatDate(value);
  }

  /**
   * Duree en clair a partir d'un nombre de millisecondes : « 14 min »,
   * « 3 h », « 2 j ». Sert aux delais moyens des files de travail, ou une
   * valeur en millisecondes ne se lit pas.
   */
  function formatDuration(ms: number) {
    const minutes = Math.round(ms / 60000);
    if (minutes < 1) return words.underMinute;
    if (minutes < 60) return words.durationMinutes(minutes);
    const hours = Math.round(minutes / 60);
    if (hours < 48) return words.durationHours(hours);
    return words.durationDays(Math.round(hours / 24));
  }

  return {
    locale,
    formatDate,
    formatShortDay,
    formatDateTime,
    formatMonth,
    formatAmount,
    formatNumber,
    timeAgo,
    formatDuration,
  };
}

/** Age revolu, calcule comme `date_part('year', age(birth_date))` en SQL. */
export function ageFromBirthDate(birthDate: string | null | undefined) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Repli en francais, pour les appelants sans langue sous la main (un export
 * declenche hors requete). Tout ce qui rend un ecran passe par
 * `makeFormat()`.
 */
const defaults = makeFormat(DEFAULT_ADMIN_LOCALE);
export const formatDate = defaults.formatDate;
export const formatShortDay = defaults.formatShortDay;
export const formatDateTime = defaults.formatDateTime;
export const formatMonth = defaults.formatMonth;
export const formatAmount = defaults.formatAmount;
export const formatNumber = defaults.formatNumber;
export const timeAgo = defaults.timeAgo;
export const formatDuration = defaults.formatDuration;
