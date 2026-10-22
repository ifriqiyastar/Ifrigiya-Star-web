/**
 * Petits utilitaires des files de validation, sortis de la page unique quand
 * elle a ete separee en quatre routes.
 */
/** Taille d'une page de file. */
// Huit lignes par page (demande client) : les files du back-office se
// lisent surtout sur telephone, ou chaque ligne est une rangee compacte de
// deux lignes de texte — vingt d'entre elles faisaient une page qu'on ne
// parcourt plus, on la fait defiler.
export const PAGE_SIZE = 8;

/**
 * Les etats qu'une file de validation peut lister.
 *
 * ⚠️ `pending` porte la valeur attendue **par la table** : les deux tables de
 * profil disent `en_attente_validation` (enum `player_profile_status`), les
 * deux tables de pieces disent `en_attente`. Les confondre rendait une file
 * vide sans erreur — PostgREST n'a rien a redire a un statut qui n'existe
 * pas, il ne trouve simplement aucune ligne.
 */
export type ValidationScope = "profile" | "document";

export const VALIDATION_PENDING = {
  profile: "en_attente_validation",
  document: "en_attente",
} as const;

/**
 * L'etat demande, ramene a une valeur que la table connait. Tout le reste —
 * y compris une valeur inventee dans l'URL — retombe sur « en attente », qui
 * reste l'etat par defaut de ces quatre ecrans : ce sont des files de travail,
 * elles s'ouvrent sur ce qui attend.
 */
export function validationStatus(scope: ValidationScope, etat?: string) {
  const allowed: readonly string[] =
    scope === "profile"
      ? ["en_attente_validation", "valide", "refuse", "incomplet", "suspendu"]
      : ["en_attente", "valide", "refuse"];
  return etat && allowed.includes(etat) ? etat : VALIDATION_PENDING[scope];
}

/** Identifiant impossible : evite un `in ()` invalide quand la file est vide. */
export const EMPTY_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Les colonnes ou la recherche de chaque file cherche le terme tape.
 *
 * Elles sont ici, et non dans la page, parce que l'export CSV de l'ecran doit
 * chercher dans exactement les memes : un export annonce « avec les filtres de
 * l'ecran » qui ne filtre pas comme lui est un piege. L'echappement est celui
 * de `orSearchClause()` — jamais une interpolation directe.
 */
export const PLAYER_SEARCH_COLUMNS = [
  "first_name",
  "last_name",
  "current_club",
  "nationality",
] as const;

/** Idem pour la file des comptes professionnels. */
export const PRO_SEARCH_COLUMNS = [
  "contact_full_name",
  "organization_name",
  "city",
] as const;

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

