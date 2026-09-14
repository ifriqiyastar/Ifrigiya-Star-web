"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";


import * as React from "react";
import { PencilIcon, PlusIcon } from "lucide-react";

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
      <DialogContent className="max-h-[90dvh] gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? i18n.t("Modifier le Scout Day") : i18n.t("Creer un Scout Day")}</DialogTitle>
          <DialogDescription>
            {editing
              ? i18n.t("Mettez a jour les informations. Les inscrits seront notifies si la date, l'heure ou le lieu change.")
              : i18n.t("L'evenement sera cree en brouillon et pourra etre publie apres verification.")}
          </DialogDescription>
        </DialogHeader>
        <ScoutDayForm
          value={value}
          organizers={organizers}
          countries={countries}
          submitLabel={editing ? i18n.t("Enregistrer les modifications") : i18n.t("Creer en brouillon")}
          onSuccess={close}
        />
      </DialogContent>
    </Dialog>
  );
}
