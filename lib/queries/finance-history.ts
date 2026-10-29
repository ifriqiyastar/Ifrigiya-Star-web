import "server-only";

import { NO_PROFILE } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";

/**
 * L'historique financier des comptes affiches sur une page de liste.
 *
 * POURQUOI CET ECRAN EN A BESOIN. La liste des abonnements est un registre de
 * **souscriptions**, pas de personnes : un compte qui renouvelle y occupe
 * autant de lignes qu'il a souscrit. Rien sur la ligne ne le disait, et deux
 * souscriptions d'un meme compte peuvent partager l'offre, le prix, la date de
 * debut ET la date de fin — releve sur la base de demonstration, ou les deux
 * lignes « Kofi Mensah / Player — Premium / 29/10/2026 → 29/10/2026 » ne se
 * distinguaient que par leur pastille de statut. Repetees sans explication,
 * elles se lisent comme un defaut d'affichage.
 *
 * ⚠️ DEUX REQUETES POUR TOUTE LA PAGE, PAS DEUX PAR LIGNE. Les identifiants
 * des comptes affiches partent ensemble dans un seul `in.(…)`, et l'appel se
 * pose dans la **meme vague** que `fetchProfilesByIds()` — dont il ne depend
 * pas. Il ne coute donc aucun aller-retour supplementaire, ce qui est la
 * condition posee par le depot pour qu'une modale soit acceptable sur chaque
 * ligne d'une liste (voir `ProfilePreviewDialog`). Une lecture par ligne, elle,
 * aurait ajoute seize allers-retours a un ecran qui en paie deja 2,2 s sur
 * connexion chaude.
 */

/**
 * Le plafond de lecture, commun aux deux tables.
 *
 * Il porte sur l'ensemble des comptes de la page, pas sur un compte : il est
 * donc tres large devant ce qu'un historique reel contient. Il est **annonce
 * dans la modale** des qu'il mord, parce qu'un historique tronque presente
 * comme complet est exactement le defaut que `lib/csv.ts` corrige du cote des
 * exports.
 */
export const FINANCE_HISTORY_LIMIT = 500;

export type HistorySubscription = {
  id: string;
  profile_id: string;
  plan_id: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  cancelled_at: string | null;
  auto_renew: boolean | null;
  created_at: string | null;
};

export type HistoryPayment = {
  id: string;
  profile_id: string;
  payment_type: string;
  amount: number | null;
  currency: string | null;
  method: string | null;
  status: string;
  provider_reference: string | null;
  paid_at: string | null;
  created_at: string | null;
};

export type AccountHistory = {
  /** Du plus recent au plus ancien, comme toute file du back-office. */
  subscriptions: HistorySubscription[];
  payments: HistoryPayment[];
};

export type AccountHistories = {
  byProfile: Map<string, AccountHistory>;
  /** Vrai des que l'une des deux lectures a touche le plafond. */
  truncated: boolean;
  /** Remonte telle quelle dans la modale plutot que de vider l'ecran. */
  error: string | null;
};

const EMPTY: AccountHistory = { subscriptions: [], payments: [] };

/** L'historique d'un compte absent de la carte — jamais `undefined` a l'appel. */
export const emptyHistory = () => EMPTY;

export async function fetchAccountHistories(
  profileIds: readonly string[],
): Promise<AccountHistories> {
  const ids = [...new Set(profileIds.filter(Boolean))];
  if (!ids.length) return { byProfile: new Map(), truncated: false, error: null };

  const supabase = await createClient();

  const [subscriptions, payments] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "id, profile_id, plan_id, status, starts_at, ends_at, cancelled_at, auto_renew, created_at",
      )
      .in("profile_id", ids.length ? ids : [NO_PROFILE])
      .order("created_at", { ascending: false })
      .limit(FINANCE_HISTORY_LIMIT),
    supabase
      .from("payments")
      .select(
        "id, profile_id, payment_type, amount, currency, method, status, provider_reference, paid_at, created_at",
      )
      .in("profile_id", ids.length ? ids : [NO_PROFILE])
      // `created_at` et non `paid_at`, qui est nullable : trier sur une colonne
      // vide ferait passer les encaissements sans date devant tous les autres,
      // et c'est eux que le plafond retirerait en dernier au lieu des plus
      // anciens (meme piege que le plafond des mesures d'en-tete).
      .order("created_at", { ascending: false })
      .limit(FINANCE_HISTORY_LIMIT),
  ]);

  const byProfile = new Map<string, AccountHistory>();
  const bucket = (profileId: string) => {
    const existing = byProfile.get(profileId);
    if (existing) return existing;
    const created: AccountHistory = { subscriptions: [], payments: [] };
    byProfile.set(profileId, created);
    return created;
  };

  for (const row of (subscriptions.data ?? []) as HistorySubscription[]) {
    bucket(row.profile_id).subscriptions.push(row);
  }
  for (const row of (payments.data ?? []) as HistoryPayment[]) {
    bucket(row.profile_id).payments.push(row);
  }

  return {
    byProfile,
    truncated:
      (subscriptions.data?.length ?? 0) >= FINANCE_HISTORY_LIMIT ||
      (payments.data?.length ?? 0) >= FINANCE_HISTORY_LIMIT,
    error: subscriptions.error?.message ?? payments.error?.message ?? null,
  };
}
