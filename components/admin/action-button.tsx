"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/lib/actions/result";
import { useAdminI18n } from "@/lib/i18n/admin-client";

type Props = {
  /** Server Action deja liee a sa cible (`action.bind(null, id)`). */
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  /** Si present, une confirmation est demandee avant d'executer l'action. */
  confirm?: { title: string; description: string; actionLabel?: string };
  /**
   * Ou naviguer apres un succes — un geste qui fait disparaitre la ligne ou
   * la fiche courante (suppression definitive d'un compte) ne peut pas se
   * contenter du `revalidatePath` deja fait par l'action cote serveur : la
   * page resterait affichee sur une fiche qui n'existe plus.
   */
  redirectTo?: string;
};

/**
 * Bouton declenchant une Server Action, avec etat de chargement et retour
 * utilisateur en toast. Les actions renvoient toutes un `ActionResult`, donc
 * un echec cote base (RLS, contrainte) est affiche au lieu de disparaitre.
 */
export function ActionButton({
  action,
  children,
  variant = "outline",
  size = "xs",
  className,
  confirm,
  redirectTo,
}: Props) {
  const { dict } = useAdminI18n();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function run() {
    setPending(true);
    try {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        if (redirectTo) router.push(redirectTo);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error(dict.common.actionFailed);
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  const trigger = (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={() => (confirm ? setOpen(true) : run())}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : null}
      {children}
    </Button>
  );

  if (!confirm) return trigger;

  return (
    <>
      {trigger}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{dict.common.cancel}</AlertDialogCancel>
            {/* Vert/lime de la marque plutot que rouge : choix explicite du
                client — le rouge classique d'alerte pour une action
                irreversible n'est pas garde ici. */}
            <AlertDialogAction disabled={pending} onClick={run}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {confirm.actionLabel ?? dict.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
