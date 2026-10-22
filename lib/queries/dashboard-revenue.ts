/**
 * La mise en forme des revenus du tableau de bord — et **rien d'autre**.
 *
 * Module neutre : il n'importe rien, ni `server-only`, ni le client Supabase,
 * ni un dictionnaire. C'est ce qui permet a `tests/dashboard-revenue.test.cjs`
 * de l'executer vraiment plutot que de raisonner sur lui, et c'est la seule
 * raison pour laquelle ces quelques fonctions ne vivent pas dans
 * `lib/queries/dashboard.ts` ni dans la page.
 */

/** Le pas de temps d'une barre du graphique de revenus. */
export type RevenueBucket = "jour" | "semaine" | "mois";

/** Un pas de temps du graphique : les deux series, et leurs transactions. */
export type RevenueSeriesRow = {
  /** Debut du pas, horodatage ISO. */
  bucket: string | null;
  abonnement: number;
  scoutDay: number;
  abonnementTx: number;
  scoutDayTx: number;
};

/**
 * Les revenus **reellement fenetres sur la periode demandee**, tels que
 * `public.admin_dashboard_counts()` les calcule.
 *
 * ⚠️⚠️ POURQUOI CE TYPE EXISTE. Jusqu'en octobre 2026 la page tirait ses
 * revenus de `public.admin_dashboard_revenue`, une vue groupee par MOIS
 * (`date_trunc('month', paid_at)`), puis ecartait en JavaScript la ligne dont
 * le PREMIER JOUR du mois tombait avant `aujourd'hui - periode`. Un selecteur
 * « 7 derniers jours » consulte le 22 d'un mois ecartait donc le mois en cours
 * tout entier et affichait zero, quels que soient les encaissements ;
 * « 30 derniers jours » ne montrait que le mois courant ; « 12 derniers mois »
 * en perdait un. Le filtre ignorait la granularite de ce qu'il filtrait.
 *
 * Le fenetrage est descendu dans la requete, a la journee, et la fenetre
 * reellement mesuree remonte avec lui (`from`) — c'est elle que l'ecran
 * annonce, pas la duree cliquee.
 */
export type PeriodRevenue = {
  bucket: RevenueBucket;
  /** Borne basse reelle de la fenetre, calee sur un pas entier. */
  from: string;
  rows: RevenueSeriesRow[];
  /** Meme duree ecoulee, juste avant `from` — pour l'evolution. */
  previousTotal: number;
  /** Paiements crees dans la fenetre, tous statuts / aboutis. */
  paymentsTotal: number;
  paymentsSucceeded: number;
};

/** Les seules cles de `admin_dashboard_counts()` qui concernent les revenus. */
export type RawRevenueKeys = {
  revenue_bucket?: string;
  revenue_from?: string;
  revenue_series?:
    | {
        bucket: string;
        abonnement: number | string | null;
        scout_day: number | string | null;
        abonnement_tx: number | string | null;
        scout_day_tx: number | string | null;
      }[]
    | null;
  revenue_previous_total?: number | string | null;
  payments_period_total?: number | string | null;
  payments_period_succeeded?: number | string | null;
};

/** Une ligne de `public.admin_dashboard_revenue` (vue mobile, par mois). */
export type MonthlyRevenueRow = {
  mois: string | null;
  payment_type: string;
  revenu_encaisse: number | null;
  nb_transactions_reussies: number | null;
};

/** Les trois pas de temps que la fonction sait rendre. */
const REVENUE_BUCKETS = new Set(["jour", "semaine", "mois"]);

/**
 * Les revenus fenetres, **ou `null`**.
 *
 * ⚠️ Le test porte sur la PRESENCE de la serie et d'une fenetre lisible, pas
 * sur leur contenu : une serie vide est une reponse legitime (une periode sans
 * encaissement), une serie absente est une base qui ne sait pas repondre —
 * fonction pas deployee, ou deployee dans une version anterieure. Confondre
 * les deux ferait annoncer « aucun revenu » a un projet qui en encaisse,
 * c'est-a-dire remettrait le defaut corrige une couche plus haut. C'est
 * exactement la lecon des deux files de finances dans
 * `admin-queue.ts` : une cle manquante n'est pas un zero.
 */
export function periodRevenueFromRow(row: RawRevenueKeys): PeriodRevenue | null {
  const series = row.revenue_series;
  const bucket = row.revenue_bucket;
  if (!series || !row.revenue_from || !bucket || !REVENUE_BUCKETS.has(bucket)) return null;

  return {
    bucket: bucket as RevenueBucket,
    from: row.revenue_from,
    rows: series.map((entry) => ({
      bucket: entry.bucket,
      abonnement: Number(entry.abonnement ?? 0),
      scoutDay: Number(entry.scout_day ?? 0),
      abonnementTx: Number(entry.abonnement_tx ?? 0),
      scoutDayTx: Number(entry.scout_day_tx ?? 0),
    })),
    previousTotal: Number(row.revenue_previous_total ?? 0),
    paymentsTotal: Number(row.payments_period_total ?? 0),
    paymentsSucceeded: Number(row.payments_period_succeeded ?? 0),
  };
}

/**
 * Le repli : les revenus mensuels de `public.admin_dashboard_revenue`, replies
 * en une ligne par mois et bornes aux douze derniers.
 *
 * ⚠️ IL N'Y A PLUS DE DECOUPE PAR PERIODE ICI, et c'est tout le correctif.
 * Cette vue ne connait que des mois ; lui appliquer une fenetre exprimee en
 * jours revenait a ecarter des mois entiers sur la foi de leur premier jour.
 * Quand `admin_dashboard_counts()` n'est pas deployee, l'ecran montre donc les
 * douze derniers mois **et l'annonce** plutot que de promettre une fenetre
 * qu'il ne sait pas decouper.
 *
 * Le nombre de transactions voyage avec le montant : les deux doivent sortir
 * des MEMES lignes, sans quoi le panier moyen divise une somme bornee par un
 * compte qui ne l'est pas — le defaut exact que portait l'ecran, ou le montant
 * etait filtre sur la periode et les transactions comptees sur tout
 * l'historique.
 */
export function monthlySeries(
  rows: MonthlyRevenueRow[] | null | undefined,
): RevenueSeriesRow[] {
  const byMonth = new Map<string, RevenueSeriesRow>();

  for (const row of rows ?? []) {
    const key = row.mois ?? "inconnu";
    const current =
      byMonth.get(key) ??
      { bucket: row.mois, abonnement: 0, scoutDay: 0, abonnementTx: 0, scoutDayTx: 0 };
    const amount = Number(row.revenu_encaisse ?? 0);
    const transactions = Number(row.nb_transactions_reussies ?? 0);
    if (row.payment_type === "abonnement") {
      current.abonnement += amount;
      current.abonnementTx += transactions;
    } else {
      current.scoutDay += amount;
      current.scoutDayTx += transactions;
    }
    byMonth.set(key, current);
  }

  return [...byMonth.values()]
    .sort((a, b) => (a.bucket ?? "").localeCompare(b.bucket ?? ""))
    .slice(-12);
}
