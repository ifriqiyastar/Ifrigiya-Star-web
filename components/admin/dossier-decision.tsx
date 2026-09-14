"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";


import * as React from "react";
import { BanIcon, FileEditIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Les trois gestes du dossier actif, avec la note qui les accompagne.
 *
 * La note alimente **les deux gestes qui la transmettent** : une demande de
 * piece et un refus l'ecrivent dans `status_reason`, que l'interesse recoit.
 * La validation, elle, efface ce champ par construction — un profil valide ne
 * traine pas l'ancien motif de refus. Le libelle le dit, plutot que de laisser
 * croire qu'un mot ecrit avant d'approuver sera lu par quelqu'un.
 */
export function DossierDecision({
  approve,
  requestChanges,
  reject,
  approveLabel ,
}: {
  approve: () => Promise<ActionResult>;
  requestChanges: (reason: string) => Promise<ActionResult>;
  reject: (reason: string) => Promise<ActionResult>;
  approveLabel?: string;
}) {
  const i18n = useAdminTranslations();
  approveLabel ??= i18n.t("Approuver et notifier");

  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function run(task: () => Promise<ActionResult>, requiresNote: boolean) {
    if (requiresNote && !note.trim()) {
      toast.error(i18n.t("Ce geste demande un motif : il est transmis a l'interesse."));
      return;
    }
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        toast.success(result.message);
        setNote("");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="dossier-note" className="micro-label text-muted-foreground">
          {i18n.t("Motif transmis au candidat")}</Label>
        <Textarea
          id="dossier-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={i18n.t("Piece illisible, licence a joindre, informations a corriger…")}
          className="resize-none text-xs"
        />
        <p className="text-[0.6875rem] text-muted-foreground">
          {i18n.t("Obligatoire pour une demande de piece ou un rejet. Une validation efface ce champ : le motif n'y survit pas.")}</p>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => run(approve, false)}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-bold text-brand-foreground transition-[filter] hover:brightness-110 disabled:opacity-60"
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : <ShieldCheckIcon className="size-4" />}
        {approveLabel}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => requestChanges(note), true)}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-accent text-xs font-medium text-foreground transition-colors hover:bg-accent/70 disabled:opacity-60"
        >
          <FileEditIcon className="size-3.5" />
          {i18n.t("Demander piece")}</button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => reject(note), true)}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-destructive/20 text-xs font-medium text-destructive transition-colors hover:bg-destructive/30 disabled:opacity-60"
        >
          <BanIcon className="size-3.5" />
          {i18n.t("Rejeter le profil")}</button>
      </div>
    </div>
  );
}
