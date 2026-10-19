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
  icon,
  children,
}: {
  /**
   * `ReactNode` et non `string` : un declencheur qui porte le nom de sa cible
   * (le titre d'un Scout Day) doit pouvoir tronquer ce nom, ce qui demande un
   * element, pas une chaine.
   */
  label?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  /**
   * Icone du declencheur, en ELEMENT et non en composant. L'oeil par defaut :
   * « voir le detail ».
   *
   * ⚠️ `<CalendarDaysIcon />` et non `CalendarDaysIcon` : ce composant est un
   * Client Component, et une **fonction** passee depuis un Server Component
   * n'est pas serialisable (« Functions cannot be passed directly to Client
   * Components »). Les icones de `lucide-react` sont bien des fonctions — seul
   * leur `Icon` interne porte « use client ». Un element, lui, est rendu par
   * le serveur avant de traverser, exactement comme `children`.
   *
   * `null` la supprime — utile quand l'appelant veut poser son icone **apres**
   * le libelle, pour que le texte commence a l'exacte abscisse de l'en-tete de
   * colonne.
   */
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { dict } = useAdminI18n();
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(buttonVariants({ variant: "outline", size: "xs" }), className)}
      >
        {icon === undefined ? <EyeIcon /> : icon}
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
