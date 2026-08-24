"use client";

import * as React from "react";
import { PencilIcon, PlusIcon } from "lucide-react";

import { ScoutDayForm, type ScoutDayFormValue } from "@/components/admin/forms/scout-day-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ScoutDayDialog({ value }: { value?: ScoutDayFormValue }) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const editing = Boolean(value?.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={editing ? "outline" : "default"} size="sm">
            {editing ? <PencilIcon /> : <PlusIcon />}
            {editing ? "Modifier" : "Nouveau Scout Day"}
          </Button>
        }
      />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier le Scout Day" : "Creer un Scout Day"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Mettez a jour les informations. Les inscrits seront notifies si la date, l'heure ou le lieu change."
              : "L'evenement sera cree en brouillon et pourra etre publie apres verification."}
          </DialogDescription>
        </DialogHeader>
        <ScoutDayForm
          value={value}
          submitLabel={editing ? "Enregistrer les modifications" : "Creer en brouillon"}
          onSuccess={close}
        />
      </DialogContent>
    </Dialog>
  );
}
