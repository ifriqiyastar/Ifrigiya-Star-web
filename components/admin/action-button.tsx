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
  /**
   * Nom accessible, **obligatoire des que `children` ne contient pas de
   * texte** : une icone de `lucide-react` est rendue sans titre, donc un
   * bouton qui n'affiche qu'elle n'a aucun nom et s'annonce « bouton ». Sert
   * aussi d'infobulle a la souris.
   */
  label?: string;
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
  label,
  confirm,
  redirectTo,
}: Props) {
  const { dict } = useAdminI18n();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  /**
   * ⚠️ LE RAFRAICHISSEMENT FAIT PARTIE DE L'ATTENTE, DONC DE L'ETAT OCCUPE.
   *
   * `router.refresh()` ne rend rien qu'on puisse attendre : il declenche un
   * rendu serveur et retourne immediatement. Le `finally` ci-dessous rendait
   * donc la main des que l'ecriture etait faite — le toast annoncait le
   * succes, la roulette s'arretait, et le tableau continuait d'afficher
   * l'ancien etat pendant tout le temps du nouveau rendu : 4,8 s mesurees sur
   * une validation de signalement (journal du 29 oct. 2026), contre 10,3 s
   * pour l'action elle-meme. C'est exactement le « ca ne se met pas a jour »
   * remonte par le client : l'ecran ne mentait pas, il n'avait simplement
   * aucun moyen de dire qu'il travaillait encore.
   *
   * Dans une transition, React tient `refreshing` a vrai jusqu'a ce que la
   * nouvelle charge RSC soit **appliquee**. Le bouton reste donc occupe
   * jusqu'a ce que la ligne porte vraiment sa nouvelle valeur. C'est ce que
   * `ServerForm` obtenait deja gratuitement via `useActionState`, et c'est
   * pourquoi les formulaires paraissaient corrects quand les boutons ne
   * l'etaient pas.
   */
  const [refreshing, startRefresh] = React.useTransition();
  const busy = pending || refreshing;

  async function run() {
    setPending(true);
    try {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        // L'action a deja fait `revalidatePath` cote serveur, mais un appel
        // direct (hors `<form action>`) ne redeclenche pas toujours le
        // rafraichissement du Router Cache pour la page courante — un
        // `router.refresh()` explicite le garantit plutot que de compter sur
        // le mecanisme implicite de Next.
        if (redirectTo) router.push(redirectTo);
        else startRefresh(() => router.refresh());
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
      aria-label={label}
      title={label}
      /* Lu par la regle `tr:has([data-action-busy="true"])` de `globals.css` :
         la ligne entiere se marque « en cours » a partir d'ici, sans qu'aucune
         des vingt-deux tables n'ait a envelopper ses lignes. */
      data-action-busy={busy ? "true" : undefined}
      disabled={busy}
      onClick={() => (confirm ? setOpen(true) : run())}
    >
      {busy ? <Loader2Icon className="animate-spin" /> : null}
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
            <AlertDialogCancel disabled={busy}>{dict.common.cancel}</AlertDialogCancel>
            {/* Vert/lime de la marque plutot que rouge : choix explicite du
                client — le rouge classique d'alerte pour une action
                irreversible n'est pas garde ici. */}
            <AlertDialogAction disabled={busy} onClick={run}>
              {busy ? <Loader2Icon className="animate-spin" /> : null}
              {confirm.actionLabel ?? dict.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
