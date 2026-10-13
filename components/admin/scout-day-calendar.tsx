import { getAdminI18n } from "@/lib/i18n/admin";
import type { AdminTranslations } from "@/lib/i18n/admin-shared";
import Link from "next/link";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, MapPinIcon } from "lucide-react";

import { AgendaPager } from "@/components/admin/agenda-pager";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { buttonVariants } from "@/components/ui/button";
import { SCOUT_DAY_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type CalendarEvent = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  location: string | null;
  status: string;
};

/**
 * Habillage d'un evenement selon son statut : aplat plein aux couleurs du
 * statut, reprises par la pastille de legende. Le libelle reste ecrit dans la
 * legende et dans l'infobulle — la couleur appuie l'information, elle ne la
 * porte jamais seule.
 *
 * Le texte est **sombre sur l'aplat** (`text-background`), pas blanc : les
 * cinq couleurs de statut de la palette sombre sont toutes claires
 * (#7BD650, #F5B942, #6BA8F5, #F2476B, #8E8E93), du blanc dessus tomberait
 * sous le seuil de contraste. Les mentions secondaires (heure, lieu) heritent
 * de cette couleur en `opacity-70` plutot que de reprendre
 * `text-muted-foreground`, illisible sur un fond sature.
 */
const STATUS_STYLE: Record<string, { chip: string; dot: string }> = {
  publie: { chip: "bg-success text-background hover:bg-success/85", dot: "bg-success" },
  en_attente_validation: {
    chip: "bg-warning text-background hover:bg-warning/85",
    dot: "bg-warning",
  },
  brouillon: {
    chip: "bg-muted-foreground text-background hover:bg-muted-foreground/85",
    dot: "bg-muted-foreground",
  },
  // Un vrai rouge, pas `destructive` : dans `.admin-dashboard-shell` il vaut
  // `#f05260`, un corail qui se lisait rose a cote du jaune « en attente ».
  // Le texte sombre reste au-dessus du seuil de contraste sur `#ef4444`.
  annule: {
    chip: "bg-[#ef4444] text-background hover:bg-[#ef4444]/85",
    dot: "bg-[#ef4444]",
  },
  cloture: { chip: "bg-info text-background hover:bg-info/85", dot: "bg-info" },
};

const styleFor = (status: string) =>
  STATUS_STYLE[status] ?? {
    chip: "bg-muted-foreground text-background hover:bg-muted-foreground/85",
    dot: "bg-muted-foreground",
  };

function getWEEKDAYS(i18n: AdminTranslations) {
  return [i18n.t("Lundi"), i18n.t("Mardi"), i18n.t("Mercredi"), i18n.t("Jeudi"), i18n.t("Vendredi"), i18n.t("Samedi"), i18n.t("Dimanche")];
}

function getMONTHLABEL(i18n: AdminTranslations) {
  return new Intl.DateTimeFormat((i18n.locale === "en" ? "en-GB" : "fr-FR"), { month: "long", year: "numeric" });
}
function getDAYLABEL(i18n: AdminTranslations) {
  return new Intl.DateTimeFormat((i18n.locale === "en" ? "en-GB" : "fr-FR"), {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
}

/** `YYYY-MM` -> `YYYY-MM` du mois voisin, sans passer par un fuseau horaire. */
function shiftMonth(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const total = year * 12 + (monthIndex - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

const MAX_PER_DAY = 3;

/**
 * Taille d'une page de l'agenda de telephone. Meme valeur que les files du
 * back-office : la grille mensuelle, elle, n'est jamais paginee — un mois se
 * lit d'un coup d'oeil ou il ne sert a rien.
 */
const AGENDA_PAGE_SIZE = 8;

/**
 * Calendrier mensuel de tous les Scout Days (§12.3).
 *
 * Rendu cote serveur : le mois affiche vit dans l'URL (`?mois=YYYY-MM`), donc
 * la page reste un Server Component qui refait sa requete, le mois est
 * partageable par lien et le retour navigateur fonctionne — meme convention
 * que les filtres et la pagination du reste du back-office.
 *
 * Les dates sont manipulees en chaines `YYYY-MM-DD`, jamais via `Date` local :
 * la colonne `scout_days.event_date` est un `date` Postgres sans fuseau, et le
 * passer dans un `Date` local decalerait l'evenement d'un jour selon le
 * decalage horaire du serveur.
 */
export async function ScoutDayCalendar({
  events,
  month,
  basePath,
  params = {},
  today,
}: {
  events: CalendarEvent[];
  /** Mois affiche, au format `YYYY-MM`. */
  month: string;
  basePath: string;
  params?: Record<string, string | undefined>;
  /** Date du jour au format `YYYY-MM-DD`, calculee par la page. */
  today: string;
}) {
  const i18n = await getAdminI18n();

  const [year, monthIndex] = month.split("-").map(Number);

  // `Date.UTC` garde le calcul hors fuseau : on n'en tire que des numeros de
  // jour et un jour de semaine, jamais une date affichee.
  const firstOfMonth = new Date(Date.UTC(year, monthIndex - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  // getUTCDay() : 0 = dimanche. On veut une semaine qui commence lundi.
  const leading = (firstOfMonth.getUTCDay() + 6) % 7;

  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.event_date) ?? [];
    list.push(event);
    byDate.set(event.event_date, list);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  }

  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`,
    ),
  ];
  // On complete la derniere semaine pour que la grille reste rectangulaire.
  while (cells.length % 7 !== 0) cells.push(null);

  const href = (targetMonth: string | null) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "mois") next.set(key, value);
    }
    if (targetMonth) next.set("mois", targetMonth);
    const query = next.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const navButton = cn(buttonVariants({ variant: "outline", size: "icon-sm" }));
  // L'agenda de telephone est groupe par jour : une entree par date occupee,
  // dans l'ordre, chacune portant ses evenements deja tries par heure
  // ci-dessus. Remplace une liste a plat ou chaque ligne repetait sa date.
  const byDay = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <Panel>
      <PanelHeader
        title={i18n.t("Calendrier des evenements")}
        description={
          <>
            {i18n.t("{0} evenement(s) ce mois-ci, tous statuts confondus — les filtres de la liste ci-dessous ne s'y appliquent pas.", { "0": events.length })}
            {/* Legende : la couleur seule ne doit pas porter le statut. Collee
                a la phrase, dans l'en-tete, au-dessus du trait qui ouvre la
                grille : on lit le code avant le calendrier. Des `span` et non
                des `div` — `PanelHeader` rend la description dans un `<p>`. */}
            <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {(
                ["publie", "en_attente_validation", "brouillon", "cloture", "annule"] as const
              ).map((status) => (
                <span key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-3 rounded-sm", styleFor(status).dot)} />
                  {i18n.labels.label(SCOUT_DAY_STATUS, status)}
                </span>
              ))}
            </span>
          </>
        }
        action={
          <div className="flex items-center gap-1.5">
            <Link
              href={href(shiftMonth(month, -1))}
              aria-label={i18n.t("Mois precedent")}
              className={navButton}
            >
              <ChevronLeftIcon />
            </Link>
            <span className="min-w-28 text-center text-sm font-semibold capitalize sm:min-w-36">
              {getMONTHLABEL(i18n).format(firstOfMonth)}
            </span>
            <Link
              href={href(shiftMonth(month, 1))}
              aria-label={i18n.t("Mois suivant")}
              className={navButton}
            >
              <ChevronRightIcon />
            </Link>
            <Link
              href={href(null)}
              className={cn(buttonVariants({ variant: "secondary", size: "xs" }), "ml-1")}
            >
              {i18n.t("Aujourd'hui")}</Link>
          </div>
        }
      />

      <div className="px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
        {/* Grille mensuelle — masquee sous `sm`, ou une vignette lisible ne
            tient pas dans un septieme de largeur. L'agenda ci-dessous prend
            alors le relais. */}
        <div className="hidden grid-cols-7 gap-1.5 sm:grid">
          {getWEEKDAYS(i18n).map((day) => (
            <div key={day} className="pb-2 text-xs font-medium text-muted-foreground">
              <span className="lg:hidden">{day.slice(0, 3)}</span>
              <span className="hidden lg:inline">{day}</span>
            </div>
          ))}

          {cells.map((date, index) => {
            if (!date) {
              return (
                <div
                  key={`vide-${index}`}
                  className="min-h-32 rounded-xl bg-background/40"
                  aria-hidden
                />
              );
            }

            const dayEvents = byDate.get(date) ?? [];
            const isToday = date === today;
            const dayNumber = Number(date.slice(-2));

            return (
              <div
                key={date}
                // Le jour courant ne se signale que par le rond lime autour de
                // son numero : la cellule garde le fond de toutes les autres.
                // Le fond appartient desormais aux evenements, et deux aplats
                // concurrents dans la meme case ne se lisaient plus.
                className="flex min-h-32 flex-col gap-1.5 rounded-xl bg-secondary/50 p-2"
              >
                <div className="flex items-center justify-between gap-1">
                  {/* Le jour courant est un pastille pleine : repere immediat. */}
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                      isToday
                        ? "bg-brand font-bold text-brand-foreground"
                        : "font-medium text-muted-foreground",
                    )}
                  >
                    {dayNumber}
                  </span>
                  {dayEvents.length > MAX_PER_DAY ? (
                    <span className="text-[0.625rem] font-medium text-muted-foreground">
                      {dayEvents.length}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1">
                  {dayEvents.slice(0, MAX_PER_DAY).map((event) => (
                    <Link
                      key={event.id}
                      href={i18n.path(`/admin/scout-days/${event.id}`)}
                      title={`${event.title}${event.location ? ` — ${event.location}` : ""} (${i18n.labels.label(SCOUT_DAY_STATUS, event.status)})`}
                      className={cn(
                        "flex flex-col gap-0.5 rounded-md px-1.5 py-1 transition-colors",
                        styleFor(event.status).chip,
                      )}
                    >
                      <span className="flex items-baseline gap-1">
                        {event.start_time ? (
                          <span className="shrink-0 text-[0.625rem] font-semibold opacity-70 tabular-nums">
                            {event.start_time.slice(0, 5)}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-xs leading-tight font-semibold">
                          {event.title}
                        </span>
                      </span>
                      {event.location ? (
                        <span className="hidden truncate text-[0.625rem] opacity-70 xl:block">
                          {event.location}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                  {dayEvents.length > MAX_PER_DAY ? (
                    <span className="px-1.5 text-[0.625rem] text-muted-foreground">
                      +{dayEvents.length - MAX_PER_DAY}  {i18n.t("autre(s)")}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* --- SOUS `sm` : vue du mois en pastilles, puis agenda par jour ---

            La grille au-dessus est masquee ici (une vignette lisible ne tient
            pas dans un septieme de largeur), mais la remplacer par une simple
            liste faisait disparaitre **toute** notion de mois : on ne voyait
            plus ni les trous, ni les grappes, ni ou l'on en est. Cette grille
            compacte ne porte donc que des points de statut — pas de titre a
            caser — et chaque jour occupe renvoie a son groupe dans l'agenda. */}
        <div className="sm:hidden">
          <div className="grid grid-cols-7 gap-1">
            {getWEEKDAYS(i18n).map((day) => (
              <span
                key={day}
                className="pb-1 text-center text-[0.625rem] font-medium text-muted-foreground"
              >
                {day.slice(0, 2)}
              </span>
            ))}

            {cells.map((date, index) => {
              if (!date) return <span key={`vide-${index}`} aria-hidden />;

              const dayEvents = byDate.get(date) ?? [];
              const isToday = date === today;
              const number = (
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[0.6875rem] tabular-nums",
                    isToday
                      ? "bg-brand font-bold text-brand-foreground"
                      : dayEvents.length
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {Number(date.slice(-2))}
                </span>
              );
              // Une rangee de points de hauteur fixe, occupee ou non : sans
              // elle, les jours sans evenement seraient plus courts et la
              // grille ondulerait d'une semaine a l'autre.
              const dots = (
                <span className="flex h-1.5 items-center justify-center gap-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={cn("size-1.5 rounded-full", styleFor(event.status).dot)}
                    />
                  ))}
                </span>
              );
              const inner = (
                <>
                  {number}
                  {dots}
                </>
              );

              if (!dayEvents.length) {
                return (
                  <span
                    key={date}
                    className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg"
                  >
                    {inner}
                  </span>
                );
              }
              return (
                <a
                  key={date}
                  href={`#jour-${date}`}
                  aria-label={i18n.t("{0} evenement(s) ce jour", { "0": dayEvents.length })}
                  className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg bg-secondary/50 transition-colors hover:bg-secondary"
                >
                  {inner}
                </a>
              );
            })}
          </div>

          <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">
            {i18n.t("Agenda du mois")}</p>
          {!byDay.length ? (
            <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <CalendarDaysIcon className="size-3.5" />
              {i18n.t("Aucun evenement programme ce mois-ci.")}</p>
          ) : (
            <AgendaPager
              pageSize={AGENDA_PAGE_SIZE}
              counts={byDay.map(([, list]) => list.length)}
              ids={byDay.map(([date]) => `jour-${date}`)}
            >
              {byDay.map(([date, dayEvents]) => (
                // Le jour est ecrit UNE fois, en tete de son groupe. Chaque
                // ligne le repetait dans une colonne de 96 px fixes, qui
                // mangeait presque un tiers de la largeur utile.
                <section key={date} id={`jour-${date}`} className="scroll-mt-20">
                  <h3
                    className={cn(
                      "mb-1.5 flex items-center gap-2 text-xs font-semibold capitalize",
                      date === today ? "text-brand" : "text-muted-foreground",
                    )}
                  >
                    {getDAYLABEL(i18n).format(new Date(`${date}T00:00:00Z`))}
                    {date === today ? (
                      <span className="micro-label rounded bg-brand px-1.5 py-0.5 text-brand-foreground">
                        {i18n.t("Aujourd'hui")}</span>
                    ) : null}
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {dayEvents.map((event) => (
                      <li key={event.id}>
                        <Link
                          href={i18n.path(`/admin/scout-days/${event.id}`)}
                          className="flex items-stretch gap-2.5 rounded-lg bg-secondary/50 p-2.5 transition-colors hover:bg-secondary"
                        >
                          {/* Un liseré de statut plutot qu'un aplat plein sur
                              toute la ligne : dix lignes saturees empilees sur
                              un telephone etouffent le titre, qui est ce qu'on
                              vient lire. La couleur code toujours le statut, et
                              le libelle reste ecrit en dessous — elle ne porte
                              jamais l'information seule. */}
                          <span
                            className={cn("w-1 shrink-0 rounded-full", styleFor(event.status).dot)}
                          />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="flex items-baseline gap-2">
                              {event.start_time ? (
                                <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                                  {event.start_time.slice(0, 5)}
                                </span>
                              ) : null}
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                {event.title}
                              </span>
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] text-muted-foreground">
                              <span className="font-medium">
                                {i18n.labels.label(SCOUT_DAY_STATUS, event.status)}
                              </span>
                              {event.location ? (
                                <span className="flex min-w-0 items-center gap-1">
                                  <MapPinIcon className="size-3 shrink-0" />
                                  <span className="truncate">{event.location}</span>
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </AgendaPager>
          )}
        </div>
      </div>

    </Panel>
  );
}
