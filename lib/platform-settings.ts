/**
 * Bornes du preavis minimum d'un Scout Day, partagees par le formulaire
 * (composant client), le Server Action et la contrainte Postgres
 * `chk_scout_day_min_notice_days`.
 *
 * Ce module n'importe rien, et c'est voulu : un composant client ne peut pas
 * tirer `lib/actions/*` ni `lib/queries/*` sans embarquer `server-only` —
 * meme raison que `lib/scout-day-alert.ts`.
 */
export const SCOUT_DAY_NOTICE_MIN = 0;
export const SCOUT_DAY_NOTICE_MAX = 365;
