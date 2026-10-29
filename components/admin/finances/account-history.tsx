import Link from "next/link";
import { ArrowUpRightIcon, HistoryIcon } from "lucide-react";

import { DetailDialog } from "@/components/admin/detail-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusPill } from "@/components/admin/status-pill";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { getAdminI18n } from "@/lib/i18n/admin";
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  PLAN_CODE,
  ROLE,
  SUBSCRIPTION_STATUS,
} from "@/lib/labels";
import { FINANCE_HISTORY_LIMIT, type AccountHistory } from "@/lib/queries/finance-history";
import { COLLECTED_STATUSES } from "@/lib/queries/finance-stats";
import type { ProfileSummary } from "@/lib/queries/profiles";
import { cn } from "@/lib/utils";

/**
 * L'historique financier d'un compte, depuis une ligne de la liste des
 * abonnements.
 *
 * POURQUOI ICI ALORS QUE LA FICHE DU COMPTE LE PORTE DEJA. L'onglet
 * « Abonnements & paiements » de `/admin/utilisateurs/{id}` montre le meme
 * historique, et le nom de la ligne y mene. Mais la question que pose une liste
 * groupee par compte n'est pas « ouvre-moi ce compte » : c'est « qu'y a-t-il eu
 * d'autre sur ce compte, et la ligne que je vois est-elle la bonne ? ». Y
 * repondre coutait de quitter la file, de lire la fiche, puis de revenir en
 * ayant perdu sa place et ses filtres — pour une question dont la reponse tient
 * en six lignes. C'est le meme raisonnement que `ProfilePreviewDialog`, un cran
 * plus loin.
 *
 * ⚠️ DES LISTES, PAS DES TABLES. Les deux historiques etaient rendus en tables
 * de cinq et six colonnes dans une modale large de `2xl` : elles debordaient, et
 * on lisait un historique en le faisant defiler lateralement. Un historique se
 * lit de haut en bas — c'est une chronologie, pas une grille a comparer colonne
 * par colonne. Chaque entree est donc une ligne a deux niveaux : ce qu'elle est
 * (offre ou montant, avec ses pastilles) au-dessus, ses circonstances (dates,
 * moyen, reference) en dessous et en attenue. Plus aucun defilement horizontal,
 * et la meme forme tient sur telephone.
 *
 * ⚠️ LA MODALE NE PORTE AUCUNE ACTION, ET C'EST VOLONTAIRE. Activer, expirer et
 * annuler restent sur la ligne et sur la fiche. Les recopier ici ferait trois
 * endroits ou le meme geste existe, et surtout : on ne corrige pas une
 * souscription depuis un historique qu'on est en train de lire pour comprendre.
 * C'est une piece de lecture.
 *
 * ⚠️ LE CONTENU EST RENDU PAR LE SERVEUR et traverse `DetailDialog` en slot —
 * l'historique arrive deja charge par la page, groupe pour toutes ses lignes
 * (voir `fetchAccountHistories`), donc ouvrir la modale ne declenche aucune
 * lecture. L'identite en tete ne coute rien non plus : ce sont les champs de
 * `ProfileSummary` que la ligne a deja charges pour afficher son nom.
 */
export async function AccountHistoryDialog({
  history,
  plans,
  /** La souscription affichee par la ligne d'ou l'on vient : elle est signalee. */
  currentSubscriptionId,
  profile,
  accountName,
  accountHref,
  truncated,
  error,
}: {
  history: AccountHistory;
  plans: Map<string, { code: string; price_amount: number | null; price_currency: string | null }>;
  currentSubscriptionId: string;
  profile?: ProfileSummary;
  accountName: string;
  accountHref: string;
  truncated: boolean;
  error: string | null;
}) {
  const i18n = await getAdminI18n();

  const total = history.subscriptions.length;
  // Le rang est chronologique — la premiere souscription du compte porte le
  // numero 1 —, alors que la liste est du plus recent au plus ancien. L'index
  // est donc compte a rebours.
  const rank = (index: number) => total - index;

  const collected = history.payments
    .filter((row) => (COLLECTED_STATUSES as readonly string[]).includes(row.status))
    .reduce((acc, row) => acc + Number(row.amount ?? 0), 0);

  return (
    <DetailDialog
      // ⚠️ L'INTITULE EST LE MEME SUR TOUTES LES LIGNES. Il portait le nombre de
      // souscriptions (« 2 souscriptions »), ce qui faisait varier sa largeur
      // d'une ligne a l'autre et decalait les gestes de decision a sa suite —
      // une colonne d'actions dont les boutons ne s'alignent pas se parcourt mal
      // a la souris. Le nombre est redevenu une qualification de la ligne, dans
      // la colonne de l'offre ; ici il ne reste que le geste.
      label={i18n.t("Historique")}
      icon={<HistoryIcon />}
      title={i18n.t("Historique de {name}", { name: accountName })}
      description={i18n.t("Toutes les souscriptions et tous les encaissements enregistres pour ce compte, du plus recent au plus ancien.")}
    >
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {/* L'identite en tete : la modale s'ouvre depuis une ligne parmi huit, et
          sans visage ni adresse on doute d'etre sur le bon compte. Meme
          vignette, deja signee, que celle de la ligne. */}
      {profile ? (
        <div className="flex items-center gap-3">
          <Avatar className="size-11 shrink-0 rounded-full ring-1 ring-border">
            {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
            <AvatarFallback className="rounded-full bg-accent text-xs font-semibold tracking-wider">
              {initials(accountName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            {profile.email ? (
              <span className="block max-w-full overflow-x-auto whitespace-nowrap text-xs text-muted-foreground">
                {profile.email}
              </span>
            ) : null}
            <span className="flex flex-wrap items-center gap-1.5">
              <StatusPill tone={i18n.labels.entry(ROLE, profile.role).tone}>
                {i18n.labels.label(ROLE, profile.role)}
              </StatusPill>
            </span>
          </div>
        </div>
      ) : null}

      {/* Une bande compacte plutot que trois `StatCard` : la tuile du tableau de
          bord porte une pastille d'icone, une fleche et une ligne de pied, ce
          qui prend dans une modale la hauteur que les deux historiques doivent
          garder. */}
      <section className="grid grid-cols-3 gap-3 rounded-lg border border-border/70 px-4 py-3">
        {[
          { label: i18n.t("Souscriptions"), value: i18n.format.formatNumber(total) },
          { label: i18n.t("Paiements"), value: i18n.format.formatNumber(history.payments.length) },
          { label: i18n.t("Total encaisse"), value: i18n.format.formatAmount(collected) },
        ].map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col gap-1">
            <span className="micro-label">{item.label}</span>
            <span className="truncate text-base font-semibold tabular-nums text-foreground">
              {item.value}
            </span>
          </div>
        ))}
      </section>

      <Section title={i18n.t("Souscriptions")} count={total}>
        {!total ? (
          <EmptyState title={i18n.t("Aucun abonnement")} />
        ) : (
          <ol className="flex flex-col gap-px overflow-hidden rounded-lg border border-border/70">
            {history.subscriptions.map((row, index) => {
              const plan = row.plan_id ? plans.get(row.plan_id) : undefined;
              const isCurrent = row.id === currentSubscriptionId;
              return (
                <li
                  key={row.id}
                  className={cn(
                    "flex flex-col gap-1 bg-card px-3 py-2.5",
                    // La souscription affichee par la liste est relevee d'un
                    // liseré lime a gauche, comme `.row-flagged` releve une
                    // ligne qui demande une decision : la couleur n'est jamais
                    // seule, la pastille le dit aussi.
                    isCurrent && "bg-accent/40 shadow-[inset_3px_0_0_0_var(--brand)]",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {rank(index)}.
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {plan ? i18n.labels.label(PLAN_CODE, plan.code) : i18n.t("Offre inconnue")}
                    </span>
                    <StatusPill tone={i18n.labels.entry(SUBSCRIPTION_STATUS, row.status).tone}>
                      {i18n.labels.label(SUBSCRIPTION_STATUS, row.status)}
                    </StatusPill>
                    {isCurrent ? (
                      <StatusPill tone="info">{i18n.t("Affichee dans la liste")}</StatusPill>
                    ) : null}
                  </div>
                  {/* Les circonstances, en une ligne attenue separee par des
                      points mediants plutot qu'en quatre colonnes. */}
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {i18n.format.formatDate(row.starts_at)}
                      <span className="px-1">→</span>
                      {row.ends_at ? i18n.format.formatDate(row.ends_at) : "—"}
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      {row.auto_renew
                        ? i18n.t("Renouvellement automatique")
                        : i18n.t("Sans renouvellement")}
                    </span>
                    <span aria-hidden>·</span>
                    {/* ⚠️ EN DATE ET HEURE, et c'est la seule chose qui separe
                        deux souscriptions prises le meme jour sur la meme offre
                        — le cas releve sur la base de demonstration. */}
                    <span className="tabular-nums">
                      {i18n.t("Souscrit le {date}", {
                        date: i18n.format.formatDateTime(row.created_at),
                      })}
                    </span>
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title={i18n.t("Paiements")} count={history.payments.length}>
        {!history.payments.length ? (
          <EmptyState title={i18n.t("Aucun paiement")} />
        ) : (
          <ol className="flex flex-col gap-px overflow-hidden rounded-lg border border-border/70">
            {history.payments.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 bg-card px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Le montant d'abord et en chiffres tabulaires : dans une
                      colonne d'encaissements, c'est lui qu'on balaie du regard,
                      et des chiffres a chasse variable ne s'alignent pas. */}
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {i18n.format.formatAmount(row.amount, row.currency ?? "TND")}
                  </span>
                  <StatusPill tone={i18n.labels.entry(PAYMENT_TYPE, row.payment_type).tone}>
                    {i18n.labels.label(PAYMENT_TYPE, row.payment_type)}
                  </StatusPill>
                  <StatusPill tone={i18n.labels.entry(PAYMENT_STATUS, row.status).tone}>
                    {i18n.labels.label(PAYMENT_STATUS, row.status)}
                  </StatusPill>
                </div>
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <span>{i18n.labels.label(PAYMENT_METHOD, row.method)}</span>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">
                    {row.paid_at
                      ? i18n.t("Encaisse le {date}", {
                          date: i18n.format.formatDateTime(row.paid_at),
                        })
                      : i18n.t("Pas encore encaisse")}
                  </span>
                  {row.provider_reference ? (
                    <>
                      <span aria-hidden>·</span>
                      {/* La reference est une chaine a recopier : elle defile
                          dans sa propre boite plutot que d'elargir la modale ou
                          de se couper en deux. */}
                      <span className="max-w-full overflow-x-auto whitespace-nowrap font-mono">
                        {row.provider_reference}
                      </span>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {truncated ? (
        <p className="text-xs text-muted-foreground">
          {i18n.t("Lecture limitee aux {limit} dernieres lignes : l'historique affiche peut etre incomplet.", { limit: i18n.format.formatNumber(FINANCE_HISTORY_LIMIT) })}
        </p>
      ) : null}

      <div className="border-t border-border/70 pt-4">
        <Link href={accountHref} className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>
          <ArrowUpRightIcon />
          {i18n.t("Ouvrir la fiche du compte")}
        </Link>
      </div>
    </DetailDialog>
  );
}

/**
 * Un intitule de section avec son decompte.
 *
 * Le nombre est pose a cote du titre plutot qu'a la fin d'une phrase : on
 * ouvre cette modale pour savoir « combien, et lesquels », et la reponse au
 * « combien » doit tomber sans etre lue.
 */
function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-baseline gap-2">
        <span className="micro-label">{title}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </h3>
      {children}
    </div>
  );
}
