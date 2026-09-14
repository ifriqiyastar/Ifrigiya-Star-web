import { getAdminI18n } from "@/lib/i18n/admin";
import type { AdminTranslations } from "@/lib/i18n/admin-shared";
import Link from "next/link";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, MapPinIcon } from "lucide-react";

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
  annule: {
    chip: "bg-destructive text-background hover:bg-destructive/85",
    dot: "bg-destructive",
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
  const sorted = [...events].sort(
    (a, b) =>
      a.event_date.localeCompare(b.event_date) ||
      (a.start_time ?? "").localeCompare(b.start_time ?? ""),
  );

  return (
    <Panel>
      <PanelHeader
        title={i18n.t("Calendrier des evenements")}
        description={i18n.t("{0} evenement(s) ce mois-ci, tous statuts confondus — les filtres de la liste ci-dessous ne s'y appliquent pas.", { "0": events.length })}
        action={
          <div className="flex items-center gap-1.5">
            <Link
              href={href(shiftMonth(month, -1))}
              aria-label={i18n.t("Mois precedent")}
              className={navButton}
            >
              <ChevronLeftIcon />
            </Link>
            <span className="min-w-36 text-center text-sm font-semibold capitalize">
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

      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
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

        {/* Agenda : seul affichage sous `sm`, et complement lisible du mois
            au-dela — il montre les evenements que la grille tronque. */}
        <div className="sm:mt-5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {i18n.t("Agenda du mois")}</p>
          {!sorted.length ? (
            <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <CalendarDaysIcon className="size-3.5" />
              {i18n.t("Aucun evenement programme ce mois-ci.")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {sorted.map((event) => (
                <li key={event.id}>
                  <Link
                    href={i18n.path(`/admin/scout-days/${event.id}`)}
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 transition-colors",
                      styleFor(event.status).chip,
                      // Le jour courant se signale par un liseré, pas par un
                      // aplat concurrent : la couleur de fond appartient a
                      // l'evenement, comme dans la grille.
                      event.event_date === today && "ring-2 ring-brand ring-inset",
                    )}
                  >
                    <span className="w-24 shrink-0 text-xs font-semibold opacity-75 capitalize">
                      {getDAYLABEL(i18n).format(new Date(`${event.event_date}T00:00:00Z`))}
                    </span>
                    {event.start_time ? (
                      <span className="shrink-0 text-xs font-semibold opacity-75 tabular-nums">
                        {event.start_time.slice(0, 5)}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {event.title}
                    </span>
                    {event.location ? (
                      <span className="flex min-w-0 shrink-0 items-center gap-1 text-xs opacity-75">
                        <MapPinIcon className="size-3" />
                        <span className="max-w-32 truncate">{event.location}</span>
                      </span>
                    ) : null}
                    <span className="shrink-0 text-xs font-semibold opacity-75">
                      {i18n.labels.label(SCOUT_DAY_STATUS, event.status)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Legende : la couleur seule ne doit pas porter le statut. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {(
            ["publie", "en_attente_validation", "brouillon", "cloture", "annule"] as const
          ).map((status) => (
            <span key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-3 rounded-sm", styleFor(status).dot)} />
              {i18n.labels.label(SCOUT_DAY_STATUS, status)}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
}
