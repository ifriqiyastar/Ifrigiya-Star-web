/**
 * Ce que partagent la lecture serveur (`lib/queries/scout-day-alert.ts`) et
 * l'alerte cote navigateur (`components/admin/scout-day-alert.tsx`). Aucun
 * import ici : un composant client ne doit rien tirer qui atteigne
 * `next/headers` (voir le dernier cas de `tests/admin-i18n.test.cjs`).
 */

/** Un Scout Day soumis par un professionnel, en attente d'un super admin. */
export type PendingScoutDay = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  location: string | null;
  capacity: number | null;
  is_paid: boolean | null;
  price_amount: number | null;
  price_currency: string | null;
  /** Ecrit par le trigger de la migration mobile 0040 au passage en attente. */
  submitted_at: string | null;
  organizer: string | null;
};

/** Au-dela, l'alerte renvoie vers la liste : elle n'est pas un ecran. */
export const ALERT_LIMIT = 10;
