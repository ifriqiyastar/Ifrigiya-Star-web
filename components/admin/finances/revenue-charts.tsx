import { CalendarDaysIcon, CreditCardIcon } from "lucide-react";

import type { AdminTranslations } from "@/lib/i18n/admin-shared";
import type {
  CumulativePoint,
  FinanceType,
  RevenueSeries,
  SeriesPoint,
} from "@/lib/queries/finance-stats";
import { getAdminI18n } from "@/lib/i18n/admin";
import { cn } from "@/lib/utils";

/**
 * Les figures de revenus de l'ecran des finances : la courbe de cumul, et le
 * mini-graphique d'une carte de type.
 *
 * ⚠️ LES COULEURS DESIGNENT UN TYPE DE PAIEMENT, ET RIEN D'AUTRE. `--viz-1`
 * est l'abonnement, `--viz-2` le Scout Day, dans la courbe comme dans les
 * cartes. C'est pour cela que la courbe de cumul est **empilee** elle aussi,
 * au lieu de tracer un total d'une troisieme couleur : une meme teinte qui
 * change de sens d'une figure a l'autre fait une legende a moitie fausse. La
 * seule marque sans teinte est le prolongement en pointilles, qui n'est pas
 * une serie mais une estimation.
 *
 * ⚠️ SERVER COMPONENTS, SANS JAVASCRIPT, et **aucune valeur n'est accessible
 * au seul survol** : il n'y a plus d'infobulle depuis que la carte des
 * colonnes a ete retiree. Les deux points qui comptent sur la courbe sont
 * nommes sous elle, et chaque carte de type ecrit son montant, ses
 * transactions, son panier moyen et sa part en toutes lettres. Les
 * mini-graphiques ne portent donc qu'un rythme — d'ou leur `aria-hidden` : ils
 * ne cachent aucun nombre que la carte ne dise deja.
 *
 * Le couple (`--viz-1`, `--viz-2`) a ete valide sur la surface de l'admin,
 * qui est le noir pur et non le gris des cartes hors `/admin` : bande de
 * clarte, plancher de chroma, separation daltonisme (ΔE 27,4 protan) et
 * contraste passent tous les quatre.
 */

/** Les deux teintes de serie, dans l'ordre d'empilement (bas vers haut). */
const FILL = { abonnement: "bg-viz-1", scoutDay: "bg-viz-2" } as const;

/**
 * Les jours gradues : le 1er, un sur cinq, et le dernier.
 *
 * ⚠️ Le multiple de cinq s'efface a moins de trois jours de la fin, sinon
 * « 30 » et « 31 » se touchent — et deux graduations collees ne se lisent
 * plus ni l'une ni l'autre.
 */
const labelledDay = (day: number, monthDays: number) =>
  day === 1 || day === monthDays || (day % 5 === 0 && monthDays - day >= 3);

/**
 * Le cumul du mois, empile, prolonge jusqu'a la fin du mois au rythme constate.
 *
 * ⚠️ LE TRAIT PLEIN EST DU REEL, LE POINTILLE UNE ESTIMATION, et les deux ne
 * portent pas la meme couleur : le prolongement est en encre sourde, sans
 * teinte de serie, parce qu'il n'en est pas une. Il part du dernier point reel
 * pour que la jonction ne se lise pas comme un encaissement.
 *
 * ⚠️ L'ECHELLE EST CELLE DE LA PROJECTION, pas celle du realise, et c'est
 * voulu : la courbe occupe alors le bas du cadre, et l'espace qui reste
 * au-dessus EST ce qu'il reste a encaisser. La caler sur le realise ferait
 * sortir le prolongement du cadre, c'est-a-dire retirerait de la figure la
 * moitie de son sujet.
 *
 * ⚠️ PAS DE TABLEAU DE VALEURS ICI, contrairement aux colonnes — c'est une
 * decision, pas un oubli. Les deux seules valeurs qui comptent (le cumul du
 * jour et la fin de mois projetee) sont nommees en toutes lettres sous la
 * figure, et le detail jour par jour est celui du graphique precedent. Un
 * second tableau de trente et une lignes ne rendrait rien de plus.
 */
export async function RevenueCumulative({
  cumulative,
  projected,
  monthDays,
  isCurrentMonth,
}: {
  cumulative: CumulativePoint[];
  projected: CumulativePoint[];
  monthDays: number;
  /** Un mois clos n'a rien a prolonger : ni le titre, ni le dernier point. */
  isCurrentMonth: boolean;
}) {
  const i18n = await getAdminI18n();
  const { formatAmount, formatNumber } = i18n.format;
  // ⚠️ LE TITRE SUIT LE MOIS. Sur un mois clos il n'y a pas de projection, et
  // en promettre une dans l'intitule d'une figure qui n'en porte pas est la
  // meme faute que le graphique a une seule barre : un libelle qui ne decrit
  // pas ce qu'il surmonte.
  const title = isCurrentMonth ? i18n.t("Cumul et projection") : i18n.t("Cumul du mois");

  const current = cumulative.at(-1);
  const end = projected.at(-1);
  const max = Math.max(current?.value ?? 0, end?.value ?? 0);

  if (!current || max <= 0) {
    return (
      <figure className="space-y-2.5">
        <figcaption>
          <ChartTitle label={title} />
        </figcaption>
        <p className="rounded-lg border border-border px-3 py-6 text-center text-xs text-muted-foreground">
          {i18n.t("Aucun encaissement sur ce mois : il n'y a rien a cumuler.")}
        </p>
      </figure>
    );
  }

  // Repere : x est le jour du mois (1 a gauche, le dernier a droite), y la
  // part du maximum. `preserveAspectRatio="none"` etire le trace a la largeur
  // disponible ; `vector-effect` garde malgre tout des traits de 2 px.
  const span = Math.max(monthDays - 1, 1);
  const x = (day: number) => ((day - 1) / span) * 100;
  const y = (value: number) => 100 - (value / max) * 100;
  const line = (points: CumulativePoint[], value: (point: CumulativePoint) => number) =>
    points.map((point) => `${x(point.day)},${y(value(point))}`).join(" ");

  const hasAbonnement = current.abonnement > 0;
  const hasScoutDay = current.scoutDay > 0;
  const left = x(cumulative[0].day);
  const right = x(current.day);
  /** Le trace d'une aire : la frontiere basse, la frontiere haute, retour. */
  const area = (lower: string, upper: string) => `${lower} ${upper}`;
  const abonnementLine = line(cumulative, (point) => point.abonnement);
  const totalLine = line(cumulative, (point) => point.value);
  const totalBack = [...cumulative].reverse().map((point) => `${x(point.day)},${y(point.value)}`).join(" ");

  return (
    <figure className="space-y-2.5">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Pas de periode ici : la carte qui porte cette figure a son propre
            select de mois, juste au-dessus. */}
        <ChartTitle label={title} />
        <Legend i18n={i18n} />
      </figcaption>

      {/* ⚠️ UNE GRILLE, PAS DEUX RANGEES DE `flex`. La gouttiere des
          graduations verticales et la rangee des jours doivent partager
          exactement la meme largeur de colonne, sinon les jours ne tombent
          plus sous leurs points. Mesure en main : avec une gouttiere de
          largeur fixe, « TND 302 856,52 » la debordait et passait par-dessus
          le filet du haut. `auto` la dimensionne sur son contenu, et
          `minmax(0, 1fr)` laisse le trace prendre le reste sans jamais
          pousser la carte au-dela de sa largeur. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <div className="flex h-24 flex-col justify-between text-right text-[0.625rem] leading-none text-muted-foreground tabular-nums sm:h-28">
          <span>{formatAmount(max)}</span>
          <span>{formatNumber(0)}</span>
        </div>

        <div className="relative min-w-0">
          <span aria-hidden className="absolute inset-x-0 top-0 border-t border-border" />
          <span aria-hidden className="absolute inset-x-0 bottom-0 border-t border-border" />
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
            className="h-24 w-full sm:h-28"
          >
            {/* Les aires sont des lavis a 18 % : un aplat sature a cette
                taille ecraserait le reste du panneau. */}
            {hasAbonnement ? (
              <polygon
                points={area(`${left},100`, `${abonnementLine} ${right},100`)}
                className="fill-viz-1/20"
              />
            ) : null}
            {hasScoutDay ? (
              <polygon
                points={area(abonnementLine, totalBack)}
                className="fill-viz-2/20"
              />
            ) : null}
            {hasAbonnement ? (
              <polyline
                points={abonnementLine}
                className="fill-none stroke-viz-1"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {hasScoutDay ? (
              <polyline
                points={totalLine}
                className="fill-none stroke-viz-2"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {projected.length > 1 ? (
              <polyline
                points={line(projected, (point) => point.value)}
                className="fill-none stroke-muted-foreground"
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>

          {/* Les deux reperes sont poses en HTML : dans un `viewBox` etire,
              un cercle SVG deviendrait un ovale. */}
          <Dot left={x(current.day)} top={y(current.value)} className="bg-foreground" />
          {end ? (
            <Dot left={x(end.day)} top={y(end.value)} className="bg-muted-foreground" />
          ) : null}
        </div>

        {/* ⚠️ SEULS LES JOURS GRADUES SONT RENDUS, poses a leur abscisse —
            pas une case par jour. Mesure en main : trente et une cases de
            `flex-1` sous telephone font huit pixels chacune, et `truncate`
            coupait « 10 » en « 1 », « 15 » en « 1 », « 31 » en « 3 ». Un axe
            qui renumerote ses jours est pire qu'un axe sans numeros. */}
        <span aria-hidden />
        <div className="relative mt-1.5 h-3">
          {Array.from({ length: monthDays }, (_, index) => index + 1)
            .filter((day) => labelledDay(day, monthDays))
            .map((day) => (
              <span
                key={day}
                className={cn(
                  "absolute top-0 text-[0.625rem] leading-none text-muted-foreground tabular-nums",
                  // Aux deux bords, l'etiquette se range a l'interieur du
                  // cadre : centree, la moitie en sortirait.
                  day === 1 && "translate-x-0",
                  day === monthDays && "-translate-x-full",
                  day !== 1 && day !== monthDays && "-translate-x-1/2",
                )}
                style={{ left: `${x(day)}%` }}
              >
                {day}
              </span>
            ))}
        </div>
      </div>

      {/* Les deux valeurs qui comptent, nommees plutot que posees sur la
          courbe : en fin de mois les deux reperes se touchent, et deux
          etiquettes superposees ne se lisent plus. */}
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[0.6875rem]">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-foreground" />
          {/* Sur un mois clos, ce point n'est pas « aujourd'hui » : c'est la
              fin du mois, et le total est acquis. */}
          <span className="text-muted-foreground">
            {isCurrentMonth ? i18n.t("Aujourd'hui") : i18n.t("Total du mois")}
          </span>
          <span className="font-semibold tabular-nums">{formatAmount(current.value)}</span>
        </li>
        {end ? (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded-full bg-muted-foreground" />
            {/* Le mois est deja nomme par le titre de la figure : l'ecrire
                ici obligerait le gabarit a elider (« fin d'octobre », « fin de
                mars »), ce qu'un trou `{month}` ne sait pas faire. */}
            <span className="text-muted-foreground">
              {i18n.t("Fin du mois, au rythme constate")}
            </span>
            <span className="font-semibold tabular-nums">{formatAmount(end.value)}</span>
          </li>
        ) : null}
      </ul>
    </figure>
  );
}

/** Un repere rond, cercle par le fond pour rester lisible sur une courbe. */
function Dot({ left, top, className }: { left: number; top: number; className: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card", className)}
      style={{ left: `${left}%`, top: `${top}%` }}
    />
  );
}

/**
 * L'en-tete d'une figure : son sujet, puis la periode qu'elle couvre.
 *
 * La periode est la premiere chose qu'on cherche sur un graphique de revenus —
 * elle merite sa propre marque, pas une fin de phrase. Quand la carte sait en
 * changer, cette marque **est** le select (`control`) : une pastille en lecture
 * seule a cote d'un select dirait deux fois la meme chose.
 */
function ChartTitle({
  label,
  period,
  control,
}: {
  label: string;
  period?: string;
  control?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="micro-label text-muted-foreground">{label}</span>
      {control ??
        (period ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-medium capitalize">
            {period}
          </span>
        ) : null)}
    </div>
  );
}

/** La legende des deux series. Presente des qu'il y en a deux, toujours. */
function Legend({ i18n }: { i18n: AdminTranslations }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <li className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
        <span aria-hidden className={cn("size-2.5 rounded-sm", FILL.abonnement)} />
        {i18n.t("Abonnements")}
      </li>
      <li className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
        <span aria-hidden className={cn("size-2.5 rounded-sm", FILL.scoutDay)} />
        {i18n.t("Scout Days")}
      </li>
    </ul>
  );
}

/**
 * La carte d'un type de paiement : ce qu'il pese, et quand il est tombe.
 *
 * Elle remplace les deux lignes d'une jauge de repartition. Une ligne de
 * jauge ne porte qu'une part ; la carte porte en plus le rythme du type — et
 * c'est ce rythme qui distingue un abonnement, qui tombe regulierement, d'un
 * Scout Day, qui tombe par a-coups autour d'un evenement. L'anatomie est
 * celle des maquettes du client (pastille d'icone et intitule, grande valeur,
 * qualificatif, mini-graphique, ligne de pied).
 *
 * ⚠️ L'ECHELLE EST CELLE DU PAS LE PLUS HAUT DE LA PERIODE, empilement
 * compris — jamais le maximum du seul type dessine. Mises cote a cote, les
 * deux cartes seront comparees : normalisees chacune sur son propre maximum,
 * une serie de 60 TND et une de 500 TND paraitraient egales. A periode egale
 * les deux cartes partagent donc le meme diviseur, et la comparaison que la
 * mise en page invite a faire est la bonne. Quand les deux cartes montrent
 * des mois differents, elles ne sont de toute facon plus comparables : chacune
 * reste alors juste chez elle.
 */
export async function RevenueTypeCard({
  type,
  total,
  transactions,
  average,
  share,
  series,
  scale,
  scoped,
  control,
}: {
  type: FinanceType;
  total: number;
  transactions: number;
  average: number | null;
  share: number;
  series: RevenueSeries;
  scale: number;
  /** La carte est-elle bornee a un mois ? La part le dit. */
  scoped: boolean;
  /** Le select de mois de la carte. */
  control?: React.ReactNode;
}) {
  const i18n = await getAdminI18n();
  const { formatAmount, formatNumber } = i18n.format;
  const abonnement = type === "abonnement";
  const Icon = abonnement ? CreditCardIcon : CalendarDaysIcon;
  const fill = abonnement ? FILL.abonnement : FILL.scoutDay;
  const chip = abonnement ? "bg-viz-1/15 text-viz-1" : "bg-viz-2/15 text-viz-2";
  const value = (point: SeriesPoint) => (abonnement ? point.abonnement : point.scoutDay);
  const empty = scale <= 0 || series.points.every((point) => value(point) === 0);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-secondary p-3 sm:p-4">
      <header className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", chip)}>
            <Icon className="size-3.5" />
          </span>
          <span className="micro-label truncate text-muted-foreground">
            {abonnement ? i18n.t("Abonnements") : i18n.t("Scout Days")}
          </span>
        </span>
        {/* ⚠️ LA PART DIT DE QUOI ELLE EST LA PART. Les deux cartes ont chacune
            leur mois : si l'une montre juillet et l'autre tout l'historique,
            leurs pourcentages ne s'additionnent pas a 100, et deux nombres
            voisins en « % » invitent pourtant a les additionner. Nommer la
            base supprime l'invitation.

            Le qualificatif est en encre, pas dans la teinte de la serie : une
            teinte categorielle en texte de 11 px ne passe pas le contraste. */}
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-semibold">
          {scoped
            ? i18n.t("{share} % du mois", { share: formatNumber(Math.round(share * 100)) })
            : i18n.t("{share} % de l'ensemble", { share: formatNumber(Math.round(share * 100)) })}
        </span>
      </header>

      {/* Chiffres proportionnels, pas tabulaires : a cette taille, `tabular`
          espace les chiffres d'une valeur isolee. */}
      <p className="font-heading text-2xl leading-none font-bold tracking-tight">
        {formatAmount(total)}
      </p>

      {control ? <div className="flex">{control}</div> : null}

      {/* ⚠️ UN FILET CONTINU QUAND IL N'Y A RIEN, et non trente et un traits
          de un pixel : vu a l'ecran, la ligne pointillee d'une carte vide se
          lit comme un separateur, pas comme un axe sans donnee. Le bloc garde
          sa hauteur pour que les deux cartes restent de meme taille. */}
      {empty ? (
        <div className="flex h-8 items-end" aria-hidden>
          <span className="h-px w-full bg-border" />
        </div>
      ) : (
        <ul className="flex h-8 items-end gap-0.5" aria-hidden>
          {series.points.map((point) => (
            <li key={point.start} className="flex h-full min-w-0 flex-1 items-end">
              <span
                className={cn(
                  "w-full rounded-t-[2px]",
                  value(point) > 0 ? cn(fill, "min-h-0.5") : "bg-border",
                )}
                style={{ height: value(point) > 0 ? `${(value(point) / scale) * 100}%` : "1px" }}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
        {i18n.t("{count} transaction(s) · panier moyen {amount}", {
          count: formatNumber(transactions),
          amount: average === null ? "—" : formatAmount(average),
        })}
      </p>
    </article>
  );
}
