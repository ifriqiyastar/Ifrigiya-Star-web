"use client";

import { useLinkStatus } from "next/link";
import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Petit indicateur de chargement pour un `Link` precis, pas pour la page
 * entiere : les onglets (`SegmentedNav`) et les liens du rail (`NavMain`)
 * naviguent vers un Server Component qui relit la base a chaque clic — sans
 * retour visuel, le clic semblait ne rien faire jusqu'a l'arrivee de la
 * reponse.
 *
 * `useLinkStatus()` (next/link) ne peut etre lu que par un **enfant** du
 * `Link` concerne, jamais par un composant voisin : c'est pourquoi ce
 * composant se pose a l'interieur de chaque lien plutot que d'observer la
 * navigation globalement.
 */
export function LinkPendingIcon({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Loader2Icon className={cn("size-3.5 shrink-0 animate-spin", className)} aria-hidden />;
}
