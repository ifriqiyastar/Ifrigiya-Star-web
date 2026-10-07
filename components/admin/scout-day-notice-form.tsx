"use client";

import * as React from "react";
import { toast } from "sonner";

import { Field } from "@/components/admin/forms/field";
import { SubmitRow } from "@/components/admin/forms/submit-row";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/result";
import { useAdminTranslations } from "@/lib/i18n/admin-client";
import { SCOUT_DAY_NOTICE_MAX, SCOUT_DAY_NOTICE_MIN } from "@/lib/platform-settings";

/**
 * Le preavis minimum exige d'un organisateur (demande client du 2026-10-07).
 *
 * Le Server Action arrive **lie, en prop** : un composant client ne peut pas
 * importer `lib/actions/*`, qui tire `lib/i18n/admin.ts` et donc
 * `server-only`. Meme convention qu'`ActionButton` et que l'alerte des Scout
 * Days.
 *
 * La valeur affichee vient du serveur a chaque rendu ; l'etat local n'existe
 * que pour que le champ reste saisissable et que le bouton sache s'il a
 * quelque chose a enregistrer.
 */
export function ScoutDayNoticeForm({
  days,
  action,
}: {
  days: number;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const i18n = useAdminTranslations();
  const [value, setValue] = React.useState(String(days));
  const [pending, setPending] = React.useState(false);

  // L'etat suit la valeur du serveur quand celle-ci change (enregistrement,
  // rafraichissement automatique de 30 s) : derive pendant le rendu, jamais
  // dans un effet — `react-hooks/set-state-in-effect` rejette l'autre version.
  const [lastDays, setLastDays] = React.useState(days);
  if (lastDays !== days) {
    setLastDays(days);
    setValue(String(days));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    try {
      const result = await action(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } finally {
      setPending(false);
    }
  }

  const parsed = Number(value);
  const valid =
    value.trim() !== "" &&
    Number.isInteger(parsed) &&
    parsed >= SCOUT_DAY_NOTICE_MIN &&
    parsed <= SCOUT_DAY_NOTICE_MAX;

  return (
    <form onSubmit={submit}>
      {/* ⚠️ Bordure visible, meme correctif que `/admin/profil`. Dans
          `.admin-dashboard-shell`, `--input` vaut `#000000` et le fond du
          champ est presque noir : sans ca le champ n'a aucun contour et se
          fond dans le panneau. `:not(:focus-visible)` laisse la couleur de
          focus reprendre la main au clic. */}
      <div className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-5 [&_[data-slot=input]:not(:focus-visible)]:border-border">
        <Field
          label={i18n.t("Preavis minimum (en jours)")}
          htmlFor="scout-day-notice"
          hint={i18n.t("0 desactive la regle : un organisateur peut alors deposer un evenement pour n'importe quelle date a venir.")}
        >
          <Input
            id="scout-day-notice"
            name="days"
            type="number"
            inputMode="numeric"
            min={SCOUT_DAY_NOTICE_MIN}
            max={SCOUT_DAY_NOTICE_MAX}
            step={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            // Un nombre de jours tient en trois chiffres : `w-full` etalait le
            // champ sur toute la demi-colonne, soit ~600 px pour saisir « 7 ».
            // La largeur d'un champ annonce ce qu'on attend dedans.
            className="max-w-24"
          />
        </Field>
        <p className="self-center text-xs text-muted-foreground">
          {valid && parsed > 0
            ? i18n.t("Avec {days} jour(s), la premiere date qu'un professionnel peut viser aujourd'hui est le {date}.", {
                days: parsed,
                date: i18n.format.formatDate(addDays(parsed)),
              })
            : valid
              ? i18n.t("Aucune date n'est interdite : seule la regle existante — une date deja passee — continue de s'appliquer.")
              : i18n.t("Indiquez un nombre entier de jours, entre {min} et {max}.", {
                  min: SCOUT_DAY_NOTICE_MIN,
                  max: SCOUT_DAY_NOTICE_MAX,
                })}
        </p>
      </div>
      <SubmitRow pending={pending} disabled={!valid} label={i18n.t("Enregistrer le preavis")} />
    </form>
  );
}

/**
 * La date minimale, calculee en UTC et rendue en `YYYY-MM-DD` : `event_date`
 * est un `date` Postgres sans fuseau, et passer par l'heure locale la
 * decalerait d'un jour selon le decalage du poste. Meme precaution que la
 * page des Scout Days pour son calendrier.
 */
function addDays(days: number): string {
  const now = new Date();
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days);
  return new Date(utc).toISOString().slice(0, 10);
}
