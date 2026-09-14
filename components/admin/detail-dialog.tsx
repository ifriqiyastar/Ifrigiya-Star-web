"use client";

import * as React from "react";
import { EyeIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { useAdminI18n } from "@/lib/i18n/admin-client";
import { cn } from "@/lib/utils";

/**
 * Coquille « voir le detail » : une liste reste lisible parce que le detail
 * est ailleurs, a un clic.
 *
 * Le contenu est passe en `children` et **rendu par le serveur** : un Server
 * Component peut passer du JSX deja rendu a un Client Component (c'est un
 * slot, pas une fonction), donc la fiche detaillee garde ses acces base de
 * donnees et ses Server Actions liees, et ce composant n'a que l'etat
 * d'ouverture a gerer.
 *
 * Le declencheur est un `DialogTrigger` **stylise directement**, pas un
 * `Button` compose via `render` : deux composants qui posent chacun leur
 * `data-slot` ne se fusionnent pas de la meme facon au rendu serveur et au
 * rendu client, ce qui casse l'hydratation de la page entiere.
 */
export function DetailDialog({
  label,
  title,
  description,
  className,
  children,
}: {
  label?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const { dict } = useAdminI18n();
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(buttonVariants({ variant: "outline", size: "xs" }), className)}
      >
        <EyeIcon />
        {label ?? dict.common.details}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-4 py-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
