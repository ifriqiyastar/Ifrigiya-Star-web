"use client";

import { CircleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Filet de securite du back-office. Le cas le plus probable est une variable
 * d'environnement Supabase manquante ou une erreur reseau vers la base : on
 * affiche le message plutot qu'un ecran blanc, avec un bouton pour reessayer.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-destructive/20 text-destructive">
        <CircleAlertIcon className="size-5" />
      </span>
      <h1 className="font-heading text-lg font-bold tracking-wider uppercase">
        Une erreur est survenue
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {error.message || "Le back-office n'a pas pu charger cette page."}
      </p>
      {error.digest ? (
        <p className="text-[0.6875rem] text-muted-foreground">Reference : {error.digest}</p>
      ) : null}
      <Button onClick={reset} size="sm">
        Reessayer
      </Button>
    </div>
  );
}
