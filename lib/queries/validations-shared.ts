/**
 * Petits utilitaires des files de validation, sortis de la page unique quand
 * elle a ete separee en quatre routes.
 */
/** Taille d'une page de file. */
export const PAGE_SIZE = 20;

/** Identifiant impossible : evite un `in ()` invalide quand la file est vide. */
export const EMPTY_ID = "00000000-0000-0000-0000-000000000000";

export function groupBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const value = String(row[key]);
    grouped.set(value, [...(grouped.get(value) ?? []), row]);
  }
  return grouped;
}

export function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[key]);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/* ------------------------------------------------------------------ joueurs */

