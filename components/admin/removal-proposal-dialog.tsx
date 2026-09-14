"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";


import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Base UI compose le declencheur via `render` : le `Button` pose
 * `data-slot="button"`, `DialogTrigger` pose `data-slot="dialog-trigger"`, et
 * la fusion des deux ne tranche pas pareil au rendu serveur et au rendu
 * client — d'ou une erreur d'hydratation sur *chaque* dialogue rendu dans une
 * page serveur. On impose donc la valeur du primitif a l'element passe : les
 * deux passes produisent alors le meme attribut.
 */
function asTrigger(trigger: React.ReactNode): React.ReactElement {
  return React.isValidElement(trigger)
    ? React.cloneElement(trigger as React.ReactElement<Record<string, unknown>>, {
        "data-slot": "dialog-trigger",
      })
    : (trigger as unknown as React.ReactElement);
}

/**
 * Proposition de retrait d'un contenu signale (§12.2). Deux champs, parce que
 * la decision en comporte deux : **quel** retrait, et **pourquoi** — c'est ce
 * couple que le super administrateur relira, et le motif est ce qui restera au
 * journal si le retrait est refuse.
 *
 * Distinct de `ReasonDialog`, qui ne porte qu'un motif : ajouter un `select`
 * optionnel a celui-ci aurait rendu ambigus les six appels existants.
 */
export function RemovalProposalDialog({
  action,
  options,
  trigger,
  quarantines,
}: {
  action: (removal: string, reason: string) => Promise<ActionResult>;
  options: { value: string; label: string }[];
  trigger: React.ReactNode;
  /** Vrai si la cible sera masquee des la proposition — a dire avant de cliquer. */
  quarantines: boolean;
}) {
  const i18n = useAdminTranslations();

  const [open, setOpen] = React.useState(false);
  const [removal, setRemoval] = React.useState(options[0]?.value ?? "");
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const trimmed = reason.trim();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed || !removal) return;
    setPending(true);
    try {
      const result = await action(removal, trimmed);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        setReason("");
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error(i18n.t("L'action n'a pas pu aboutir."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={asTrigger(trigger)} />
      <DialogContent>
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{i18n.t("Proposer le retrait")}</DialogTitle>
            <DialogDescription>
              {quarantines
                ? i18n.t("Le contenu est masque des maintenant, puis un super administrateur confirme ou le remet en ligne.")
                : i18n.t("Cette cible ne peut pas etre masquee : elle reste en ligne jusqu'a la decision du super administrateur.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="removal">{i18n.t("Retrait propose")}</Label>
              <NativeSelect
                id="removal"
                value={removal}
                onChange={(event) => setRemoval(event.target.value)}
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposal-reason">{i18n.t("Motif")}</Label>
              <Textarea
                id="proposal-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={i18n.t("Ce que le contenu enfreint, et ce qui a ete verifie.")}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{i18n.t("Annuler")}</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending || !trimmed}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {i18n.t("Proposer le retrait")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
