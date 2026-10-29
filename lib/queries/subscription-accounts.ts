import "server-only";

import { NO_PROFILE } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";

/**
 * Le registre des abonnements, vu **par compte** et non par souscription.
 *
 * POURQUOI. La liste montrait une ligne par souscription : un compte qui
 * renouvelle y apparaissait autant de fois qu'il avait souscrit, et deux de ces
 * lignes pouvaient partager l'offre, le prix et les deux dates — releve sur la
 * base de demonstration, ou « Kofi Mensah / Player — Premium / 29/10/2026 →
 * 29/10/2026 » figurait deux fois. L'ecran repond maintenant a « qui est
 * abonne ? » : un compte, une ligne, celle de sa souscription la plus recente,
 * l'historique complet etant a un clic dans la modale.
 *
 * ⚠️ LE REGROUPEMENT EST DANS LA LECTURE, PAS DANS UNE PASSE SUR LA PAGE.
 * Deduplique apres pagination, il aurait produit trois defauts d'un coup : un
 * `count` comptant les souscriptions quand le pied annonce des comptes, des
 * pages de six lignes la ou huit sont demandees, et — le pire — un compte
 * reapparaissant malgre tout d'une page a l'autre, ses souscriptions etant a
 * cheval sur la frontiere. C'est la regle du depot sur les filtres de liste,
 * pour exactement les memes raisons.
 *
 * ⚠️ PostgREST N'A PAS DE `DISTINCT ON`. Le regroupement se fait donc sur
 * l'ensemble des souscriptions qui passent les filtres, lues en **colonnes
 * d'affichage seulement** et triees du plus recent au plus ancien : la premiere
 * occurrence de chaque compte est sa souscription representative, et l'ordre
 * des comptes suit celui de ces souscriptions. Aucun aller-retour n'est ajoute
 * — c'est la meme vague que la lecture paginee qu'elle remplace.
 *
 * A quelques dizaines de milliers de souscriptions, ce balayage devra devenir
 * une fonction Postgres (`distinct on (profile_id)` avec son propre `count`),
 * sur le modele d'`admin_queue_counts()`. Tant qu'il tient, il evite une
 * migration a appliquer a la main.
 */

/**
 * Le plafond du balayage.
 *
 * Il est **annonce a l'ecran** des qu'il mord : au-dela, les comptes dont
 * toutes les souscriptions sont plus anciennes que la 5 000e disparaissent de
 * la liste, et un registre ampute presente comme complet est le defaut que
 * `lib/csv.ts` corrige du cote des exports. Meme valeur que le plafond des
 * mesures d'en-tete, pour qu'il n'y ait qu'un ordre de grandeur a retenir.
 */
export const SUBSCRIPTION_SWEEP_LIMIT = 5000;

export type SubscriptionRow = {
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

export type SubscriptionAccounts = {
  /** Une ligne par compte : sa souscription la plus recente parmi les filtrees. */
  rows: SubscriptionRow[];
  /** Nombre de **comptes** repondant aux filtres — ce que le pied annonce. */
  total: number;
  /** Vrai quand le plafond a mordu : des comptes anciens manquent. */
  truncated: boolean;
  error: { message: string } | null;
};

export async function fetchSubscriptionAccounts({
  page,
  pageSize,
  status,
  planIds,
  profileIds,
}: {
  page: number;
  pageSize: number;
  /** Filtre de statut, applique **avant** le regroupement. */
  status?: string;
  /** `null` = pas de filtre d'offre ; `[]` = filtre qui ne peut rien designer. */
  planIds?: string[] | null;
  /** Idem pour la recherche de compte, deja resolue en identifiants. */
  profileIds?: string[] | null;
}): Promise<SubscriptionAccounts> {
  const supabase = await createClient();

  let query = supabase
    .from("subscriptions")
    .select(
      "id, profile_id, plan_id, status, starts_at, ends_at, cancelled_at, auto_renew, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(SUBSCRIPTION_SWEEP_LIMIT);

  // Les filtres portent sur les souscriptions, donc avant le regroupement : un
  // compte est retenu des qu'il possede une souscription qui passe, et la ligne
  // montree est la plus recente de celles-la — pas sa derniere toutes offres
  // confondues, qui n'aurait aucun rapport avec ce qui a ete demande.
  if (status) query = query.eq("status", status);
  // Une liste vide passe par l'identifiant impossible : PostgREST refuse un
  // `in ()` vide, et laisser tomber le filtre afficherait tout l'inverse de ce
  // qui est demande.
  if (planIds) query = query.in("plan_id", planIds.length ? planIds : [NO_PROFILE]);
  if (profileIds) query = query.in("profile_id", profileIds.length ? profileIds : [NO_PROFILE]);

  const { data, error } = await query;
  const swept = (data ?? []) as SubscriptionRow[];

  // Premiere occurrence = souscription representative, l'ordre etant deja du
  // plus recent au plus ancien.
  const seen = new Set<string>();
  const accounts: SubscriptionRow[] = [];
  for (const row of swept) {
    if (seen.has(row.profile_id)) continue;
    seen.add(row.profile_id);
    accounts.push(row);
  }

  const start = (page - 1) * pageSize;
  return {
    rows: accounts.slice(start, start + pageSize),
    total: accounts.length,
    truncated: swept.length >= SUBSCRIPTION_SWEEP_LIMIT,
    error: error ? { message: error.message } : null,
  };
}
