/** Formatage francais partage par tout le back-office. */

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return DATE.format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return DATE_TIME.format(new Date(value));
}

export function formatMonth(value: string | null | undefined) {
  if (!value) return "—";
  return MONTH.format(new Date(value));
}

/**
 * Montants : la devise par defaut du projet est le TND (cf. les colonnes
 * `price_currency` / `currency`, `default 'TND'`).
 */
export function formatAmount(
  amount: number | string | null | undefined,
  currency = "TND",
) {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (value == null || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Devise non reconnue par Intl : on retombe sur un affichage neutre.
    return `${new Intl.NumberFormat("fr-FR").format(value)} ${currency}`;
  }
}

export const formatNumber = (value: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR").format(value ?? 0);

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

/** Date relative courte ("il y a 3 j"), pour les files d'attente. */
export function timeAgo(value: string | null | undefined) {
  if (!value) return "—";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "a l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `il y a ${days} j`;
  return formatDate(value);
}
