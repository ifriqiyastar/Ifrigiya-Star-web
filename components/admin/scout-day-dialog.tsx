"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";


import * as React from "react";
import { CalendarPlusIcon, PencilIcon, PlusIcon } from "lucide-react";

import {
  ScoutDayForm,
  type ScoutDayFormValue,
  type ScoutDayOrganizer,
} from "@/components/admin/forms/scout-day-form";
import { Button } from "@/components/ui/button";
import type { Country } from "@/lib/countries-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ScoutDayDialog({
  value,
  organizers,
  countries,
}: {
  value?: ScoutDayFormValue;
  organizers?: ScoutDayOrganizer[];
  countries?: Country[];
}) {
  const i18n = useAdminTranslations();

  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const editing = Boolean(value?.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          // `data-slot` impose : `Button` et `DialogTrigger` le posent tous les
          // deux, et Base UI ne tranche pas pareil au rendu serveur et au rendu
          // client — c'est ce qui casse l'hydratation de la page entiere.
          <Button data-slot="dialog-trigger" variant={editing ? "outline" : "default"} size="sm">
            {editing ? <PencilIcon /> : <PlusIcon />}
            {editing ? i18n.t("Modifier") : i18n.t("Nouveau Scout Day")}
          </Button>
        }
      />
      {/* Trois etages : en-tete fixe, contenu qui defile, pied fixe portant
          les boutons. Tout defilait d'un bloc — le titre disparaissait des le
          premier coup de molette, et « Creer » n'apparaissait qu'au bas d'un
          formulaire de cinq sections. `flex` remplace la grille par defaut du
          dialogue pour que le milieu seul prenne la hauteur restante.
          `--popover` vaut `#000000` dans toute la fenetre : rendue dans un
          portail hors de `.admin-dashboard-shell`, elle prenait le `--popover`
          general (`#1B1B1D`). La variable, et non une couleur de fond, parce
          que les listes ouvertes des `<select>` (`globals.css`) la lisent
          aussi : fenetre et listes passent au noir ensemble. */}
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 [--popover:#000000] sm:max-w-3xl">
        <DialogHeader className="flex-row items-start gap-3 border-b border-border px-5 pt-5 pb-4 pr-16 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand ring-1 ring-brand/25">
            {editing ? <PencilIcon className="size-4.5" /> : <CalendarPlusIcon className="size-4.5" />}
          </span>
          <div className="min-w-0 space-y-1">
            <DialogTitle className="font-heading text-lg font-bold">
              {editing ? i18n.t("Modifier le Scout Day") : i18n.t("Creer un Scout Day")}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {editing
                ? i18n.t("Mettez a jour les informations. Les inscrits seront notifies si la date, l'heure ou le lieu change.")
                : i18n.t("L'evenement sera cree en brouillon et pourra etre publie apres verification.")}
            </DialogDescription>
          </div>
        </DialogHeader>
        <ScoutDayForm
          value={value}
          organizers={organizers}
          countries={countries}
          submitLabel={editing ? i18n.t("Enregistrer les modifications") : i18n.t("Creer en brouillon")}
          onSuccess={close}
          onCancel={close}
        />
      </DialogContent>
    </Dialog>
  );
}
