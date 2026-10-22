import { CreditCardIcon, ReceiptTextIcon, TrendingUpIcon, Undo2Icon, WalletIcon } from "lucide-react";

import { NoteCards } from "@/components/admin/note-cards";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { RevenueChart, type RevenueRow } from "@/components/admin/revenue-chart";
import { StatCard } from "@/components/admin/stat-card";
import { getAdminI18n } from "@/lib/i18n/admin";
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
 * Les quatre mesures d'en-tete et la courbe des revenus.
 *
 * Elles portent sur **l'ensemble** des encaissements, pas sur la vue affichee :
 * elles sont donc identiques d'un ecran a l'autre et calculees au meme endroit,
 * comme `ValidationMetrics`.
 *
 * ⚠️ La synthese est lue sur `payments` et non sur la vue agregee du tableau de
 * bord : il faut pouvoir compter aussi les statuts **non encaisses** (en
 * attente, echoue, rembourse), que l'agregat ne porte pas.
 */
export async function FinanceMetrics() {
  const i18n = await getAdminI18n();
  const supabase = await createClient();

  const [{ data: allPayments }, { count: activeSubscriptions }] = await Promise.all([
    supabase.from("payments").select("amount, currency, payment_type, status, paid_at").limit(5000),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const payments = allPayments ?? [];
  const collected = payments
    .filter((row) => ["reussi", "active_manuellement"].includes(row.status))
    .reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
  const pendingAmount = payments
    .filter((row) => row.status === "en_attente")
    .reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
  const refunded = payments
    .filter((row) => row.status === "rembourse")
    .reduce((acc, row) => acc + Number(row.amount ?? 0), 0);

  // Revenus par mois, recalcules cote application depuis `paid_at`.
  const byMonth = new Map<string, RevenueRow>();
  for (const row of payments) {
    if (!row.paid_at) continue;
    if (!["reussi", "active_manuellement"].includes(row.status)) continue;
    const date = new Date(row.paid_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    const current = byMonth.get(key) ?? { bucket: key, abonnement: 0, scout_day: 0 };
    const amount = Number(row.amount ?? 0);
    if (row.payment_type === "abonnement") current.abonnement += amount;
    else current.scout_day += amount;
    byMonth.set(key, current);
  }
  // Ici le pas est bien le mois — c'est cet ecran qui les construit, un par
  // `paid_at` — donc `RevenueChart` garde sa granularite par defaut.
  const revenueRows = [...byMonth.values()].sort((a, b) =>
    (a.bucket ?? "").localeCompare(b.bucket ?? ""),
  );

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

      <Panel>
        <PanelHeader
          icon={TrendingUpIcon}
          title={i18n.t("Revenus par mois et projection comptable")}
          description={i18n.t("Recalcules depuis la date d'encaissement, decomposes par type de paiement.")}
        />
        <RevenueChart rows={revenueRows} />
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
