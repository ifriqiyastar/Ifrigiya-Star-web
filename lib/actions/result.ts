/** Retour uniforme des Server Actions du back-office. */
export type ActionResult = { ok: boolean; message: string };

export const ok = (message: string): ActionResult => ({ ok: true, message });
export const fail = (message: string): ActionResult => ({ ok: false, message });

/**
 * Traduit une erreur PostgREST en message affichable. Le cas le plus courant
 * ici est le refus par une policy RLS : la requete « reussit » mais ne touche
 * aucune ligne, ou renvoie un 42501.
 */
export function describeError(error: { message: string; code?: string } | null): string {
  if (!error) return "Erreur inconnue.";
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    return "Action refusee par la base : votre compte n'a pas les droits administrateur.";
  }
  if (error.code === "P0001") return error.message;
  return error.message;
}
