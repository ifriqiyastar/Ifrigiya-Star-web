import { CreditCardIcon, ReceiptTextIcon, TrendingUpIcon, Undo2Icon, WalletIcon } from "lucide-react";

import { NoteCards } from "@/components/admin/note-cards";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { RevenueStats } from "@/components/admin/finances/revenue-stats";
import { StatCard } from "@/components/admin/stat-card";
import { getAdminI18n } from "@/lib/i18n/admin";
import { COLLECTED_STATUSES, financeRevenueStats, parseMonth } from "@/lib/queries/finance-stats";
import { createClient } from "@/lib/supabase/server";

/**
 * Les pieces communes aux ecrans d'abonnements et de paiements.
 *
 * Elles etaient inline dans une page unique a onglets ; la separation en
 * routes les recopierait sinon autant de fois — meme traitement que la moderation
 * et les validations, et pour la meme raison : c'est la duplication qui avait
 * produit la-bas trois recherches et trois compteurs divergents.
 */

/** Les deux vues, qui sont deux routes. */
export const FINANCE_VUES = ["paiements", "abonnements"] as const;
export type FinanceVue = (typeof FINANCE_VUES)[number];

/** Le chemin d'une vue, sans le prefixe de langue. */
export const financePath = (vue: FinanceVue) => `/admin/finances/${vue}` as const;

// Huit lignes par page (demande client) : les files du back-office se
// lisent surtout sur telephone, ou chaque ligne est une rangee compacte de
// deux lignes de texte — vingt d'entre elles faisaient une page qu'on ne
// parcourt plus, on la fait defiler.
export const FINANCE_PAGE_SIZE = 8;

/**
 * Le plafond de lecture des mesures d'en-tete.
 *
 * Il existe parce que la synthese est calculee cote application et non par un
 * agregat : il faut ramener les lignes. Il est **annonce a l'ecran** des qu'il
 * mord — un total arrete a la 5 000e transaction et presente comme le registre
 * entier est le defaut que `lib/csv.ts` a deja corrige du cote des exports.
 */
export const FINANCE_METRICS_LIMIT = 5000;

/**
 * Le parametre d'URL du mois de chaque carte du panneau des revenus.
 *
 * Quatre cles distinctes, parce que les cartes sont independantes : on
 * compare septembre dans l'une et octobre dans la suivante. Elles vivent ici,
 * a cote de la page qui les lit, pour que `params` et les selects ne puissent
 * pas diverger sur une faute de frappe.
 */
export const MONTH_PARAM = {
  lead: "mois",
  abonnement: "mois-abonnements",
  scoutDay: "mois-scout-days",
} as const;

/**
 * Les quatre mesures d'en-tete et la synthese des revenus.
 *
 * Elles portent sur **l'ensemble** des encaissements, pas sur la vue affichee :
 * elles sont donc identiques d'un ecran a l'autre et calculees au meme endroit,
 * comme `ValidationMetrics`.
 *
 * ⚠️ La synthese est lue sur `payments` et non sur la vue agregee du tableau de
 * bord : il faut pouvoir compter aussi les statuts **non encaisses** (en
 * attente, echoue, rembourse), que l'agregat ne porte pas.
 *
 * ⚠️ LE FILTRE DE MOIS NE PORTE QUE SUR LE PANNEAU DES REVENUS, et il est
 * pose dans son en-tete pour qu'on voie ce qu'il cadre. Les quatre tuiles
 * au-dessus restent sur tout l'historique — c'est leur role, et elles le
 * disent. Un filtre qui s'appliquerait a la moitie d'un meme bloc, sans
 * frontiere visible, donnerait deux lectures du meme ecran.
 */
export async function FinanceMetrics({
  basePath,
  params,
}: {
  /** Le chemin de l'ecran, deja prefixe de la langue. */
  basePath: string;
  /** `await searchParams` de la page : le filtre doit preserver le reste. */
  params: Record<string, string | undefined>;
}) {
  const i18n = await getAdminI18n();
  const supabase = await createClient();

  const [{ data: allPayments, count: paymentsCount }, { count: activeSubscriptions }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("amount, currency, payment_type, status, paid_at", { count: "exact" })
        // ⚠️ L'ORDRE FAIT PARTIE DU PLAFOND. Sans lui, les 5 000 lignes lues
        // sont celles que Postgres rend en premier, c'est-a-dire n'importe
        // lesquelles : un plafond atteint retirait alors des paiements au
        // hasard. Trie, il retire les plus anciens — et la ligne de pied le
        // dit. `created_at` et non `paid_at`, qui est nullable : les
        // encaissements sans date passeraient devant tous les autres.
        .order("created_at", { ascending: false })
        .limit(FINANCE_METRICS_LIMIT),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);

  const payments = allPayments ?? [];
  const collected = payments
    .filter((row) => (COLLECTED_STATUSES as readonly string[]).includes(row.status))
    .reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
  const pendingAmount = payments
    .filter((row) => row.status === "en_attente")
    .reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
  const refunded = payments
    .filter((row) => row.status === "rembourse")
    .reduce((acc, row) => acc + Number(row.amount ?? 0), 0);

  // Revenus recalcules cote application depuis `paid_at` : c'est ce que
  // l'intitule du panneau annonce, et c'est ce qui permet de decomposer par
  // type sans demander un second agregat a la base.
  //
  // ⚠️ UN CALCUL PAR CARTE, chacune ayant son mois. Le meme tableau de
  // paiements est relu autant de fois qu'il y a de portees distinctes —
  // quelques milliers d'additions en memoire, sans aller-retour
  // supplementaire vers la base, qui est le seul cout qui compte ici. Les
  // portees identiques (le cas ordinaire, ou rien n'est filtre) ne sont
  // calculees qu'une fois.
  const now = new Date();
  const cache = new Map<string, ReturnType<typeof financeRevenueStats>>();
  const statsFor = (selected: string | undefined) => {
    const key = parseMonth(selected, now) ? selected! : "";
    const cached = cache.get(key);
    if (cached) return cached;
    const computed = financeRevenueStats(payments, now, key || null);
    cache.set(key, computed);
    return computed;
  };

  const cards = {
    lead: statsFor(params[MONTH_PARAM.lead]),
    abonnement: statsFor(params[MONTH_PARAM.abonnement]),
    scoutDay: statsFor(params[MONTH_PARAM.scoutDay]),
  };
  const truncated = (paymentsCount ?? 0) > payments.length;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label={i18n.t("Encaisse")}
          value={i18n.format.formatAmount(collected)}
          hint={i18n.t("Paiements « reussi » et « active manuellement »")}
          icon={WalletIcon}
        />
        <StatCard
          label={i18n.t("En attente")}
          value={i18n.format.formatAmount(pendingAmount)}
          hint={i18n.t("A confirmer ou a activer manuellement")}
          icon={ReceiptTextIcon}
        />
        <StatCard
          label={i18n.t("Rembourse")}
          value={i18n.format.formatAmount(refunded)}
          icon={Undo2Icon}
          deltaTone="warning"
        />
        <StatCard
          label={i18n.t("Abonnements actifs")}
          value={i18n.format.formatNumber(activeSubscriptions ?? 0)}
          icon={CreditCardIcon}
          accent="secondary"
          href={i18n.path(financePath("abonnements"))}
        />
      </section>

      {/* ⚠️ Un plafond de lecture ne doit jamais etre subi en silence : sans
          cette ligne, une somme arretee a la 5 000e transaction se lisait
          comme le total du registre. Meme regle que les exports (`lib/csv.ts`). */}
      {truncated ? (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[0.6875rem] text-warning">
          {i18n.t(
            "Lecture bornee aux {limit} paiements les plus recents, sur {count} enregistres : les montants ci-dessus n'incluent pas les plus anciens.",
            {
              limit: i18n.format.formatNumber(FINANCE_METRICS_LIMIT),
              count: i18n.format.formatNumber(paymentsCount ?? 0),
            },
          )}
        </p>
      ) : null}

      <Panel>
        <PanelHeader
          icon={TrendingUpIcon}
          title={i18n.t("Revenus par mois et projection comptable")}
          description={i18n.t("Recalcules depuis la date d'encaissement, decomposes par type de paiement.")}
        />
        <RevenueStats cards={cards} basePath={basePath} params={params} />
      </Panel>
    </>
  );
}

/** Le fil d'ariane commun aux deux ecrans ; le dernier maillon reste propre. */
export async function financeCrumb() {
  const i18n = await getAdminI18n();
  return { label: i18n.t("Paiements et revenus"), href: i18n.path(financePath("paiements")) };
}

/** Bandeau d'erreur de lecture, identique sur les deux files. */
export async function FinanceError({ message }: { message: string }) {
  const i18n = await getAdminI18n();
  return (
    <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive sm:px-5">
      {i18n.t("Lecture impossible :")} {message}
    </p>
  );
}

/**
 * La bande de rappels qui ferme les deux ecrans. C'est de la documentation :
 * les regles decrites sont celles que l'application applique reellement.
 */
export async function FinanceNotes() {
  const i18n = await getAdminI18n();
  return (
    <NoteCards
      notes={[
        {
          icon: WalletIcon,
          title: i18n.t("Cet ecran suit, il ne facture pas"),
          body: i18n.t("Les montants affiches sont ceux enregistres dans la table des paiements. Tarifs, commissions et regles de remboursement ne sont pas arretes par le cahier des charges : rien n'est calcule ici, tout est repris tel quel."),
        },
        {
          icon: ReceiptTextIcon,
          title: i18n.t("Activation manuelle"),
          body: i18n.t("Un encaissement hors ligne se confirme a la main : le paiement passe a « active manuellement » et rejoint les montants encaisses. Le geste est trace, et il reste distinct d'un paiement confirme par la passerelle."),
        },
        {
          icon: CreditCardIcon,
          title: i18n.t("Un abonnement actif n'est pas un paiement"),
          body: i18n.t("Le compteur d'abonnements lit le statut des souscriptions, pas les transactions. Les deux peuvent diverger le temps qu'un paiement soit confirme — c'est normal, et c'est pourquoi ils sont affiches separement."),
        },
      ]}
    />
  );
}
