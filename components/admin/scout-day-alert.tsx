"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlarmClockIcon,
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  Loader2Icon,
  MapPinIcon,
  TicketIcon,
  TriangleAlertIcon,
  UserIcon,
  UsersIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminTranslations } from "@/lib/i18n/admin-client";
import type { PendingScoutDay } from "@/lib/scout-day-alert";
import { cn } from "@/lib/utils";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Fermer sans choisir de delai : le rappel par defaut. */
const DEFAULT_SNOOZE = 15 * MINUTE;
const SNOOZE_CHOICES = [30 * MINUTE, HOUR] as const;
/** Cadence a laquelle l'alerte reverifie si elle doit se rouvrir. */
const TICK = 20_000;

type Snooze = { until: number; ids: string[] };

/**
 * Le « bip » de l'alerte, genere par le navigateur (Web Audio) : aucun fichier
 * a servir ni a charger.
 *
 * ⚠️ Les navigateurs interdisent tout son tant que la page n'a recu aucun clic
 * ni aucune frappe. Le contexte audio est donc cree — ou reveille — au premier
 * geste de l'administrateur, et le bip ne joue que s'il tourne. Juste apres un
 * rechargement, avant toute interaction, l'alerte s'ouvre en silence : c'est
 * la regle du navigateur, pas un defaut.
 */
function useAlertSound() {
  const context = React.useRef<AudioContext | null>(null);

  const ensure = React.useCallback(() => {
    if (!context.current) {
      try {
        context.current = new AudioContext();
      } catch {
        return null;
      }
    }
    if (context.current.state === "suspended") void context.current.resume().catch(() => {});
    return context.current;
  }, []);

  React.useEffect(() => {
    window.addEventListener("pointerdown", ensure);
    window.addEventListener("keydown", ensure);
    return () => {
      window.removeEventListener("pointerdown", ensure);
      window.removeEventListener("keydown", ensure);
    };
  }, [ensure]);

  return React.useCallback(() => {
    const audio = ensure();
    if (!audio || audio.state !== "running") return;
    // Carillon montant do-mi-sol, joue deux fois : plus marquant qu'un bip,
    // sans etre une sirene (demande du client : « plus attirant »). Chaque
    // note superpose sa fondamentale et une octave plus douce — c'est ce qui
    // lui donne un timbre de cloche plutot que de sonnerie electronique — et
    // s'eteint en fondu, sans claquement.
    const NOTES = [1047, 1319, 1568];
    const STEP = 0.14;
    const REPEAT_GAP = 0.62;
    [0, REPEAT_GAP].forEach((offset) => {
      NOTES.forEach((frequency, index) => {
        const start = audio.currentTime + offset + index * STEP;
        const gain = audio.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.22, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
        gain.connect(audio.destination);
        for (const [type, multiple, level] of [
          ["triangle", 1, 1],
          ["sine", 2, 0.35],
        ] as const) {
          const voice = audio.createGain();
          voice.gain.value = level;
          voice.connect(gain);
          const oscillator = audio.createOscillator();
          oscillator.type = type;
          oscillator.frequency.value = frequency * multiple;
          oscillator.connect(voice);
          oscillator.start(start);
          oscillator.stop(start + 0.52);
        }
      });
    });
  }, [ensure]);
}

/**
 * L'alerte des Scout Days en attente de validation.
 *
 * Un professionnel soumet un evenement, et seul un super administrateur peut
 * le publier (migration mobile 0040). Une ligne dans la cloche ne suffisait
 * pas : elle se voit si l'on y pense, et un evenement oublie, c'est une
 * journee de detection annoncee trop tard aux joueurs. L'alerte s'ouvre donc
 * d'elle-meme, sur n'importe quelle page du back-office.
 *
 * LA MINUTERIE. Fermer l'alerte ne la congedie pas : elle revient tant que le
 * Scout Day attend. L'administrateur choisit quand (30 min ou 1 h) ; fermer
 * sans choisir — croix, Echap, clic a cote — vaut un rappel dans 15 minutes.
 * Le rappel retient AUSSI la liste des evenements deja vus : un Scout Day
 * soumis entre-temps rouvre l'alerte immediatement, sans attendre la fin du
 * delai. Un rappel ne doit pas masquer ce qu'on n'a jamais vu.
 *
 * Ou vit le rappel : dans le stockage du navigateur, cle par compte. C'est un
 * confort d'affichage par poste, comme la pastille de la cloche
 * (`queue-seen.ts`) ; le vrai garde-fou reste la file de la page Scout Days,
 * qui ne s'oublie pas.
 *
 * Trois regles de politesse :
 *  * elle ne s'ouvre jamais par-dessus une autre fenetre — un formulaire en
 *    cours de saisie ne se fait pas couper ; elle attend le tour suivant ;
 *  * rien a l'hydratation : la decision est prise dans un minuteur, cote
 *    navigateur, donc le HTML serveur ne porte jamais une fenetre ouverte ;
 *  * la liste vient du layout et suit ses rafraichissements (`AutoRefresh`,
 *    temps reel des files) : un evenement valide ailleurs disparait seul, et
 *    l'alerte se ferme quand il n'en reste plus.
 */
export function ScoutDayAlert({
  pending,
  total,
  account,
  onValidate,
  listHref,
  detailHref,
}: {
  pending: PendingScoutDay[];
  /** Nombre total en attente — `pending` est borne a `ALERT_LIMIT`. */
  total: number;
  /** Identifiant du compte : la cle du rappel dans le navigateur. */
  account: string;
  /** `validateScoutDay`, passe par le layout : un composant client ne peut
   * pas importer `lib/actions/*`. */
  onValidate: (scoutDayId: string) => Promise<{ ok: boolean; message: string }>;
  /** Liste des Scout Days, deja prefixee de la langue. */
  listHref: string;
  /** Prefixe de la fiche d'un Scout Day, deja prefixe de la langue. */
  detailHref: string;
}) {
  const i18n = useAdminTranslations();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const [validating, setValidating] = React.useState<string | null>(null);

  const storageKey = `scout-day-alert:${account}`;
  const soundKey = `scout-day-alert-sound:${account}`;
  const playSound = useAlertSound();
  // Le son est actif par defaut ; la preference n'est lue qu'au moment
  // d'ouvrir (dans un minuteur, cote navigateur) — jamais au rendu serveur.
  const [soundOn, setSoundOn] = React.useState(true);
  // L'etat d'ouverture lu depuis les minuteurs : le bip ne joue qu'au passage
  // de fermee a ouverte, pas a chaque verification tant qu'elle reste ouverte.
  const openRef = React.useRef(false);
  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  const readSoundOn = React.useCallback(() => {
    try {
      return window.localStorage.getItem(soundKey) !== "off";
    } catch {
      return true;
    }
  }, [soundKey]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      window.localStorage.setItem(soundKey, next ? "on" : "off");
    } catch {
      // Stockage refuse : le reglage vaut pour cette ouverture seulement.
    }
    // Reactiver fait entendre le son : on sait tout de suite a quoi s'attendre.
    if (next) playSound();
  };
  const ids = React.useMemo(() => pending.map((row) => row.id), [pending]);
  const idsKey = ids.join(",");

  const readSnooze = React.useCallback((): Snooze | null => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      const value = JSON.parse(raw) as Snooze;
      return typeof value?.until === "number" && Array.isArray(value.ids) ? value : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const snooze = React.useCallback(
    (delay: number) => {
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ until: Date.now() + delay, ids } satisfies Snooze),
        );
      } catch {
        // Stockage refuse (navigation privee) : l'alerte reviendra au tour
        // suivant, ce qui est un exces de zele, pas une perte.
      }
      setOpen(false);
    },
    [storageKey, ids],
  );

  // Toute decision d'ouverture se prend dans un minuteur, jamais dans le corps
  // de l'effet : pas de `setState` synchrone dans un effet, et rien qui
  // differe entre le rendu serveur et l'hydratation.
  React.useEffect(() => {
    if (!ids.length) {
      const closing = setTimeout(() => setOpen(false), 0);
      return () => clearTimeout(closing);
    }
    const evaluate = () => {
      setNow(Date.now());
      const current = readSnooze();
      const unseen = !current || ids.some((id) => !current.ids.includes(id));
      const expired = !current || Date.now() >= current.until;
      if (!unseen && !expired) return;
      // Une autre fenetre est ouverte (formulaire, confirmation) : on attend.
      const otherDialog = document.querySelector('[role="dialog"]:not([data-scout-day-alert])');
      if (otherDialog) return;
      if (!openRef.current) {
        const on = readSoundOn();
        setSoundOn(on);
        if (on) playSound();
        openRef.current = true;
      }
      setOpen(true);
    };
    const first = setTimeout(evaluate, 1_500);
    const timer = setInterval(evaluate, TICK);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
    // `idsKey` plutot que `ids` : une nouvelle reference de la meme liste
    // (rafraichissement du layout) ne doit pas relancer les minuteurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, readSnooze, readSoundOn, playSound]);

  async function validate(id: string) {
    setValidating(id);
    try {
      const result = await onValidate(id);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error(i18n.t("La validation a echoue. Reessayez depuis la fiche du Scout Day."));
    } finally {
      setValidating(null);
    }
  }

  const waited = (submittedAt: string | null) => {
    if (!submittedAt) return null;
    const minutes = Math.max(0, Math.floor((now - new Date(submittedAt).getTime()) / MINUTE));
    const label =
      minutes < 60
        ? i18n.t("{0} min", { "0": minutes })
        : minutes < 48 * 60
          ? i18n.t("{0} h", { "0": Math.floor(minutes / 60) })
          : i18n.t("{0} j", { "0": Math.floor(minutes / (24 * 60)) });
    // Au-dela d'une journee l'attente devient un retard ; au-dela de 4 h elle
    // merite l'attention.
    const tone = minutes >= 24 * 60 ? "danger" : minutes >= 4 * 60 ? "warning" : "neutral";
    return { label, tone };
  };

  const snoozeLabel = (delay: number) =>
    delay < HOUR ? i18n.t("{0} min", { "0": delay / MINUTE }) : i18n.t("{0} h", { "0": delay / HOUR });

  if (!pending.length) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) snooze(DEFAULT_SNOOZE);
      }}
    >
      <DialogContent
        data-scout-day-alert=""
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 [--popover:#000000] sm:max-w-xl"
      >
        <DialogHeader className="flex-row items-start gap-3 border-b border-border px-5 pt-5 pb-4 pr-16 sm:px-6">
          {/* Le halo qui pulse dit « ceci attend quelqu'un », sans son ni
              clignotement agressif. */}
          <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning/12 text-warning ring-1 ring-warning/30">
            <span className="absolute inset-0 animate-ping rounded-xl bg-warning/20 [animation-duration:2.4s]" aria-hidden />
            {/* Icone d'alerte qui clignote — demande du client : l'alerte doit
                se remarquer. `motion-safe` : rien ne clignote pour qui a demande
                a son systeme de reduire les animations. L'animation
                `alert-blink` est definie dans `globals.css`. */}
            <TriangleAlertIcon className="relative size-5 motion-safe:animate-[alert-blink_1.2s_ease-in-out_infinite]" />
          </span>
          <div className="min-w-0 space-y-1">
            <DialogTitle className="font-heading text-lg font-bold">
              {total > 1
                ? i18n.t("{0} Scout Days attendent votre validation", { "0": total })
                : i18n.t("Un Scout Day attend votre validation")}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {i18n.t("Tant qu'il n'est pas valide, l'evenement reste invisible des joueurs. Plus l'attente dure, moins ils ont le temps de s'inscrire.")}
            </DialogDescription>
          </div>
        </DialogHeader>

        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
          {pending.slice(0, 3).map((row) => {
            const wait = waited(row.submitted_at);
            return (
              <li key={row.id} className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-heading text-sm font-bold">{row.title}</p>
                  {wait ? (
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
                        wait.tone === "danger"
                          ? "bg-[#ef4444]/15 text-[#ef4444]"
                          : wait.tone === "warning"
                            ? "bg-warning/15 text-warning"
                            : "bg-secondary text-muted-foreground",
                      )}
                    >
                      <ClockIcon className="size-3" />
                      {i18n.t("en attente depuis {0}", { "0": wait.label })}
                    </span>
                  ) : null}
                </div>

                <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="flex items-center gap-1.5">
                    <CalendarDaysIcon className="size-3.5 shrink-0" />
                    <span className="text-foreground/85">
                      {i18n.format.formatDate(row.event_date)}
                      {row.start_time ? ` · ${row.start_time.slice(0, 5)}` : ""}
                    </span>
                  </div>
                  {row.location ? (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <MapPinIcon className="size-3.5 shrink-0" />
                      <span className="truncate text-foreground/85">{row.location}</span>
                    </div>
                  ) : null}
                  {row.organizer ? (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <UserIcon className="size-3.5 shrink-0" />
                      <span className="truncate text-foreground/85">{row.organizer}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <UsersIcon className="size-3.5 shrink-0" />
                      {row.capacity ? i18n.t("{0} places", { "0": row.capacity }) : i18n.t("Sans limite")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <TicketIcon className="size-3.5 shrink-0" />
                      {row.is_paid && row.price_amount
                        ? `${row.price_amount} ${row.price_currency ?? ""}`.trim()
                        : i18n.t("Gratuit")}
                    </span>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {/* Examiner suspend l'alerte : on est en train de s'en
                      occuper. Le refus, qui demande un motif, se fait sur la
                      fiche, avec tous les details sous les yeux. */}
                  <Link
                    href={`${detailHref}/${row.id}`}
                    onClick={() => snooze(DEFAULT_SNOOZE)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <EyeIcon />
                    {i18n.t("Examiner")}
                  </Link>
                  <Button size="sm" disabled={validating !== null} onClick={() => validate(row.id)}>
                    {validating === row.id ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
                    {i18n.t("Valider et publier")}
                  </Button>
                </div>
              </li>
            );
          })}
          {total > 3 ? (
            <li>
              <Link
                href={listHref}
                onClick={() => snooze(DEFAULT_SNOOZE)}
                className="block rounded-xl border border-dashed border-border px-4 py-3 text-center text-xs font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
              >
                {i18n.t("Voir les {0} autres dans la liste des Scout Days", { "0": total - 3 })}
              </Link>
            </li>
          ) : null}
        </ul>

        <div className="flex flex-col gap-3 border-t border-border bg-popover px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {/* Couper le son : memorise par compte, dans ce navigateur. */}
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={!soundOn}
            className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[0.6875rem] font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
          >
            {soundOn ? <Volume2Icon className="size-3.5" /> : <VolumeXIcon className="size-3.5" />}
            {soundOn ? i18n.t("Son active") : i18n.t("Son coupe")}
          </button>
          <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
            <AlarmClockIcon className="size-3.5" />
            {i18n.t("Me le rappeler dans")}
          </p>
          <div className="flex gap-2">
            {SNOOZE_CHOICES.map((delay) => (
              <Button key={delay} type="button" variant="outline" size="sm" onClick={() => snooze(delay)}>
                {snoozeLabel(delay)}
              </Button>
            ))}
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
