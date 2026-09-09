/** Retour uniforme des Server Actions du back-office. */
export type ActionResult = { ok: boolean; message: string };

export const ok = (message: string): ActionResult => ({ ok: true, message });
export const fail = (message: string): ActionResult => ({ ok: false, message });

/** `hint` poses par les triggers du schema (migrations 0028 et 0040). */
const BUSINESS_RULE_HINTS = new Set([
  "past_event_date",
  "scout_day_validation_required",
  "validation_reason_required",
]);

/**
 * Traduit une erreur PostgREST/Postgres en message affichable.
 *
 * Le piege a eviter ici : un `42501` ne veut **pas** dire « vous n'etes pas
 * administrateur ». Toutes les pages du back-office passent par
 * `requireAdmin()`, donc quiconque voit ce message a deja `profiles.role =
 * 'admin'`. Un 42501 signifie que la *table visee* n'a pas de policy
 * autorisant cette operation depuis un client authentifie — plusieurs tables
 * du schema reservent volontairement l'ecriture au `service_role` ou a un role
 * metier precis. Le message doit donc pointer la table, pas le compte.
 */
/**
 * La migration qui **seme** chaque RPC appelee par le back-office.
 *
 * Une RPC absente remonte en `PGRST202` avec « Could not find the function
 * public.x in the schema cache » : exact, et inexploitable pour qui doit la
 * corriger. Les migrations mobiles n'etant pas appliquees par ce depot, la
 * seule information utile a l'ecran est **laquelle appliquer**.
 */
const RPC_MIGRATIONS: Record<string, string> = {
  admin_set_account_active: "0044_admin_account_state.sql",
  admin_set_account_role: "0044_admin_account_state.sql",
  admin_request_account_deletion: "0044_admin_account_state.sql",
  admin_set_content_hidden: "0042_admin_hide_content.sql",
  admin_broadcast_notification: "0046_admin_broadcast_notification.sql",
};

/** Vrai quand Postgres ne connait pas la fonction appelee. */
export function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === "PGRST202" || /could not find the function/i.test(error?.message ?? "")
  );
}

/**
 * Comme `describeError()`, mais nomme la migration quand c'est la RPC
 * elle-meme qui manque. `consequence` dit ce qui est indisponible en
 * attendant : « fonction introuvable » ne se traduit pas tout seul en « la
 * suspension de compte ne marche pas ».
 */
export function describeRpcError(
  error: { message: string; code?: string; details?: string | null; hint?: string | null } | null,
  rpc: string,
  consequence: string,
): string {
  if (isMissingRpc(error)) {
    const migration = RPC_MIGRATIONS[rpc];
    return migration
      ? `${consequence} : appliquez la migration ${migration} (depot mobile ~/ifriqiyastar). Sans elle, la fonction ${rpc}() n'existe pas en base.`
      : `${consequence} : la fonction ${rpc}() n'existe pas sur ce projet Supabase.`;
  }
  return describeError(error);
}

export function describeError(
  error: { message: string; code?: string; details?: string | null; hint?: string | null } | null,
): string {
  if (!error) return "Erreur inconnue.";

  // Regles metier levees par un trigger plpgsql : le message est deja redige
  // en francais et nomme la regle. Le `hint` est ce qui les distingue d'un
  // vrai refus RLS, qui porte le meme SQLSTATE 42501 et appelle une tout
  // autre explication.
  if (BUSINESS_RULE_HINTS.has(error.hint ?? "")) return error.message;

  switch (error.code) {
    case "42501":
      // Deux causes tres differentes partagent ce SQLSTATE, et les confondre
      // fait chercher au mauvais endroit pendant des heures :
      //
      //   « permission denied for table/column X » -> un **GRANT** manque.
      //     Plusieurs migrations (0025 sur profiles, 0033/0035 sur is_hidden)
      //     ont revoque des privileges de colonne pour empecher un
      //     utilisateur de se promouvoir ou de se demasquer. Un privilege de
      //     colonne ne regarde que le role Postgres : la session
      //     administrateur est refusee comme les autres, et le remede est une
      //     fonction `security definer`, pas une policy.
      //
      //   « violates row-level security policy » -> une **policy** manque.
      if (/permission denied for (table|column|relation)/i.test(error.message)) {
        return `Privilege Postgres manquant (GRANT), et non une policy RLS : la colonne visee a ete revoquee au role « authenticated », session administrateur comprise. Le geste doit passer par une fonction « security definer » dediee. Detail Postgres : ${error.message}`;
      }
      // On reexpose le message brut de Postgres : c'est lui qui nomme la table
      // (« new row violates row-level security policy for table "x" »), sans
      // quoi le message est joli mais inexploitable pour corriger la policy.
      return `Refuse par le RLS Postgres — votre compte est bien administrateur, c'est la table visee qui n'autorise pas cette operation. Detail Postgres : ${error.message}`;
    case "42703":
      // Colonne inexistante : le code ne correspond pas au schema deploye.
      return `Colonne inconnue en base : ${error.message}`;
    case "428C9":
      return `Colonne calculee : elle est generee par Postgres et ne peut pas etre ecrite. ${error.message}`;
    case "23503":
      return `Reference invalide : la ligne liee n'existe pas. ${error.details ?? error.message}`;
    case "23505":
      return "Cet enregistrement existe deja.";
    case "23514":
      return `Contrainte de validation refusee par la base : ${error.message}`;
    case "P0001":
      // Exception levee par une fonction plpgsql (message deja en francais).
      return error.message;
    default:
      if (/row-level security/i.test(error.message)) {
        return "Ecriture refusee par le RLS Postgres : aucune policy n'autorise cette operation pour un compte administrateur sur cette table.";
      }
      return error.message;
  }
}
