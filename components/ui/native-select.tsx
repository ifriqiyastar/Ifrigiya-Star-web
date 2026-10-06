import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * `<select>` natif, stylise comme l'`Input` de shadcn.
 *
 * Les formulaires d'edition du back-office sont des `<form>` classiques dont
 * les valeurs sont lues via `FormData` : un select natif y participe sans
 * etat client, la ou le `Select` de Base UI demanderait un composant
 * controle par champ. Le `Select` reste utilise pour les filtres, ou l'etat
 * vit dans l'URL.
 *
 * `appearance-none` est le repli ; la ou `base-select` existe, il prend la
 * main — sans quoi cette classe utilitaire ecraserait la regle de
 * `globals.css` et la liste ouverte garderait le survol bleu du systeme au
 * lieu du vert de la marque.
 */
export function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-10 w-full cursor-pointer appearance-none supports-[appearance:base-select]:[appearance:base-select] rounded-xl border border-input bg-secondary pr-9 pl-3.5 text-sm outline-none transition-colors focus-visible:border-ring/60 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
