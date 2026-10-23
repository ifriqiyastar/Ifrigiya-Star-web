import { WalletIcon, TrendingUpIcon } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import { FinanceMonthFilter } from "@/components/admin/finances/month-filter";
import {
  RevenueCumulative,
  RevenueTypeCard,
} from "@/components/admin/finances/revenue-charts";
import { MONTH_PARAM } from "@/components/admin/finances/pieces";
import { getAdminI18n } from "@/lib/i18n/admin";
import type { FinanceRevenueStats, MonthOption } from "@/lib/queries/finance-stats";

/** Un jeu de mesures par carte : chacune porte son propre mois. */
export type RevenueCards = {
  lead: FinanceRevenueStats;
  abonnement: FinanceRevenueStats;
  scoutDay: FinanceRevenueStats;
};

/**
 * Les revenus encaisses de l'ecran des finances, en cartes (§12.4).
 *
 * ⚠️ CE PANNEAU A REMPLACE UN GRAPHIQUE A BARRES, et pas par gout. Le pas du
 * graphique etait le mois, et le projet n'encaisse que depuis un mois : il ne
 * dessinait qu'une seule barre, pleine largeur, sans rien a quoi la comparer.
 * Une barre unique n'est pas une serie — elle occupe la place d'une mesure
 * sans en etre une.
 *
 * ⚠️ CHAQUE CARTE A SON PROPRE MOIS (demande client), sous sa propre cle
 * d'URL : c'est ce qui permet de poser septembre a cote d'octobre et de les
 * lire ensemble. La contrepartie est reelle et assumee — **deux cartes
 * voisines peuvent ne pas parler du meme mois**, donc chacune affiche le sien
 * en toutes lettres dans son en-tete, jamais seulement dans l'adresse. Une
 * carte qui tairait sa periode serait lue comme parlant de la meme que sa
 * voisine.
 *
 * L'anatomie suit les maquettes d'octobre 2026 (`~/Downloads/screen`) : une
 * carte de tete qui porte un grand nombre, son evolution et sa courbe, puis
 * deux cartes de soutien plus petites. Une troisieme carte, entre les deux,
 * portait les colonnes jour par jour et leur tableau de valeurs ; elle a ete
 * retiree a la demande du client. Ce qui n'a PAS ete repris de ces
 * maquettes : les degrades bleu-vert (la charte n'a que quatre couleurs) et
 * les jauges circulaires de pourcentage, qui comparent mal deux valeurs
 * proches.
 *
 * ⚠️ LA PROJECTION EST UNE EXTRAPOLATION. Elle porte sa methode (« prorata de
 * 23 j sur 31 j ») partout ou elle parait : sans elle, l'ecran presenterait
 * comme encaisse un montant que personne n'a paye.
 */
export async function RevenueStats({
  cards,
  basePath,
  params,
}: {
  cards: RevenueCards;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const i18n = await getAdminI18n();
  const { formatAmount, formatDate, formatMonth, formatNumber } = i18n.format;
  const { lead, abonnement, scoutDay } = cards;

  if (!lead.months.length) {
    return (
      <EmptyState
        icon={TrendingUpIcon}
        title={i18n.t("Aucun encaissement date")}
        description={i18n.t(
          "Un paiement encaisse porte une date d'encaissement ; aucun n'en a encore. Les mesures d'en-tete, elles, portent sur tous les paiements enregistres.",
        )}
      />
    );
  }

  /** Le select d'une carte. Les mois proposes sont les memes partout. */
  const monthFilter = (
    param: string,
    label: string,
    stats: FinanceRevenueStats,
    allOption = true,
  ) => (
    <FinanceMonthFilter
      basePath={basePath}
      params={params}
      param={param}
      label={label}
      value={stats.scope === "mois" ? stats.focusMonth.from.slice(0, 7) : ""}
      options={monthOptions(lead.months, formatMonth)}
      allOption={allOption}
    />
  );

  const evolution =
    lead.evolution === null
      ? null
      : `${lead.evolution >= 0 ? "+" : "−"}${Math.round(Math.abs(lead.evolution) * 100)} %`;

  return (
    <div className="space-y-3 px-4 py-4 sm:px-5">
      {/* ── La carte de tete : un grand nombre, son evolution, sa courbe.
          Son select n'offre pas « tous les mois » : un cumul et une
          projection sont des grandeurs de mois. */}
      <section className="rounded-lg border border-border bg-secondary p-3 sm:p-4">
        {/* ⚠️ LA PROJECTION RESTE A DROITE SUR TELEPHONE — c'est la demande, et
            elle passait auparavant sous le grand nombre, ou elle se lisait
            comme une seconde precision de l'encaisse plutot que comme une
            autre mesure.

            Mesure en main (Chrome pilote en CDP, feuille Tailwind compilee,
            polices reelles, coquille `@container/main` du vrai gabarit) : la
            droite tient en 7 rem, et la gauche a besoin de 9 rem pour ne pas
            rogner un montant a six chiffres. Les deux colonnes cohabitent
            donc des 360 px — tous les telephones courants — et ne se
            replient qu'en dessous, ou les garder cote a cote couperait le
            nombre au lieu de le deplacer. C'est `min-w-36` qui arbitre, pas
            un palier `sm:` : le seuil est celui du contenu. */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 pb-3 sm:gap-x-5">
          <div className="min-w-36 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="micro-label flex items-center gap-1.5 text-muted-foreground">
                <WalletIcon className="size-3.5" />
                {i18n.t("Encaisse")}
              </span>
              {monthFilter(MONTH_PARAM.lead, i18n.t("Mois encaisse"), lead, false)}
            </span>
            {/* ⚠️ UNE TAILLE QUI SUIT LA LARGEUR, pas deux paliers. Mesure en
                main a 320 px : « TND 224 700,00 » en `text-2xl` fait 156 px,
                exactement la colonne, et il chevauchait la projection a sa
                droite. `clamp()` le reduit au lieu de le faire deborder, et
                plafonne a la taille voulue des qu'il y a la place.

                Chiffres proportionnels : `tabular-nums` espace les chiffres
                d'une grande valeur isolee. */}
            <p className="mt-2 font-heading text-[clamp(1.125rem,5.5vw,1.875rem)] leading-none font-bold tracking-tight">
              {formatAmount(lead.focusMonth.total)}
            </p>
            <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">
              {evolution
                ? i18n.t("{delta} sur {month}", {
                    delta: evolution,
                    month: formatMonth(lead.previousMonth.from),
                  })
                : i18n.t("Pas de reference le mois precedent")}
            </p>
          </div>
          {lead.projection ? (
            // Largeur arretee sous `sm` : l'intitule et le prorata s'y
            // replient sur deux lignes, et le grand nombre de gauche garde
            // toujours la place qui reste. 7 rem et non 8 : a 320 px, le
            // demi-rem rendu a gauche est ce qui permet au select de mois
            // d'afficher « octobre 2026 » en entier plutot que « octobre 2 ».
            <div className="w-28 shrink-0 text-right sm:w-auto">
              <span className="micro-label text-muted-foreground">
                {i18n.t("Projection fin de mois")}
              </span>
              <p className="mt-2 font-heading text-[clamp(0.8125rem,3.6vw,1.125rem)] leading-none font-bold tracking-tight">
                {formatAmount(lead.projection.value)}
              </p>
              <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">
                {i18n.t("Prorata de {days} j sur {total} j", {
                  days: lead.projection.elapsedDays,
                  total: lead.projection.monthDays,
                })}
              </p>
            </div>
          ) : null}
        </div>

        <RevenueCumulative
          cumulative={lead.cumulative}
          projected={lead.projectedCumulative}
          monthDays={lead.monthDays}
          isCurrentMonth={lead.isCurrentMonth}
        />

        {/* ⚠️ LA FENETRE EST ANNONCEE DANS LA CARTE, pas au pied du panneau.
            Les quatre cartes peuvent montrer quatre mois differents : une
            seule ligne de provenance posee en bas se lirait comme decrivant
            les quatre. */}
        {lead.transactions ? (
          <p className="pt-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
            {(lead.firstPaidAt === lead.lastPaidAt
              ? i18n.t("Encaissements dates du {date}", { date: formatDate(lead.firstPaidAt) })
              : i18n.t("Encaissements dates du {from} au {to}", {
                  from: formatDate(lead.firstPaidAt),
                  to: formatDate(lead.lastPaidAt),
                })) +
              " — " +
              i18n.t("{count} transaction(s) encaissee(s)", {
                count: formatNumber(lead.transactions),
              })}
          </p>
        ) : null}
      </section>

      {/* ── Une carte par type de paiement. Elles ont remplace les deux lignes
          d'une jauge de repartition : a cote de la part, elles portent le
          rythme du type, qui est ce qui les distingue vraiment. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <RevenueTypeCard
          type="abonnement"
          {...typeFigures(abonnement, "abonnement")}
          series={abonnement.series}
          scale={abonnement.series.max}
          scoped={abonnement.scope === "mois"}
          control={monthFilter(MONTH_PARAM.abonnement, i18n.t("Mois des abonnements"), abonnement)}
        />
        <RevenueTypeCard
          type="scout_day"
          {...typeFigures(scoutDay, "scout_day")}
          series={scoutDay.series}
          scale={scoutDay.series.max}
          scoped={scoutDay.scope === "mois"}
          control={monthFilter(MONTH_PARAM.scoutDay, i18n.t("Mois des Scout Days"), scoutDay)}
        />
      </div>

      <ul className="space-y-1 px-1 text-[0.6875rem] leading-relaxed text-muted-foreground">
        {/* ⚠️ CES DEUX LIGNES SONT HORS PORTEE, et le restent quel que soit le
            mois des cartes : un encaissement sans date n'appartient a aucun
            mois, et une devise etrangere fausse n'importe quelle somme. Elles
            sont lues sur la carte de tete, mais `financeRevenueStats()` les
            calcule avant tout filtrage — elles valent donc pour l'ensemble,
            comme la tuile « Encaisse » au-dessus du panneau.

            Sans cette premiere ligne, un paiement encaisse sans date figurerait
            dans cette tuile et nulle part ici, sans que rien l'explique. */}
        {lead.undatedTransactions ? (
          <li>
            {i18n.t("Hors repartition, faute de date d'encaissement : {count} paiement(s), {amount}.", {
              count: formatNumber(lead.undatedTransactions),
              amount: formatAmount(lead.undatedTotal),
            })}
          </li>
        ) : null}
        {/* Additionner deux devises rend un total qui ne veut rien dire. Tant
            que le projet n'encaisse qu'en TND la ligne ne parait pas. */}
        {lead.currencies.length > 1 ? (
          <li className="text-warning">
            {i18n.t("Plusieurs devises sont enregistrees ({list}) : les montants sont additionnes tels quels.", {
              list: lead.currencies.join(", "),
            })}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** Les mois proposes : ceux qui ont encaisse quelque chose, recents d'abord. */
function monthOptions(months: MonthOption[], formatMonth: (value: string) => string) {
  return months.map((month) => ({ value: month.value, label: formatMonth(month.start) }));
}

/** Les chiffres d'un type dans la portee de SA carte. */
function typeFigures(stats: FinanceRevenueStats, type: "abonnement" | "scout_day") {
  const entry = stats.byType.find((row) => row.type === type)!;
  return {
    total: entry.total,
    transactions: entry.transactions,
    average: entry.average,
    share: entry.share,
  };
}
