/**
 * Les statistiques de revenus de l'ecran des finances — et **rien d'autre**.
 *
 * Module neutre : il n'importe rien, ni `server-only`, ni le client Supabase,
 * ni un dictionnaire. C'est ce qui permet a `tests/finance-stats.test.cjs` de
 * l'executer vraiment plutot que de raisonner sur lui — meme raison, et meme
 * forme, que `dashboard-revenue.ts`.
 *
 * ⚠️ CE CALCUL NE VIT PAS DANS LA BASE. Contrairement au tableau de bord, qui
 * fenetre ses revenus dans `admin_dashboard_counts()`, l'ecran des finances
 * lit les paiements ligne a ligne pour pouvoir compter aussi les statuts **non
 * encaisses**, que l'agregat ne porte pas. La contrepartie est le plafond de
 * lecture : il doit etre annonce (`FinanceReadLimit`), jamais subi.
 */

/** Les deux statuts qui valent encaissement (§10.3 du cahier des charges). */
export const COLLECTED_STATUSES = ["reussi", "active_manuellement"] as const;

/** Les colonnes de `public.payments` que ce calcul lit, et elles seules. */
export type FinancePaymentRow = {
  amount: number | string | null;
  currency?: string | null;
  payment_type: string | null;
  status: string | null;
  paid_at: string | null;
};

/** L'enum `public.payment_type` n'a que ces deux membres. */
export type FinanceType = "abonnement" | "scout_day";

export type RevenueByType = {
  type: FinanceType;
  total: number;
  transactions: number;
  /** Panier moyen, ou `null` quand il n'y a aucune transaction a diviser. */
  average: number | null;
  /** Part du total encaisse, de 0 a 1 ; `0` quand rien n'est encaisse. */
  share: number;
  /** Encaisse de ce type sur le mois en vedette. */
  month: number;
};

/** Le pas du graphique de colonnes. */
export type SeriesStep = "jour" | "mois";

/** Une colonne : son debut, et les deux series qu'elle empile. */
export type SeriesPoint = {
  /** Debut du pas, parsable en heure LOCALE (voir `localStart`). */
  start: string;
  abonnement: number;
  scoutDay: number;
  total: number;
};

/**
 * La serie du graphique de colonnes, **et son pas**.
 *
 * ⚠️ LE PAS EST CHOISI, PAS FIXE, et c'est tout l'objet de ce type. Un
 * graphique mensuel sur un projet qui n'encaisse que depuis un mois ne dessine
 * qu'une colonne pleine largeur : une colonne unique n'est pas une serie, elle
 * occupe la place d'une mesure sans en etre une. Le pas descend donc au jour
 * tant que les encaissements tiennent dans deux mois civils.
 *
 * Les pas vides sont **conserves** : ce sont des jours sans encaissement, et
 * les retirer resserrerait l'axe au point de faire croire a une activite
 * continue.
 */
export type RevenueSeries = {
  step: SeriesStep;
  points: SeriesPoint[];
  /** Le plus haut total d'un pas — l'echelle des colonnes. */
  max: number;
};

/**
 * Un point de la courbe de cumul : le jour du mois, et le cumul atteint.
 *
 * Il porte les deux types **separement** et pas seulement leur somme : la
 * courbe est empilee comme les colonnes, de sorte qu'une couleur designe le
 * meme type d'un graphique a l'autre. Deux sens pour une couleur dans un meme
 * panneau, c'est une legende qui ment a moitie.
 */
export type CumulativePoint = {
  day: number;
  abonnement: number;
  scoutDay: number;
  /** Le cumul des deux — le haut de la pile. */
  value: number;
};

/** Un mois civil : son premier jour, et ce qui y a ete encaisse. */
export type MonthRevenue = { from: string; total: number; transactions: number };

/** Ce que le filtre de l'ecran couvre : tout l'historique, ou un mois. */
export type FinanceScope = "tous" | "mois";

/** Une entree du filtre : la valeur d'URL, et la date a mettre en forme. */
export type MonthOption = { value: string; start: string };

export type FinanceRevenueStats = {
  /**
   * Ce que le panneau couvre.
   *
   * ⚠️ TOUTES LES MESURES PORTEES PAR CE TYPE SUIVENT CETTE PORTEE, sauf
   * celles qui disent explicitement le contraire (`months`, les sans-date).
   * Un ecran ou le total serait filtre et la repartition ne le serait pas
   * donnerait deux lectures du meme mois — c'est exactement le defaut que le
   * tableau de bord a paye sur son panier moyen.
   */
  scope: FinanceScope;
  /** Le mois en vedette est-il le mois courant ? Il n'y a de projection que la. */
  isCurrentMonth: boolean;
  /** Les mois qui ont encaisse quelque chose, du plus recent au plus ancien. */
  months: MonthOption[];
  /** Encaisse **date**, dans la portee. */
  total: number;
  transactions: number;
  /** Toujours deux entrees, abonnements d'abord, meme a zero. */
  byType: RevenueByType[];
  /** Le mois que l'ecran met en vedette : le mois choisi, ou le mois courant. */
  focusMonth: MonthRevenue;
  /** Celui d'avant — la reference de l'evolution. */
  previousMonth: MonthRevenue;
  /**
   * Evolution du mois en vedette sur le precedent, de -1 a n.
   *
   * ⚠️ `null` quand le mois precedent n'a rien encaisse : une division par
   * zero rendrait `Infinity`, et « +∞ % » n'est pas une mesure. L'ecran dit
   * alors qu'il n'y a pas de reference, ce qui est l'information exacte.
   */
  evolution: number | null;
  /**
   * Fin de mois au prorata des jours ecoules, ou `null`.
   *
   * ⚠️ C'est une extrapolation, pas un encaissement : elle ne doit jamais etre
   * affichee sans sa methode (`elapsedDays` / `monthDays`), sinon l'ecran
   * presente comme acquis un montant que personne n'a paye.
   */
  projection: { value: number; elapsedDays: number; monthDays: number } | null;
  /** Bornes reelles des encaissements lus — la fenetre que l'ecran annonce. */
  firstPaidAt: string | null;
  lastPaidAt: string | null;
  /**
   * Les encaissements **sans date**, qui n'entrent dans aucun mois.
   *
   * Ils existent : `payments.paid_at` est nullable, et un paiement passe a
   * « reussi » sans date reste encaisse. Les taire ferait diverger la tuile
   * « Encaisse » de la somme des mois sans que rien ne l'explique.
   */
  undatedTotal: number;
  undatedTransactions: number;
  /**
   * Les devises rencontrees. Plus d'une signifie que les sommes additionnent
   * des unites differentes — l'ecran le dit plutot que de rendre un total
   * faux en silence.
   */
  currencies: string[];
  /** La serie des colonnes, au pas que les donnees permettent. */
  series: RevenueSeries;
  /**
   * Le cumul du mois en vedette, un point par jour ecoule.
   *
   * Monotone par construction : c'est ce qui lui donne une forme lisible la ou
   * les colonnes quotidiennes sont creuses.
   */
  cumulative: CumulativePoint[];
  /**
   * Le prolongement du cumul jusqu'a la fin du mois, au rythme constate.
   *
   * Il **commence au dernier point reel** pour que les deux traces se
   * rejoignent, et il est vide des que `projection` l'est. C'est une
   * extrapolation : le trace qui le porte doit se distinguer du reel.
   */
  projectedCumulative: CumulativePoint[];
  /** Jours ecoules et longueur du mois — l'axe du cumul. */
  elapsedDays: number;
  monthDays: number;
};

/**
 * Le mois demande par l'URL (`?mois=2026-09`), ou `null`.
 *
 * ⚠️ UN MOIS FUTUR RETOMBE SUR « TOUS LES MOIS » plutot que de s'afficher
 * vide. Le prorata y diviserait par des jours qui ne sont pas passes, et
 * l'ecran annoncerait une projection sur un mois ou rien ne peut avoir ete
 * encaisse. Une valeur d'URL n'est pas une donnee de confiance : elle est
 * bornee ici, une fois, plutot que dans chaque mesure.
 */
export function parseMonth(value: string | null | undefined, now: Date): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = new Date(Number(match[1]), month - 1, 1);
  if (start.getTime() > new Date(now.getFullYear(), now.getMonth(), 1).getTime()) return null;
  return start;
}

/** Un pas de la serie, somme des deux types — zero compris. */
const point = (
  start: string,
  slot: { abonnement: number; scoutDay: number } | undefined,
): SeriesPoint => {
  const abonnement = slot?.abonnement ?? 0;
  const scoutDay = slot?.scoutDay ?? 0;
  return { start, abonnement, scoutDay, total: abonnement + scoutDay };
};

const isCollected = (status: string | null) =>
  (COLLECTED_STATUSES as readonly string[]).includes(status ?? "");

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Une date de debut de pas, **parsable en heure locale**.
 *
 * ⚠️ LE `T00:00:00` N'EST PAS DECORATIF. `new Date("2026-10-23")` est minuit
 * UTC, que l'affichage reconvertit ensuite dans le fuseau du serveur : a
 * l'ouest de Greenwich la colonne du 23 s'intitulait « 22 oct ». Avec l'heure
 * explicite, la chaine est lue comme une date locale et le libelle retombe
 * toujours sur le bon jour.
 */
const localStart = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00:00`;

/** Premier jour du mois d'une date, meme convention. */
const monthStart = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01T00:00:00`;

/** Le jour civil d'une date, meme convention — la cle des pas quotidiens. */
const dayStart = (date: Date) => localStart(date);

/**
 * Le pas quotidien ne tient que si les encaissements sont recents : au-dela de
 * deux mois civils, trente et une colonnes ne montreraient que le dernier.
 */
const DAILY_MAX_MONTHS = 2;

/** Les douze pas mensuels de la serie longue, le mois en cours inclus. */
const MONTHLY_STEPS = 12;

/**
 * Les revenus encaisses, recalcules depuis `paid_at` et decomposes par type.
 *
 * `now` est passe en parametre plutot que lu ici : c'est ce qui rend le mois
 * en vedette, l'evolution et la projection reproductibles dans un test.
 *
 * `selected` est la valeur brute de `?mois=` — bornee par `parseMonth()`, pas
 * par l'appelant.
 */
export function financeRevenueStats(
  rows: FinancePaymentRow[] | null | undefined,
  now: Date,
  selected?: string | null,
): FinanceRevenueStats {
  const chosen = parseMonth(selected, now);
  const scope: FinanceScope = chosen ? "mois" : "tous";
  const focus = chosen ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const isCurrentMonth =
    focus.getFullYear() === now.getFullYear() && focus.getMonth() === now.getMonth();
  const focusKey = monthStart(focus);
  const previousKey = monthStart(new Date(focus.getFullYear(), focus.getMonth() - 1, 1));

  const byType = new Map<FinanceType, RevenueByType>([
    ["abonnement", { type: "abonnement", total: 0, transactions: 0, average: null, share: 0, month: 0 }],
    ["scout_day", { type: "scout_day", total: 0, transactions: 0, average: null, share: 0, month: 0 }],
  ]);
  const focusMonth: MonthRevenue = { from: focusKey, total: 0, transactions: 0 };
  const previousMonth: MonthRevenue = { from: previousKey, total: 0, transactions: 0 };
  const currencies = new Set<string>();
  /** Un pas par jour du mois en vedette, et un par mois sur tout l'historique. */
  const byDay = new Map<string, { abonnement: number; scoutDay: number }>();
  const byMonth = new Map<string, { abonnement: number; scoutDay: number }>();

  let total = 0;
  let transactions = 0;
  let undatedTotal = 0;
  let undatedTransactions = 0;
  let first: number | null = null;
  let last: number | null = null;
  let firstPaidAt: string | null = null;
  let lastPaidAt: string | null = null;

  for (const row of rows ?? []) {
    if (!isCollected(row.status)) continue;
    const amount = Number(row.amount ?? 0);
    if (Number.isNaN(amount)) continue;
    currencies.add((row.currency ?? "TND").toUpperCase());

    if (!row.paid_at) {
      undatedTotal += amount;
      undatedTransactions += 1;
      continue;
    }

    // L'enum ne porte que deux membres : tout ce qui n'est pas un abonnement
    // est un Scout Day. Meme repartition que le graphique qu'il remplace.
    const bucket = byType.get(row.payment_type === "abonnement" ? "abonnement" : "scout_day")!;
    const paidAt = new Date(row.paid_at);
    const key = monthStart(paidAt);
    const field = bucket.type === "abonnement" ? "abonnement" : "scoutDay";

    // ⚠️ LA LISTE DES MOIS EST HORS PORTEE, et doit l'etre : c'est elle qui
    // peuple le filtre. La borner au mois choisi ne laisserait qu'une seule
    // option — celle deja selectionnee — et il n'y aurait plus moyen d'en
    // sortir.
    const monthSlot = byMonth.get(key) ?? { abonnement: 0, scoutDay: 0 };
    monthSlot[field] += amount;
    byMonth.set(key, monthSlot);

    if (key === focusKey) {
      focusMonth.total += amount;
      focusMonth.transactions += 1;
      bucket.month += amount;
      const dayKey = dayStart(paidAt);
      const daySlot = byDay.get(dayKey) ?? { abonnement: 0, scoutDay: 0 };
      daySlot[field] += amount;
      byDay.set(dayKey, daySlot);
    } else if (key === previousKey) {
      previousMonth.total += amount;
      previousMonth.transactions += 1;
    }

    // Tout ce qui suit est la portee de l'ecran : total, repartition par type
    // et fenetre annoncee. Les trois se filtrent ensemble ou pas du tout.
    if (scope === "mois" && key !== focusKey) continue;

    total += amount;
    transactions += 1;
    bucket.total += amount;
    bucket.transactions += 1;

    // Comparaison sur l'horodatage, pas sur la chaine : PostgREST rend un
    // decalage explicite (`+00:00`), et deux decalages differents se classent
    // dans le mauvais ordre en comparaison lexicale.
    const stamp = paidAt.getTime();
    if (Number.isNaN(stamp)) continue;
    if (first === null || stamp < first) [first, firstPaidAt] = [stamp, row.paid_at];
    if (last === null || stamp > last) [last, lastPaidAt] = [stamp, row.paid_at];
  }

  for (const bucket of byType.values()) {
    bucket.average = bucket.transactions ? bucket.total / bucket.transactions : null;
    bucket.share = total > 0 ? bucket.total / total : 0;
  }

  const monthDays = new Date(focus.getFullYear(), focus.getMonth() + 1, 0).getDate();
  // Un mois clos est entierement ecoule. Sur le mois courant, `now.getDate()`
  // peut depasser sa longueur le temps d'un changement d'heure ; l'axe du
  // cumul ne doit jamais sortir du mois qu'il dessine.
  const elapsedDays = isCurrentMonth ? Math.min(now.getDate(), monthDays) : monthDays;

  // ⚠️ LE PAS EST CHOISI ICI, sur ce que les donnees permettent — jamais fixe.
  // Au mois, un projet qui encaisse depuis un mois n'obtient qu'une colonne.
  // Un mois explicitement demande se dessine toujours au jour : c'est le mois
  // qu'on regarde, pas sa place dans l'annee.
  const daily =
    scope === "mois" || (byMonth.size <= DAILY_MAX_MONTHS && focusMonth.total > 0);
  const points: SeriesPoint[] = daily
    ? Array.from({ length: monthDays }, (_, index) => {
        const start = localStart(new Date(focus.getFullYear(), focus.getMonth(), index + 1));
        return point(start, byDay.get(start));
      })
    : Array.from({ length: MONTHLY_STEPS }, (_, index) => {
        const start = monthStart(
          new Date(focus.getFullYear(), focus.getMonth() - (MONTHLY_STEPS - 1 - index), 1),
        );
        return point(start, byMonth.get(start));
      });

  // Le cumul ne porte que le mois en vedette : c'est le mois que la projection
  // prolonge, et melanger deux echelles n'aurait pas de sens.
  const cumulative: CumulativePoint[] = [];
  let runningAbonnement = 0;
  let runningScoutDay = 0;
  for (let day = 1; day <= elapsedDays; day += 1) {
    const slot = byDay.get(localStart(new Date(focus.getFullYear(), focus.getMonth(), day)));
    runningAbonnement += slot?.abonnement ?? 0;
    runningScoutDay += slot?.scoutDay ?? 0;
    cumulative.push({
      day,
      abonnement: runningAbonnement,
      scoutDay: runningScoutDay,
      value: runningAbonnement + runningScoutDay,
    });
  }

  const rate = elapsedDays > 0 ? focusMonth.total / elapsedDays : 0;
  // ⚠️ PAS DE PROJECTION SUR UN MOIS CLOS. Son total est acquis ; le prolonger
  // afficherait une estimation la ou il y a un fait.
  //
  // `isCurrentMonth` y est **redondant** : un mois clos a `elapsedDays ===
  // monthDays`, donc le dernier terme suffit deja. Il est ecrit quand meme
  // parce que c'est la regle, et que la prochaine personne qui touchera au
  // calcul des jours ecoules doit la lire ici — mais c'est bien ce calcul,
  // et non ce terme, que le test garde.
  const projects = isCurrentMonth && focusMonth.total > 0 && elapsedDays < monthDays;
  // Le prolongement part du dernier point reel — sinon les deux traces se
  // rejoindraient a cote l'un de l'autre, et la rupture se lirait comme un
  // encaissement.
  const projectedCumulative: CumulativePoint[] = projects
    ? Array.from({ length: monthDays - elapsedDays + 1 }, (_, index) => {
        const day = elapsedDays + index;
        // Le prolongement ne decompose rien : extrapoler la part de chaque
        // type supposerait que le mois a venir ressemble au mois ecoule, ce
        // que rien ne dit. Seul le total est prolonge.
        return { day, abonnement: 0, scoutDay: 0, value: rate * day };
      })
    : [];

  return {
    scope,
    isCurrentMonth,
    // Du plus recent au plus ancien, comme toutes les listes du back-office.
    months: [...byMonth.keys()]
      .sort()
      .reverse()
      .map((start) => ({ value: start.slice(0, 7), start })),
    series: { step: daily ? "jour" : "mois", points, max: Math.max(...points.map((p) => p.total), 0) },
    cumulative,
    projectedCumulative,
    elapsedDays,
    monthDays,
    total,
    transactions,
    byType: [byType.get("abonnement")!, byType.get("scout_day")!],
    focusMonth,
    previousMonth,
    evolution:
      previousMonth.total > 0
        ? (focusMonth.total - previousMonth.total) / previousMonth.total
        : null,
    // Le dernier jour du mois, le prorata vaut le mois lui-meme : annoncer
    // alors une « projection » ferait passer un encaissement acquis pour une
    // estimation.
    projection: projects ? { value: rate * monthDays, elapsedDays, monthDays } : null,
    firstPaidAt,
    lastPaidAt,
    undatedTotal,
    undatedTransactions,
    currencies: [...currencies].sort(),
  };
}
