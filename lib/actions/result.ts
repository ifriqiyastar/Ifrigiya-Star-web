import { DEFAULT_ADMIN_LOCALE, type AdminLocale } from "@/lib/i18n/config";

/** Retour uniforme des Server Actions du back-office. */
export type ActionResult = { ok: boolean; message: string };

export const ok = (message: string): ActionResult => ({ ok: true, message });
export const fail = (message: string): ActionResult => ({ ok: false, message });

export type DbError = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

/**
 * `hint` poses par les triggers du schema (migrations 0028 et 0040).
 *
 * Le message qui les accompagne est redige **en francais dans la base**, donc
 * intraduisible depuis ici. Ces trois-la sont connus et figes, on peut donc
 * leur donner un equivalent anglais ; tout autre `hint` metier ajoute plus
 * tard passera le message brut, ce qui reste juste — simplement en francais.
 */
const BUSINESS_RULE_EN: Record<string, string> = {
  past_event_date: "The event date cannot be in the past.",
  scout_day_validation_required:
    "Only a super administrator can publish a Scout Day.",
  validation_reason_required:
    "A reason is required to send a Scout Day back to the organiser.",
};

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
 * Les messages d'erreur base de donnees, dans les deux langues.
 *
 * Le piege a eviter ici : un `42501` ne veut **pas** dire « vous n'etes pas
 * administrateur ». Toutes les pages du back-office passent par
 * `requireAdmin()`, donc quiconque voit ce message a deja `profiles.role =
 * 'admin'`. Un 42501 signifie que la *table visee* n'a pas de policy
 * autorisant cette operation depuis un client authentifie — plusieurs tables
 * du schema reservent volontairement l'ecriture au `service_role` ou a un role
 * metier precis. Le message doit donc pointer la table, pas le compte.
 *
 * Le detail Postgres brut est **conserve dans les deux langues**, et ce n'est
 * pas un oubli de traduction : c'est lui qui nomme la table dont la policy
 * manque, et c'est la seule phrase du back-office qui a le droit d'afficher un
 * identifiant technique (cf. CLAUDE.md).
 */
const COPY = {
  fr: {
    unknown: "Erreur inconnue.",
    grant: (detail: string) =>
      `Privilege Postgres manquant (GRANT), et non une policy RLS : la colonne visee a ete revoquee au role « authenticated », session administrateur comprise. Le geste doit passer par une fonction « security definer » dediee. Detail Postgres : ${detail}`,
    rls: (detail: string) =>
      `Refuse par le RLS Postgres — votre compte est bien administrateur, c'est la table visee qui n'autorise pas cette operation. Detail Postgres : ${detail}`,
    unknownColumn: (detail: string) => `Colonne inconnue en base : ${detail}`,
    generatedColumn: (detail: string) =>
      `Colonne calculee : elle est generee par Postgres et ne peut pas etre ecrite. ${detail}`,
    foreignKey: (detail: string) =>
      `Reference invalide : la ligne liee n'existe pas. ${detail}`,
    duplicate: "Cet enregistrement existe deja.",
    check: (detail: string) => `Contrainte de validation refusee par la base : ${detail}`,
    rlsGeneric:
      "Ecriture refusee par le RLS Postgres : aucune policy n'autorise cette operation pour un compte administrateur sur cette table.",
    missingRpcWithMigration: (consequence: string, migration: string, rpc: string) =>
      `${consequence} : appliquez la migration ${migration} (depot mobile ~/ifriqiyastar). Sans elle, la fonction ${rpc}() n'existe pas en base.`,
    missingRpc: (consequence: string, rpc: string) =>
      `${consequence} : la fonction ${rpc}() n'existe pas sur ce projet Supabase.`,
  },
  en: {
    unknown: "Unknown error.",
    grant: (detail: string) =>
      `Missing Postgres privilege (GRANT), not an RLS policy: the column was revoked from the "authenticated" role, the administrator session included. This action has to go through a dedicated "security definer" function. Postgres detail: ${detail}`,
    rls: (detail: string) =>
      `Refused by Postgres RLS — your account is an administrator; it is the target table that does not allow this operation. Postgres detail: ${detail}`,
    unknownColumn: (detail: string) => `Unknown column in the database: ${detail}`,
    generatedColumn: (detail: string) =>
      `Generated column: Postgres computes it and it cannot be written. ${detail}`,
    foreignKey: (detail: string) => `Invalid reference: the linked row does not exist. ${detail}`,
    duplicate: "This record already exists.",
    check: (detail: string) => `Validation constraint refused by the database: ${detail}`,
    rlsGeneric:
      "Write refused by Postgres RLS: no policy allows this operation for an administrator account on this table.",
    missingRpcWithMigration: (consequence: string, migration: string, rpc: string) =>
      `${consequence}: apply migration ${migration} (mobile repository ~/ifriqiyastar). Without it, the ${rpc}() function does not exist in the database.`,
    missingRpc: (consequence: string, rpc: string) =>
      `${consequence}: the ${rpc}() function does not exist on this Supabase project.`,
  },
} as const;

/**
 * Lie les traducteurs d'erreur a une langue, une fois par action — meme
 * principe que `makeLabels()` : les appels `describeError(error)` gardent
 * exactement la forme qu'ils avaient quand le back-office etait monolingue.
 */
export function makeErrors(locale: AdminLocale = DEFAULT_ADMIN_LOCALE) {
  const copy = COPY[locale];

  function describeError(error: DbError | null): string {
    if (!error) return copy.unknown;

    // Regles metier levees par un trigger plpgsql : le message vient de la
    // base, deja redige, et nomme la regle. Le `hint` est ce qui les distingue
    // d'un vrai refus RLS, qui porte le meme SQLSTATE 42501 et appelle une
    // tout autre explication.
    const rule = error.hint ? BUSINESS_RULE_EN[error.hint] : undefined;
    if (rule) return locale === "en" ? rule : error.message;

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
          return copy.grant(error.message);
        }
        // On reexpose le message brut de Postgres : c'est lui qui nomme la
        // table (« new row violates row-level security policy for table "x" »),
        // sans quoi le message est joli mais inexploitable pour corriger la
        // policy.
        return copy.rls(error.message);
      case "42703":
        // Colonne inexistante : le code ne correspond pas au schema deploye.
        return copy.unknownColumn(error.message);
      case "428C9":
        return copy.generatedColumn(error.message);
      case "23503":
        return copy.foreignKey(error.details ?? error.message);
      case "23505":
        return copy.duplicate;
      case "23514":
        return copy.check(error.message);
      case "P0001":
        // Exception levee par une fonction plpgsql : le texte vient de la base.
        return error.message;
      default:
        if (/row-level security/i.test(error.message)) return copy.rlsGeneric;
        return error.message;
    }
  }

  /**
   * Comme `describeError()`, mais nomme la migration quand c'est la RPC
   * elle-meme qui manque. `consequence` dit ce qui est indisponible en
   * attendant : « fonction introuvable » ne se traduit pas tout seul en « la
   * suspension de compte ne marche pas ».
   */
  function describeRpcError(error: DbError | null, rpc: string, consequence: string): string {
    if (isMissingRpc(error)) {
      const migration = RPC_MIGRATIONS[rpc];
      return migration
        ? copy.missingRpcWithMigration(consequence, migration, rpc)
        : copy.missingRpc(consequence, rpc);
    }
    return describeError(error);
  }

  return { describeError, describeRpcError };
}

/**
 * Repli en francais pour les appelants qui n'ont pas de langue sous la main.
 * Tout ce qui repond a un geste d'ecran doit passer par `makeErrors()`.
 */
const defaults = makeErrors(DEFAULT_ADMIN_LOCALE);
export const describeError = defaults.describeError;
export const describeRpcError = defaults.describeRpcError;
