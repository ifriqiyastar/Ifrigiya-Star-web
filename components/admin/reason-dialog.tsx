"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/actions/result";
import { useAdminI18n } from "@/lib/i18n/admin-client";

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
 * Actions qui exigent un motif : refus d'un profil, suspension d'un compte,
 * rejet d'un justificatif. Le motif alimente `status_reason` /
 * `rejection_reason`, colonnes prevues pour ca dans le schema — c'est ce que
 * l'utilisateur verra comme explication, il n'est donc pas optionnel.
 */
export function ReasonDialog({
  action,
  trigger,
  title,
  description,
  label,
  placeholder,
  submitLabel,
  required = true,
  destructive = true,
}: {
  action: (reason: string) => Promise<ActionResult>;
  trigger: React.ReactNode;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  submitLabel?: string;
  required?: boolean;
  destructive?: boolean;
}) {
  const { dict } = useAdminI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const trimmed = reason.trim();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (required && !trimmed) return;
    setPending(true);
    try {
      const result = await action(trimmed);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        setReason("");
        // Voir le commentaire dans ActionButton : un appel d'action hors
        // `<form action>` ne rafraichit pas toujours la page courante tout
        // seul.
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error(dict.common.actionFailed);
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
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">{label ?? dict.common.reason}</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={placeholder}
              rows={4}
              required={required}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {dict.common.cancel}
            </DialogClose>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={pending || (required && !trimmed)}
            >
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {submitLabel ?? dict.common.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
